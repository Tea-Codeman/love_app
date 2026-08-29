// cloudfunctions/game/index.js —— F4 双人默契问答（各自独立答题，终局对比 T1 已决）
// 状态机：waiting → playing → done / cancelled
// 动作：joinGame（受邀方加入→载入题目→playing）/ getGame（校验玩家后返回状态）
//       submitAnswer（按"题号+openid"各自独立落盘，互不阻塞；仅当双方都答完全部题才终局对比算默契→matches 置 done）/ cancelGame（取消+match 失效）
// 匹配状态（matches.status）：active（进行中/待加入）→ done（玩完，可再次约）/ cancelled（拒绝或取消）
// 题库：gameQuestions 集合首次为空时自动播种（与 community 种子话题同机制，仅播种数据，不建集合）。
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command
const GAMES_COL = 'games'
const QUESTIONS_COL = 'gameQuestions'
const MATCHES_COL = 'matches'
const ROUNDS_PER_GAME = 5

// M3.1：游戏完成 -> 关系成长（plan-m3.md §4 M3.1）。pairs 为权威累计源，此处原子 upsert。
// 【2026-08-30 BUG-1 修复】成长规则统一走共享内核 ./growth-core.js（与 growth/chat 同源）。
// 此前在这里内联一份，是为了绕开「云函数间不共享代码」的部署约束；现改为同步副本，规则只有一处定义。
// 副作用（有意为之）：旧内联版不结算 streak，与 growth.addGrowth 口径不一致；现在两者完全对齐。
// 改规则请改 cloudfunctions/growth/growth-core.js，再跑 `npm run sync:core` 同步到本目录。
const core = require('./growth-core')
const growthCtx = { db, _ }

// M4.1 F9 埋点：同样走共享内核，在**本进程内**直接写 events。
// ⚠️ 绝不用 cloud.callFunction 调 metrics —— 跨函数调用会丢失 OPENID（BUG-1），
//    每条事件的 userId 都会变成 undefined，整张 events 表直接废掉。
const metrics = require('./metrics-core')
const metricsCtx = { db }

// 游戏结束时累加 pairs：成长值 +8（含 streak）、默契题数累加、局数 +1、首局标记
// 走共享内核，与 growth.addGrowth 完全同源 —— 现在**也会结算 streak**（旧内联版不结算，是 BUG-2 的一部分）
async function upsertPairOnGameDone(userA, userB, tacit) {
  const t = Number(tacit) || 0
  const now = Date.now()
  const res = await core.addGrowth(growthCtx, {
    openid: userA,
    peerId: userB,
    delta: core.GAME_GROWTH,
    reason: '共同完成一局默契问答',
    extraSet: {
      tacitTotal: _.inc(t),
      gameCount: _.inc(1),
      firstGameDone: true,
      lastGameAt: now
    }
  })
  if (res.code !== 0) {
    // 失败不外抛：已结束的对局不应因成长写入失败而报错（调用处另有 catch）
    console.error('[game.upsertPairOnGameDone] 成长累加失败：', res.message)
  }
  return res
}

// 题库种子（v1：双人默契选择题，2-4 选项；correctPairHint 备用，v1 判定用"双方一致即默契"）
const SEED_QUESTIONS = [
  { prompt: '理想的周末怎么过？', options: ['宅家追剧', '户外爬山', '城市漫游', '约朋友聚会'], correctPairHint: '' },
  { prompt: '第一次约会你会选？', options: ['咖啡馆聊天', '看场电影', '公园散步', '吃顿好的'], correctPairHint: '' },
  { prompt: '旅行你更偏向？', options: ['提前规划', '说走就走', '跟团省心', '随遇而安'], correctPairHint: '' },
  { prompt: '闹矛盾了你会？', options: ['立刻沟通', '冷静半天', '写小作文', '撒娇化解'], correctPairHint: '' },
  { prompt: '宠物党站哪边？', options: ['猫派', '狗派', '都想养', '不爱养'], correctPairHint: '' },
  { prompt: '看电影偏好？', options: ['喜剧', '悬疑', '爱情', '科幻'], correctPairHint: '' },
  { prompt: '晚饭吃什么？', options: ['火锅', '日料', '家常菜', '轻食沙拉'], correctPairHint: '' },
  { prompt: '表达心意的方式？', options: ['行动照顾', '言语肯定', '礼物惊喜', '陪伴倾听'], correctPairHint: '' },
  { prompt: '未来想生活在？', options: ['一线打拼', '家乡安稳', '旅居自由', '看情况'], correctPairHint: '' },
  { prompt: '睡前习惯是？', options: ['刷手机', '读会儿书', '运动一下', '准时早睡'], correctPairHint: '' }
]

