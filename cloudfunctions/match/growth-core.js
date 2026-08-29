// cloudfunctions/growth/growth-core.js —— 关系成长共享内核（M3.1，2026-08-30 抽离）
//
// 【为什么必须有这个文件】
// 2026-08-30 真机佐证发现 BUG-1：云函数 A 用 `cloud.callFunction` 调 B 时，
// B 里的 `cloud.getWXContext().OPENID` 恒为 **undefined** —— 端用户身份不会自动透传。
// 原实现里 `chat` 跨函数调 `growth` 累加成长值，结果全部写进了 "<真实openid>|undefined"
// 的幽灵 pair，真实关系一分未得，且主流程不报错（catch 吞异常），极难发现。
// → **结论：成长值累加禁止跨函数调用**，一律由持有端用户身份的函数在本进程内直接写 pairs。
//
// 【部署约束】云函数各自独立打包，无法 `require('../growth/xxx')`。
// 因此本文件必须在每个使用它的函数目录内**各存一份同内容副本**：growth/ game/ chat/。
//
// 【维护约定（务必遵守）】
//   只编辑 `cloudfunctions/growth/growth-core.js`，然后跑 `npm run sync:core` 同步到 game/chat。
//   直接改 game/ 或 chat/ 下的副本会漂移，sync 脚本下次执行会把它覆盖掉。
//
// 依赖倒置：本模块不 require wx-server-sdk，db 与 command 由调用方通过 ctx 注入，
// 便于本地单测与在非云函数环境复用。

const PAIRS_COL = 'pairs'

// 阶段阈值（降序，首个满足即命中）。初值，M4.3 用 F9 校准。
const STAGE_THRESHOLDS = [
  { stage: 'S4', min: 150 },
  { stage: 'S3', min: 90 },
  { stage: 'S2', min: 40 },
  { stage: 'S1', min: 12 }
]

// streak：每活跃天 +3，每周（ISO 周）上限 +15
const STREAK_PER_DAY = 3
const STREAK_WEEK_CAP = 15

// 各事件的成长值增量（唯一定义处，别处一律引用）
const GAME_GROWTH = 8   // 共同完成一局游戏
const CHAT_GROWTH = 2   // 一轮有效互聊

// 单次增量硬上限（防刷）
const MAX_SINGLE_DELTA = 100

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

// 阶段一律读时派生：覆盖掉可能已漂移的 pairs.stage 缓存（BUG-2）
function withStage(pair) {
  if (!pair) return null
  const gv = Number(pair.growthValue) || 0
  return Object.assign({}, pair, { growthValue: gv, stage: stageOf(gv) })
}

