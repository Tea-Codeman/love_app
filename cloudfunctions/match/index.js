// cloudfunctions/match/index.js —— F3 规则撮合（冷启期规则匹配 T4 已决）
// 动作：recommend（兴趣/同城/年龄邻近打分） / accept（A 发起→建 matches[active] + 自动建 waiting 局邀 B）
//       myPending（B 侧待接受局） / decline（B 拒绝→取消局 + match 失效）
// 注意：matches / games 集合需在 CloudBase 控制台手动创建（与 users 同，不自动建集合）。
// 匹配状态（matches.status）：active（已匹配/待加入，会被推荐过滤）→ done（玩完，双方回大厅可再约）/ cancelled（拒绝或取消）。
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command
const MATCHES_COL = 'matches'
const GAMES_COL = 'games'
const USERS_COL = 'users'
const BLOCKS_COL = 'blocks'
// 每题"默契"（双方选同一项）折算到契合度的权重：游戏结果在资料分之上累加
const TACIT_WEIGHT = 4
// MBTI 维度契合权重：每有一个维度字母相同 +2（0–8）；EI 互补（一外向一内向）另 +3。
// 恋爱场景中 SN/TF/JP 相同意味着沟通方式、价值观与生活节奏契合；EI 互补是经典互补，故单独加权。
// 权重集中在此，后续随真实数据调整即可。前端不重复实现该评分（打分属服务端权威逻辑）。
const MBTI_SAME_WEIGHT = 2
const MBTI_EI_COMPLEMENT_WEIGHT = 3

// MBTI 契合加分；任一方未测评时返回 0（不惩罚未填资料的用户）
function scoreMbtiFit(myType, otherType) {
  if (typeof myType !== 'string' || typeof otherType !== 'string') return 0
  if (myType.length !== 4 || otherType.length !== 4) return 0
  let score = 0
  for (let i = 0; i < 4; i++) {
    if (myType[i] === otherType[i]) score += MBTI_SAME_WEIGHT
  }
  if (myType[0] !== otherType[0]) score += MBTI_EI_COMPLEMENT_WEIGHT
  return score
}

// 规则匹配打分（T4：冷启期无行为数据，先用兴趣/资料属性规则）
function scoreCandidate(me, other) {
  let score = 0
  const myTags = me.interestTags || []
  const oTags = other.interestTags || []
  const shared = myTags.filter(t => oTags.includes(t))
  score += shared.length * 10            // 兴趣重合权重最高
  if (me.city && other.city && me.city === other.city) score += 8   // 同城
  const a = Number(me.age)
  const b = Number(other.age)
  if (a && b) score += Math.max(0, 10 - Math.abs(a - b))   // 同龄附近加分，差>10岁不加分
  const mbtiFit = scoreMbtiFit(me.mbti, other.mbti)        // MBTI 维度契合（未测评为 0）
  score += mbtiFit
  return { score, sharedTags: shared, mbtiFit }
}

async function getBlockedIds(OPENID) {
  if (!OPENID) return []
  try {
    const r = await db.collection(BLOCKS_COL).where({ blockerId: OPENID }).get()
    return (r.data || []).map(b => b.blockedId)
  } catch (e) { return [] }
}

// 已和当前用户处于 active/pending 匹配的另一方 openid（避免重复推荐）
async function getMatchedOpenids(OPENID) {
  try {
    const r = await db.collection(MATCHES_COL)
      .where(_.or([{ userA: OPENID, status: 'active' }, { userB: OPENID, status: 'active' }]))
      .get()
    const set = new Set()
    ;(r.data || []).forEach(m => set.add(m.userA === OPENID ? m.userB : m.userA))
    return set
  } catch (e) { return new Set() }
}

// 批量聚合「我 vs 这些候选」的历史对局统计（局数 + 默契题数）。
// 原先是每个候选各查一次 matches（N+1，候选上限 100 即最多 100 次查询），
// 现改为按批一次查完再在内存分组：查询次数从 N 降到 ceil(N/20)。
// 注意：_.in 数组不宜过大，故分批；单批失败只影响该批（按无历史对局处理）。
const AGG_BATCH = 20