async function ensureSeedQuestions() {
  const c = await db.collection(QUESTIONS_COL).count()
  if (c.total === 0) {
    await db.collection(QUESTIONS_COL).add({
      data: SEED_QUESTIONS.map(q => ({ ...q, createdAt: Date.now() }))
    })
  }
}

async function pickQuestions(n) {
  await ensureSeedQuestions()
  const r = await db.collection(QUESTIONS_COL).get()
  const all = r.data || []
  const shuffled = all.slice().sort(() => Math.random() - 0.5)
  return shuffled.slice(0, Math.max(1, n)).map(q => ({
    _id: q._id,
    prompt: q.prompt,
    options: q.options
  }))
}

function canView(game, OPENID) {
  return game.createdBy === OPENID || game.invitedUserId === OPENID || (game.players || []).includes(OPENID)
}

async function joinGame({ gameId } = {}, OPENID) {
  if (!gameId) return { code: 400, message: '缺少 gameId' }
  const g = await db.collection(GAMES_COL).doc(gameId).get()
  if (!g.data) return { code: 404, message: '对局不存在' }
  if (g.data.state !== 'waiting') return { code: 400, message: '对局已不可加入' }
  if (g.data.invitedUserId !== OPENID) return { code: 403, message: '仅受邀方可加入' }

  const questions = await pickQuestions(ROUNDS_PER_GAME)
  await db.collection(GAMES_COL).doc(gameId).update({
    data: {
      players: [g.data.createdBy, OPENID],
      state: 'playing',
      round: 1,
      totalRounds: questions.length,
      questions
    }
  })
  const updated = await db.collection(GAMES_COL).doc(gameId).get()

  // M4.1：`game_join`（漏斗：邀请 → 加入的流失点）。埋点失败静默，不影响加入。
  metrics.track(metricsCtx, {
    openid: OPENID,
    eventName: 'game_join',
    pairId: core.pairKeyOf(g.data.createdBy, OPENID)
  }).catch(() => {})

  return { code: 0, data: { game: updated.data } }
}

async function getGame({ gameId } = {}, OPENID) {
  if (!gameId) return { code: 400, message: '缺少 gameId' }
  const g = await db.collection(GAMES_COL).doc(gameId).get()
  if (!g.data) return { code: 404, message: '对局不存在' }
  if (!canView(g.data, OPENID)) return { code: 403, message: '无权查看' }
  return { code: 0, data: { game: g.data } }
}

