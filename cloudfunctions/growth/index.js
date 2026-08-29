// cloudfunctions/growth/index.js —— F5 关系成长累加（M3.1）
// 架构（plan-m3.md §1 已定，不重议）：
//   1. `pairs` 为权威累计源：每对用户一条，pairKey = sorted(openidA, openidB).join('|')
//   2. 成长值只增不减：一律 db.command.inc(正数)，delta<=0 一律拒绝
//   3. 阶段由 growthValue 读时派生（S0–S4），pairs.stage 仅作缓存冗余
//   4. 阈值 12/40/90/150 为初值，M4.3 用 F9 校准
// 动作：getPair（读，不建）/ addGrowth（累加，含 streak）/ listPairs（我的所有关系）
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command
const PAIRS_COL = 'pairs'

// 阶段阈值（降序，首个满足即命中）
const STAGE_THRESHOLDS = [
  { stage: 'S4', min: 150 },
  { stage: 'S3', min: 90 },
  { stage: 'S2', min: 40 },
  { stage: 'S1', min: 12 }
]

// streak：每活跃天 +3，每周（ISO 周）上限 +15
const STREAK_PER_DAY = 3
const STREAK_WEEK_CAP = 15

function pairKeyOf(a, b) {
  return [String(a), String(b)].sort().join('|')
}

function stageOf(growthValue) {
  const v = Number(growthValue) || 0
  for (const t of STAGE_THRESHOLDS) {
    if (v >= t.min) return t.stage
  }
  return 'S0'
}

function dayOf(ts) {
  const d = new Date(Number(ts) || Date.now())
  const p = n => String(n).padStart(2, '0')
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate())
}

// ISO 周标识（周一为一周之始），用于周上限清零
function isoWeekOf(ts) {
  const d = new Date(Number(ts) || Date.now())
  const day = d.getDay() || 7          // 周日=7
  d.setDate(d.getDate() + 4 - day)     // 移到本周周四
  const yearStart = new Date(d.getFullYear(), 0, 1)
  const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7)
  return d.getFullYear() + '-W' + week
}

function withStage(pair) {
  if (!pair) return null
  const gv = Number(pair.growthValue) || 0
  return Object.assign({}, pair, { growthValue: gv, stage: stageOf(gv) })
}

// 取/建 pair（按 pairKey 唯一）。create=false 时不存在则返回 null（读不写）
async function ensurePair(openidA, openidB, create = true) {
  const pairKey = pairKeyOf(openidA, openidB)
  const r = await db.collection(PAIRS_COL).where({ pairKey }).limit(1).get()
  if (r.data && r.data.length) return r.data[0]
  if (!create) return null
  const now = Date.now()
  const doc = {
    pairKey,
    userA: openidA,
    userB: openidB,
    growthValue: 0,
    stage: 'S0',
    firstGameDone: false,
    gameCount: 0,
    tacitTotal: 0,
    lastGameAt: 0,
    lastInteractionAt: 0,
    weekStreakAdded: 0,
    weekKey: '',
    lastStreakDay: '',
    milestones: [],
    createdAt: now,
    updatedAt: now
  }
  const add = await db.collection(PAIRS_COL).add({ data: doc })
  return Object.assign({}, doc, { _id: add._id })
}

// streak 增量：同一天只给一次；换周则清零周计数
function streakDeltaFor(pair, now) {
  const today = dayOf(now)
  if (pair.lastStreakDay === today) return { delta: 0, weekKey: pair.weekKey || isoWeekOf(now), weekStreakAdded: pair.weekStreakAdded || 0, lastStreakDay: today }
  const weekKey = isoWeekOf(now)
  // 换周 -> 周计数归零（weekStreakAdded 是"本周已给的 streak 总量"）
  const carried = pair.weekKey === weekKey ? (Number(pair.weekStreakAdded) || 0) : 0
  const delta = Math.min(STREAK_PER_DAY, Math.max(0, STREAK_WEEK_CAP - carried))
  return { delta, weekKey, weekStreakAdded: carried + delta, lastStreakDay: today }
}