async function aggregateDoneStats(OPENID, userIds) {
  const stats = {}
  if (!OPENID || !userIds.length) return stats
  for (let i = 0; i < userIds.length; i += AGG_BATCH) {
    const ids = userIds.slice(i, i + AGG_BATCH)
    try {
      const r = await db.collection(MATCHES_COL)
        .where(_.or([
          { userA: OPENID, userB: _.in(ids), status: 'done' },
          { userA: _.in(ids), userB: OPENID, status: 'done' }
        ]))
        .field({ userA: true, userB: true, lastTacit: true })
        .get()
      ;(r.data || []).forEach(m => {
        const other = m.userA === OPENID ? m.userB : m.userA
        if (!stats[other]) stats[other] = { count: 0, tacit: 0 }
        stats[other].count++
        stats[other].tacit += m.lastTacit || 0
      })
    } catch (e) {
      // 该批查询失败时保持为无历史对局，不阻断整体推荐
    }
  }
  return stats
}

async function recommend({ limit = 10 } = {}, OPENID) {
  if (!OPENID) return { code: 401, message: '未登录' }
  const meRes = await db.collection(USERS_COL).where({ openid: OPENID }).get()
  const me = (meRes.data && meRes.data[0]) || {}
  const blocked = await getBlockedIds(OPENID)
  const matched = await getMatchedOpenids(OPENID)

  // 冷启期：拉取候选用户（排除自己/已拉黑/已匹配），客户端排序取前 N
  let candidates = []
  try {
    const r = await db.collection(USERS_COL)
      .where({ openid: _.neq(OPENID) })
      .field({ openid: true, nickname: true, avatarUrl: true, gender: true, age: true, city: true, interestTags: true, mbti: true })
      .limit(100)
      .get()
    candidates = r.data || []
  } catch (e) {
    const msg = (e && e.message) || String(e)
    if (/not exist|does not exist|no such collection/i.test(msg)) {
      return { code: 500, message: '数据库集合未创建：请在 CloudBase 控制台（与云函数同一环境）创建 users / matches 集合' }
    }
    return { code: -1, message: '查询失败：' + msg }
  }

  let list = candidates
    .filter(u => u.openid && !blocked.includes(u.openid) && !matched.has(u.openid))
    .map(u => {
      const s = scoreCandidate(me, u)
      return {
        userId: u.openid,
        nickname: u.nickname || '匿名',
        avatarUrl: u.avatarUrl || '',
        gender: u.gender || '',
        age: u.age || '',
        city: u.city || '',
        interestTags: u.interestTags || [],
        mbti: u.mbti || '',
        sharedTags: s.sharedTags,
        mbtiFit: s.mbtiFit,
        score: s.score
      }
    })

  // 叠加游戏默契度：按用户对汇总所有 status=done 的 matches 的默契轮数，作为契合度的累加项。
  // 这样玩过的人会在"资料分"原有基础上随游戏次数/默契题数持续增长（契合"多次游戏增默契度"的设定）。
  // 仅读 done 匹配；active 匹配已被上方 matched 排除（进行中的对局不计入）。
  // 一次批量聚合取代逐候选查询，再叠加到契合度上
  const doneStats = await aggregateDoneStats(OPENID, list.map(c => c.userId))
  list = list.map(c => {
    const s = doneStats[c.userId] || { count: 0, tacit: 0 }
    return {
      ...c,
      gameCount: s.count,
      gameTacit: s.tacit,
      score: c.score + s.tacit * TACIT_WEIGHT
    }
  })

  // 叠加游戏契合度后，按最终契合度（资料分 + 游戏分）重新排序并截断
  list = list.sort((a, b) => b.score - a.score).slice(0, Math.max(1, limit))

  return { code: 0, data: { candidates: list } }
}