function newPairDoc(openidA, openidB, now) {
  return {
    pairKey: pairKeyOf(openidA, openidB),
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
}

// 读 pair（create=false → 不存在返回 null，绝不写库）
async function readPair(ctx, openidA, openidB) {
  const { db } = ctx
  const r = await db.collection(PAIRS_COL)
    .where({ pairKey: pairKeyOf(openidA, openidB) })
    .limit(1)
    .get()
  return (r.data && r.data[0]) || null
}

// 取/建 pair（按 pairKey 唯一）
async function ensurePair(ctx, openidA, openidB) {
  const { db } = ctx
  const existing = await readPair(ctx, openidA, openidB)
  if (existing) return existing
  const doc = newPairDoc(openidA, openidB, Date.now())
  const add = await db.collection(PAIRS_COL).add({ data: doc })
  return Object.assign({}, doc, { _id: add._id })
}

// streak 增量：同一天只给一次；换周则清零周计数
function streakDeltaFor(pair, now) {
  const today = dayOf(now)
  if (pair.lastStreakDay === today) {
    return { delta: 0, weekKey: pair.weekKey || isoWeekOf(now), weekStreakAdded: pair.weekStreakAdded || 0, lastStreakDay: today }
  }
  const weekKey = isoWeekOf(now)
  // 换周 -> 周计数归零（weekStreakAdded 是"本周已给的 streak 总量"）
  const carried = pair.weekKey === weekKey ? (Number(pair.weekStreakAdded) || 0) : 0
  const delta = Math.min(STREAK_PER_DAY, Math.max(0, STREAK_WEEK_CAP - carried))
  return { delta, weekKey, weekStreakAdded: carried + delta, lastStreakDay: today }
}

/**
 * 累加成长值（只增不减）+ 顺带结算 streak。
 *
 * @param {{db: object, _: object}} ctx  调用方注入的 { db, command }
 * @param {object} opts
 * @param {string} opts.openid  端用户 openid —— **必填**。缺失直接 401，
 *                              这是 BUG-1 的护栏：宁可响亮失败，也不再静默写幽灵 pair。
 * @param {string} opts.peerId  对方 openid
 * @param {number} opts.delta   正增量
 * @param {string} [opts.reason]
 * @param {boolean} [opts.skipStreak]
 * @param {object} [opts.extraSet] 额外写入字段（如 game 的 tacitTotal/gameCount 自增）
 * @returns {Promise<{code:number, data?:object, message?:string}>}
 */
async function addGrowth(ctx, opts = {}) {
  const { db, _ } = ctx
  const openid = opts.openid
  const peerId = opts.peerId

  if (!openid) return { code: 401, message: '缺少 openid：成长累加必须在持有端用户身份的进程内执行（禁用跨函数调用）' }
  if (!peerId) return { code: 400, message: '缺少 peerId' }
  if (String(peerId) === 'undefined') return { code: 400, message: 'peerId 非法' }

  const d = Number(opts.delta)
  if (!d || d <= 0 || !isFinite(d)) return { code: 400, message: '增量必须为正数（成长值只增不减）' }
  if (d > MAX_SINGLE_DELTA) return { code: 400, message: '单次增量过大（上限 ' + MAX_SINGLE_DELTA + '）' }

  const pair = await ensurePair(ctx, openid, peerId)
  const now = Date.now()

  const before = Number(pair.growthValue) || 0
  let total = d
  const set = { lastInteractionAt: now, updatedAt: now }
  if (!opts.skipStreak) {
    const s = streakDeltaFor(pair, now)
    total = d + s.delta
    set.weekKey = s.weekKey
    set.weekStreakAdded = s.weekStreakAdded
    set.lastStreakDay = s.lastStreakDay
  }
  const after = before + total
  // stage 仅作缓存冗余写入，方便控制台肉眼查看；**任何读路径都必须用 withStage 重新派生**
  set.stage = stageOf(after)

  if (opts.extraSet) Object.assign(set, opts.extraSet)

  await db.collection(PAIRS_COL).doc(pair._id).update({
    data: { growthValue: _.inc(total), ...set }
  })

  const updated = await db.collection(PAIRS_COL).doc(pair._id).get()
  return {
    code: 0,
    data: {
      pair: withStage(updated.data),
      applied: {
        base: d,
        streak: opts.skipStreak ? 0 : total - d,
        total,
        // M4.1：阶段跃迁前后值，供 `pair_stage_changed` 埋点消费（SC1 阶段分布）。
        // 只有阶段真的变了才应上报 —— 判断交给 metrics-core.trackIfStageChanged。
        stageFrom: stageOf(before),
        stageTo: stageOf(after),
        growthValue: after
      },
      reason: opts.reason || ''
    }
  }
}

module.exports = {
  PAIRS_COL,
  STAGE_THRESHOLDS,
  STREAK_PER_DAY,
  STREAK_WEEK_CAP,
  GAME_GROWTH,
  CHAT_GROWTH,
  MAX_SINGLE_DELTA,
  pairKeyOf,
  stageOf,
  dayOf,
  isoWeekOf,
  withStage,
  newPairDoc,
  streakDeltaFor,
  readPair,
  ensurePair,
  addGrowth
}