async function submitAnswer({ gameId, optionIndex, round } = {}, OPENID) {
  if (!gameId) return { code: 400, message: '缺少 gameId' }
  if (optionIndex === undefined || optionIndex === null) return { code: 400, message: '缺少选项' }
  const rkNum = Number(round)
  if (!rkNum || rkNum < 1) return { code: 400, message: '缺少题号' }

  const g = await db.collection(GAMES_COL).doc(gameId).get()
  if (!g.data) return { code: 404, message: '对局不存在' }
  const game = g.data
  if (game.state !== 'playing') return { code: 400, message: '对局未在进行中' }
  if (!(game.players || []).includes(OPENID)) return { code: 403, message: '你不在该对局' }

  const total = game.totalRounds || 0
  if (rkNum > total) return { code: 400, message: '题号越界' }
  const current = (game.questions || [])[rkNum - 1]
  if (!current || optionIndex < 0 || optionIndex >= (current.options || []).length) {
    return { code: 400, message: '选项越界' }
  }

  // 各自独立答题：答案按"题号 + openid"落盘，不依赖回合指针，互不打断。
  const answers = Object.assign({}, game.answers)
  answers[String(rkNum)] = Object.assign({}, answers[String(rkNum)])
  const prev = answers[String(rkNum)][OPENID]
  if (prev !== undefined) {
    // 幂等：重复提交（如网络重试）直接放行；作答不同才报错
    if (prev === optionIndex) {
      const same = await db.collection(GAMES_COL).doc(gameId).get()
      return { code: 0, data: { game: same.data } }
    }
    return { code: 400, message: '本题已作答' }
  }
  answers[String(rkNum)][OPENID] = optionIndex

  const players = game.players || []
  // 双方是否都已答完全部题 —— 只有此时才出结果、对比默契。
  const bothComplete = players.length === 2 && players.every(p => {
    let c = 0
    for (let r = 1; r <= total; r++) {
      if (answers[String(r)] && answers[String(r)][p] !== undefined) c++
    }
    return c === total
  })

  let { state, tacitCount, roundResults } = game
  if (bothComplete) {
    // 终局对比：逐题比较两人答案，答案选同一项即默契。
    const [p0, p1] = players
    let tc = 0
    const rr = []
    for (let r = 1; r <= total; r++) {
      const a0 = answers[String(r)][p0]
      const a1 = answers[String(r)][p1]
      const tacit = a0 === a1
      if (tacit) tc++
      rr.push({ round: r, tacit })
    }
    tacitCount = tc
    roundResults = rr
    state = 'done'
  }

  await db.collection(GAMES_COL).doc(gameId).update({
    data: { answers, state, tacitCount, roundResults }
  })

  // 游戏正常结束：把对应 matches 翻出 active，使双方回到大厅后仍互相可见、可再次约玩。
  // 契合后续"默契度系统"——需多次游戏累积默契度；matches 仅 active/pending 会被推荐过滤。
  // 同时把本局默契结果落盘到 matches，作为后续聚合（按用户对求总默契度）的种子数据。
  if (state === 'done') {
    await db.collection(MATCHES_COL)
      .where(_.or([
        { userA: game.createdBy, userB: game.invitedUserId, status: 'active' },
        { userA: game.invitedUserId, userB: game.createdBy, status: 'active' }
      ]))
      .update({
        data: {
          status: 'done',
          finishedAt: Date.now(),
          lastTacit: tacitCount || 0,
          lastRounds: total
        }
      })
      .catch(() => {})

    // M4.1：`game_done`（成长主引擎 + 漏斗）。埋点失败静默。
    metrics.track(metricsCtx, {
      openid: OPENID,
      eventName: 'game_done',
      pairId: core.pairKeyOf(game.createdBy, game.invitedUserId),
      props: { tacitCount: tacitCount || 0, rounds: total }
    }).catch(() => {})

    // M3.1：同步累加关系成长（pairs 权威源）。失败不阻断游戏主流程（已结束的对局不应因成长写入失败而报错）。
    const growthRes = await upsertPairOnGameDone(game.createdBy, game.invitedUserId, tacitCount || 0)
      .catch(err => {
        console.error('[game.submitAnswer] pairs 累加失败（不影响主流程）:', (err && err.message) || err)
        return null
      })

    // M4.1：`pair_stage_changed`（SC1 阶段分布）。仅阶段真的跃迁时才写，且上报方用
    // 完成对局的两人之一作为 userId（此处取提交最后一题的人 OPENID）。
    if (growthRes && growthRes.code === 0 && growthRes.data && growthRes.data.applied) {
      metrics.trackIfStageChanged(metricsCtx, {
        openid: OPENID,
        pairId: core.pairKeyOf(game.createdBy, game.invitedUserId),
        applied: growthRes.data.applied
      }).catch(() => {})
    }
  }

  const updated = await db.collection(GAMES_COL).doc(gameId).get()
  return { code: 0, data: { game: updated.data } }
}

async function cancelGame({ gameId } = {}, OPENID) {
  if (!gameId) return { code: 400, message: '缺少 gameId' }
  const g = await db.collection(GAMES_COL).doc(gameId).get()
  if (!g.data) return { code: 404, message: '对局不存在' }
  if (!canView(g.data, OPENID)) return { code: 403, message: '无权操作' }
  if (g.data.state === 'done') return { code: 400, message: '对局已结束' }

  await db.collection(GAMES_COL).doc(gameId).update({ data: { state: 'cancelled' } })
  await db.collection(MATCHES_COL)
    .where(_.or([
      { userA: g.data.createdBy, userB: g.data.invitedUserId },
      { userA: g.data.invitedUserId, userB: g.data.createdBy }
    ]))
    .update({ data: { status: 'cancelled' } })
    .catch(() => {})
  return { code: 0, data: { ok: true } }
}

exports.main = async (event = {}) => {
  const action = event.action
  const OPENID = cloud.getWXContext().OPENID
  try {
    if (action === 'joinGame') return await joinGame(event, OPENID)
    if (action === 'getGame') return await getGame(event, OPENID)
    if (action === 'submitAnswer') return await submitAnswer(event, OPENID)
    if (action === 'cancelGame') return await cancelGame(event, OPENID)
    return { code: 404, message: 'unknown action: ' + action }
  } catch (e) {
    const msg = (e && e.message) || 'game error'
    console.error('[game.main] 未捕获异常 action=' + action + ' :', msg)
    if (/not exist|does not exist|no such collection/i.test(msg)) {
      return { code: 500, message: '数据库集合未创建：请在 CloudBase 控制台（与云函数同一环境）创建 games / gameQuestions 集合' }
    }
    return { code: -1, message: msg }
  }
}