async function accept({ candidateId } = {}, OPENID) {
  if (!OPENID) return { code: 401, message: '未登录' }
  if (!candidateId) return { code: 400, message: '缺少 candidateId' }
  if (candidateId === OPENID) return { code: 400, message: '不能和自己匹配' }

  const cRes = await db.collection(USERS_COL).where({ openid: candidateId }).get()
  if (!cRes.data || !cRes.data[0]) return { code: 404, message: '候选用户不存在' }

  // 避免重复 active/pending 匹配
  const existing = await db.collection(MATCHES_COL)
    .where(_.or([{ userA: OPENID, userB: candidateId }, { userA: candidateId, userB: OPENID }]))
    .get()
  const active = (existing.data || []).find(m => m.status === 'active' || m.status === 'pending')
  if (active) return { code: 409, message: '已存在匹配', data: { matchId: active._id } }

  // 计算分（存入匹配，便于后续排序/解释）
  const meRes = await db.collection(USERS_COL).where({ openid: OPENID }).get()
  const me = (meRes.data && meRes.data[0]) || {}
  const score = scoreCandidate(me, cRes.data[0]).score

  // 创建匹配（A 发起即 active；等待对方加入游戏）
  const matchDoc = { userA: OPENID, userB: candidateId, score, status: 'active', createdAt: Date.now() }
  const mAdd = await db.collection(MATCHES_COL).add({ data: matchDoc })

  // 自动建局（M2.2 前置）：waiting 局，creator=A，invited=B；题目由 game.joinGame 载入
  const gameDoc = {
    type: 'quiz',
    state: 'waiting',
    createdBy: OPENID,
    players: [OPENID],
    invitedUserId: candidateId,
    round: 0,
    totalRounds: 0,
    questions: [],
    answers: {},          // { [round]: { [openid]: optionIndex } }
    roundResults: [],     // [{ round, tacit: bool }]
    tacitCount: 0,
    createdAt: Date.now()
  }
  const gAdd = await db.collection(GAMES_COL).add({ data: gameDoc })

  return { code: 0, data: { matchId: mAdd._id, gameId: gAdd._id } }
}

// B 侧：待接受的对局邀请
async function myPending({}, OPENID) {
  if (!OPENID) return { code: 401, message: '未登录' }
  let list = []
  try {
    const r = await db.collection(GAMES_COL)
      .where({ invitedUserId: OPENID, state: 'waiting' })
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get()
    list = r.data || []
  } catch (e) {
    const msg = (e && e.message) || String(e)
    if (/not exist|does not exist|no such collection/i.test(msg)) {
      return { code: 500, message: '数据库集合未创建：请在 CloudBase 控制台（与云函数同一环境）创建 games 集合' }
    }
    return { code: -1, message: '查询失败：' + msg }
  }
  const withInfo = await Promise.all(list.map(async g => {
    let creator = { nickname: '', avatarUrl: '' }
    try {
      const u = await db.collection(USERS_COL).where({ openid: g.createdBy }).get()
      if (u.data && u.data[0]) creator = { nickname: u.data[0].nickname || '', avatarUrl: u.data[0].avatarUrl || '' }
    } catch (e) {}
    return { gameId: g._id, creatorId: g.createdBy, creator, createdAt: g.createdAt }
  }))
  return { code: 0, data: { invites: withInfo } }
}

async function decline({ gameId } = {}, OPENID) {
  if (!gameId) return { code: 400, message: '缺少 gameId' }
  const g = await db.collection(GAMES_COL).doc(gameId).get()
  if (!g.data) return { code: 404, message: '对局不存在' }
  if (g.data.invitedUserId !== OPENID) return { code: 403, message: '无权操作' }
  if (g.data.state !== 'waiting') return { code: 400, message: '对局已不可拒绝' }
  await db.collection(GAMES_COL).doc(gameId).update({ data: { state: 'cancelled' } })
  await db.collection(MATCHES_COL)
    .where({ userA: g.data.createdBy, userB: OPENID, status: 'active' })
    .update({ data: { status: 'cancelled' } })
    .catch(() => {})
  return { code: 0, data: { ok: true } }
}

exports.main = async (event = {}) => {
  const action = event.action
  const OPENID = cloud.getWXContext().OPENID
  try {
    if (action === 'recommend') return await recommend(event, OPENID)
    if (action === 'accept') return await accept(event, OPENID)
    if (action === 'myPending') return await myPending(event, OPENID)
    if (action === 'decline') return await decline(event, OPENID)
    return { code: 404, message: 'unknown action: ' + action }
  } catch (e) {
    const msg = (e && e.message) || 'match error'
    console.error('[match.main] 未捕获异常 action=' + action + ' :', msg)
    if (/not exist|does not exist|no such collection/i.test(msg)) {
      return { code: 500, message: '数据库集合未创建：请在 CloudBase 控制台（与云函数同一环境）创建对应集合' }
    }
    return { code: -1, message: msg }
  }
}