async function getPair({ peerId } = {}, OPENID) {
  if (!peerId) return { code: 400, message: '缺少 peerId' }
  const pair = await ensurePair(OPENID, peerId, false)
  // 读不写：无关系时返回零值 pair，前端按 S0 渲染
  if (!pair) {
    return {
      code: 0,
      data: {
        pair: withStage({
          pairKey: pairKeyOf(OPENID, peerId),
          userA: OPENID,
          userB: peerId,
          growthValue: 0,
          firstGameDone: false,
          gameCount: 0,
          tacitTotal: 0,
          lastGameAt: 0,
          lastInteractionAt: 0,
          milestones: [],
          exists: false
        })
      }
    }
  }
  return { code: 0, data: { pair: withStage(Object.assign({}, pair, { exists: true })) } }
}

async function listPairs({}, OPENID) {
  const mine = await db.collection(PAIRS_COL)
    .where(_.or([{ userA: OPENID }, { userB: OPENID }]))
    .orderBy('updatedAt', 'desc')
    .limit(50)
    .get()
  const rows = (mine.data || []).map(p => withStage(Object.assign({}, p, { exists: true })))

  // 一次性补齐对方资料（昵称/头像/MBTI），避免前端逐条查 users（N+1）。
  // 查不到资料的（已注销等）降级为「未知用户」，不阻断列表。
  const peerIds = [...new Set(rows.map(p => (p.userA === OPENID ? p.userB : p.userA)).filter(Boolean))]
  const profiles = {}
  for (let i = 0; i < peerIds.length; i += 20) {
    const ids = peerIds.slice(i, i + 20)
    try {
      const u = await db.collection('users')
        .where({ openid: _.in(ids) })
        .field({ openid: true, nickname: true, avatarUrl: true, mbti: true })
        .get()
      ;(u.data || []).forEach(x => {
        profiles[x.openid] = { nickname: x.nickname || '', avatarUrl: x.avatarUrl || '', mbti: x.mbti || '' }
      })
    } catch (e) {
      // 该批查不到就保持为空，前端按「未知用户」渲染
    }
  }

  const pairs = rows.map(p => {
    const peerId = p.userA === OPENID ? p.userB : p.userA
    return Object.assign({}, p, {
      peerId,
      peer: profiles[peerId] || { nickname: '未知用户', avatarUrl: '', mbti: '' }
    })
  })
  return { code: 0, data: { pairs } }
}

// 累加成长值（只增不减）+ 顺带结算 streak
async function addGrowth({ peerId, delta, reason, skipStreak } = {}, OPENID) {
  if (!peerId) return { code: 400, message: '缺少 peerId' }
  const d = Number(delta)
  if (!d || d <= 0 || !isFinite(d)) return { code: 400, message: '增量必须为正数（成长值只增不减）' }
  if (d > 100) return { code: 400, message: '单次增量过大（上限 100）' }

  const pair = await ensurePair(OPENID, peerId, true)
  const now = Date.now()

  let total = d
  const set = { lastInteractionAt: now, updatedAt: now }
  if (!skipStreak) {
    const s = streakDeltaFor(pair, now)
    total = d + s.delta
    set.weekKey = s.weekKey
    set.weekStreakAdded = s.weekStreakAdded
    set.lastStreakDay = s.lastStreakDay
  }

  const nextStage = stageOf((Number(pair.growthValue) || 0) + total)
  set.stage = nextStage

  await db.collection(PAIRS_COL).doc(pair._id).update({
    data: { growthValue: _.inc(total), ...set }
  })

  const updated = await db.collection(PAIRS_COL).doc(pair._id).get()
  return {
    code: 0,
    data: {
      pair: withStage(updated.data),
      applied: { base: d, streak: skipStreak ? 0 : total - d, total },
      reason: reason || ''
    }
  }
}

exports.main = async (event = {}) => {
  const action = event.action
  const OPENID = cloud.getWXContext().OPENID
  try {
    if (action === 'getPair') return await getPair(event, OPENID)
    if (action === 'listPairs') return await listPairs(event, OPENID)
    if (action === 'addGrowth') return await addGrowth(event, OPENID)
    return { code: 404, message: 'unknown action: ' + action }
  } catch (e) {
    const msg = (e && e.message) || 'growth error'
    console.error('[growth.main] 未捕获异常 action=' + action + ' :', msg)
    if (/not exist|does not exist|no such collection/i.test(msg)) {
      return { code: 500, message: '数据库集合未创建：请在 CloudBase 控制台（与云函数同一环境）创建 pairs 集合' }
    }
    return { code: -1, message: msg }
  }
}
