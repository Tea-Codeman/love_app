// cloudfunctions/game/index.js —— F4 双人默契问答（回合制弱实时 T1 已决）
// 状态机：waiting → playing → done / cancelled
// 动作：joinGame（受邀方加入→载入题目→playing）/ getGame（校验玩家后返回状态）
//       submitAnswer（存答案，双方都提交则判定默契并自动 advanceRound；正常结束→matches 置 done）/ cancelGame（取消+match 失效）
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
  return { code: 0, data: { game: updated.data } }
}

async function getGame({ gameId } = {}, OPENID) {
  if (!gameId) return { code: 400, message: '缺少 gameId' }
  const g = await db.collection(GAMES_COL).doc(gameId).get()
  if (!g.data) return { code: 404, message: '对局不存在' }
  if (!canView(g.data, OPENID)) return { code: 403, message: '无权查看' }
  return { code: 0, data: { game: g.data } }
}

async function submitAnswer({ gameId, optionIndex } = {}, OPENID) {
  if (!gameId) return { code: 400, message: '缺少 gameId' }
  if (optionIndex === undefined || optionIndex === null) return { code: 400, message: '缺少选项' }

  const g = await db.collection(GAMES_COL).doc(gameId).get()
  if (!g.data) return { code: 404, message: '对局不存在' }
  const game = g.data
  if (game.state !== 'playing') return { code: 400, message: '对局未在进行中' }
  if (!(game.players || []).includes(OPENID)) return { code: 403, message: '你不在该对局' }

  const rk = String(game.round)
  const current = (game.questions || [])[game.round - 1]
  if (!current || optionIndex < 0 || optionIndex >= (current.options || []).length) {
    return { code: 400, message: '选项越界' }
  }

  // 合并答案（read-modify-write，顺序写入安全；人类节奏下并发极低）
  const answers = Object.assign({}, game.answers)
  answers[rk] = Object.assign({}, answers[rk])
  answers[rk][OPENID] = optionIndex

  let { roundResults, tacitCount, round, state } = game
  const ans = answers[rk]
  const bothAnswered = (game.players || []).every(p => ans[p] !== undefined)
  let justCompleted = null
  if (bothAnswered) {
    const tacit = ans[game.players[0]] === ans[game.players[1]]   // 双方选同一项 = 默契
    roundResults = (roundResults || []).concat([{ round: game.round, tacit }])
    if (tacit) tacitCount = (tacitCount || 0) + 1
    round = game.round + 1
    if (round > game.totalRounds) state = 'done'
    justCompleted = { round: game.round, tacit }
  }

  await db.collection(GAMES_COL).doc(gameId).update({
    data: { answers, roundResults, tacitCount, round, state }
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
          lastRounds: game.totalRounds || 0
        }
      })
      .catch(() => {})
  }

  const updated = await db.collection(GAMES_COL).doc(gameId).get()
  return { code: 0, data: { game: updated.data, justCompleted } }
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
