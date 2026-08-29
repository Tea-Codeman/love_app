// cloudfunctions/metrics/metrics-core.js —— F9 埋点共享内核（M4.1，2026-08-30）
//
// 【为什么又是一个共享内核】
// 本文件是 BUG-1 教训的直接产物：云函数 A 用 `cloud.callFunction` 调 B 时，
// B 里的 `cloud.getWXContext().OPENID` 恒为 **undefined**（端用户身份不透传）。
// 埋点是最需要"知道是谁"的场景 —— 如果 `game`/`chat` 跨函数调 `metrics` 上报，
// 每条事件的 `userId` 都会变成 `undefined`，整张 `events` 表直接废掉，且**不报错**。
// → **服务端入桩一律在本进程内直接写 events**，只有前端上报才走 `metrics` 云函数。
// 详见 HANDOFF「盲区防护」第 19 条。
//
// 【部署约束】云函数各自独立打包，无法跨目录 require。
// 本文件必须在每个上报方目录内各存一份同内容副本（当前：game/ chat/ match/ safety/ auth）。
//
// 【维护约定】只编辑 `cloudfunctions/metrics/metrics-core.js`，
// 然后跑 `npm run sync:core` 同步；直接改副本会漂移，下次 sync 会被覆盖。
//
// 依赖倒置：不 require wx-server-sdk，db 由调用方通过 ctx 注入。
//
// 【pairId 的取值：pairKey，而非 pairs._id】（对 plan-m4.md §2 的有意偏差，原因记录在案）
//   规划里写的是 `pairs._id`，但 `game_join` 发生时 pair 通常**还不存在**（pairs 是 game
//   完成时才 ensurePair 建出来的），拿不到 _id。而 pairKey（两个 openid 排序后拼 `|`）
//   在任何时刻都能算出来，且与 pairs 一一对应、可按 pairKey join 回 pairs。
//   → 统一用 pairKey，避免同一个"关系维度"字段在 13 个事件里两种语义。

const EVENTS_COL = 'events'

// 事件白名单（plan-m4.md §4）。**没有消费方的事件一律不上。**
// dim: 'user' = 用户维度（pairId 留空）；'pair' = 关系维度（必须带 pairId）
// props: 允许的 props 键（白名单制，键名不在列表里的一律丢弃，防 PII 混入）
const EVENTS = {
  app_open: { dim: 'user' },
  profile_completed: { dim: 'user' },
  mbti_completed: { dim: 'user', props: ['mbti'] },
  recommend_view: { dim: 'user', props: ['count'] },
  match_accept: { dim: 'pair', props: ['score'] },
  game_join: { dim: 'pair' },
  game_done: { dim: 'pair', props: ['tacitCount', 'rounds'] },
  pair_stage_changed: { dim: 'pair', props: ['from', 'to', 'growthValue'] },
  chat_unlocked: { dim: 'pair', props: ['growthValue'] },
  message_sent: { dim: 'pair', props: ['auditPassed'] },
  contact_unlocked: { dim: 'pair', props: ['growthValue'] },
  relation_confirmed: { dim: 'pair' },
  // 原规划（plan-m4.md §4）列的 props 是 ['targetType', 'reason']，但前端 `reason` 是
  // **自由文本 textarea**（src/pages/community/report.vue:6），属于 UGC，可能含 PII。
  // 隐私红线（§1.6「props 只放 ID/枚举/数值，禁止正文」）优先级更高 → 只留 targetType。
  // SC5 只需要按 targetType 统计举报量与处置率，不需要理由文本。
  report_created: { dim: 'user', props: ['targetType'] }
  // report_handled：需 `safety.handleReport` 处置能力，plan-m4.md 决策 3 已定留到 M5。
  // 未处置就上报会让 SC5 的「24h 处置率」分母虚高，故**暂不入白名单**。
}

// 单条 props 序列化上限（字节）
const MAX_PROPS_BYTES = 1024
// 单批上报条数上限
const MAX_BATCH = 20

// 限流：同一 (userId, eventName) 在窗口期内最多 N 条。
// ⚠️ 这是**进程内内存限流**，冷启动/多实例会重置 —— 目的是挡住前端死循环式的
//    重复上报（如 recommend_view 每帧触发），不是做严格配额。真正的配额在 M4.2
//    看板侧用 events 表去重统计。
const RATE_WINDOW_MS = 60 * 1000
const RATE_MAX_PER_WINDOW = 30
const _rate = new Map()

// 日期（Asia/Shanghai，UTC+8）冗余字段，按天聚合免计算。
// ⚠️ growth-core.js 的 dayOf() 目前仍是 UTC（云函数默认时区），会在 M4 内一并改齐；
//    在此之前本文件的 day 与 pairs.lastStreakDay 可能相差一天，M4.2 看板只按本字段聚合，不受影响。
function dayOfCST(ts) {
  const d = new Date((Number(ts) || Date.now()) + 8 * 3600 * 1000)
  const p = (n) => String(n).padStart(2, '0')
  return d.getUTCFullYear() + '-' + p(d.getUTCMonth() + 1) + '-' + p(d.getUTCDate())
}

// props 清洗：只允许白名单键 + 标量值（string/number/boolean），且总量不超限。
// 任何嵌套对象/数组/正文一律丢弃 —— 隐私红线（plan-m4.md §1.6）。
function sanitizeProps(eventName, raw) {
  const def = EVENTS[eventName]
  const allow = (def && def.props) || []
  if (!allow.length || !raw || typeof raw !== 'object') return {}
  const out = {}
  for (const k of allow) {
    if (!(k in raw)) continue
    const v = raw[k]
    const t = typeof v
    if (t === 'string' || t === 'number' || t === 'boolean') out[k] = v
  }
  try {
    if (JSON.stringify(out).length > MAX_PROPS_BYTES) return {}
  } catch (e) {
    return {}
  }
  return out
}

function rateOk(userId, eventName, now) {
  const key = userId + '|' + eventName
  const hit = _rate.get(key)
  if (!hit || now - hit.start > RATE_WINDOW_MS) {
    _rate.set(key, { start: now, n: 1 })
    return true
  }
  hit.n += 1
  return hit.n <= RATE_MAX_PER_WINDOW
}

/**
 * 上报一条事件。**永不抛异常**（埋点绝不能阻断业务，plan-m4.md §1.5 / §7）。
 *
 * @param {{db: object}} ctx 调用方注入的 { db }
 * @param {object} opts
 * @param {string} opts.openid     触发者 openid —— **必填**。
 *                                 服务端入桩请传 `cloud.getWXContext().OPENID`；
 *                                 缺失直接拒绝（这是 BUG-1 的护栏：宁可丢一条埋点，
 *                                 也绝不写 userId=undefined 的废数据）。
 * @param {string} opts.eventName  必须在 EVENTS 白名单内
 * @param {string} [opts.pairId]   dim='pair' 时必填
 * @param {object} [opts.props]    仅 ID/枚举/数值
 * @param {number} [opts.ts]
 * @returns {Promise<{code:number, message?:string}>} 0=已入库；非 0=已拒绝（调用方无需处理）
 */
async function track(ctx, opts = {}) {
  const { db } = ctx || {}
  const openid = opts.openid
  const eventName = opts.eventName
  if (!db) return { code: -1, message: 'metrics-core: 缺少 db' }
  if (!openid) return { code: 401, message: 'metrics-core: 缺少 openid（禁止写入无主事件）' }
  const def = EVENTS[eventName]
  if (!def) return { code: 400, message: 'metrics-core: 事件名不在白名单: ' + eventName }

  let pairId = opts.pairId || ''
  if (def.dim === 'pair' && !pairId) {
    return { code: 400, message: 'metrics-core: ' + eventName + ' 是关系维度事件，缺少 pairId' }
  }
  if (def.dim === 'user') pairId = ''

  const now = Date.now()
  if (!rateOk(openid, eventName, now)) {
    return { code: 429, message: 'metrics-core: 触发限流' }
  }

  const ts = Number(opts.ts) || now
  const doc = {
    eventName,
    userId: openid,
    pairId,
    props: sanitizeProps(eventName, opts.props),
    ts,
    day: dayOfCST(ts)
  }
  try {
    await db.collection(EVENTS_COL).add({ data: doc })
    return { code: 0 }
  } catch (e) {
    // 写失败只打日志，绝不回抛 —— events 集合权限坏了业务链路也必须全通（§6 验收项）
    console.error('[metrics-core.track] 写入失败 ' + eventName + ' :', (e && e.message) || e)
    return { code: -1, message: (e && e.message) || String(e) }
  }
}

/**
 * 批量上报。**逐条独立 try**，单条失败不影响其余。
 * @returns {Promise<{code:number, ok:number, failed:number}>}
 */
async function trackMany(ctx, list = []) {
  const batch = Array.isArray(list) ? list.slice(0, MAX_BATCH) : []
  let ok = 0
  let failed = 0
  for (const item of batch) {
    try {
      const r = await track(ctx, item)
      if (r.code === 0) ok++
      else failed++
    } catch (e) {
      failed++
    }
  }
  return { code: 0, ok, failed }
}

/**
 * 仅在阶段真的跃迁时才上报 `pair_stage_changed`（SC1 阶段分布的唯一数据源）。
 * 直接吞异常 —— 埋点失败绝不影响成长累加主流程。
 *
 * @param {object} opts.applied  growth-core `addGrowth` 返回的 `applied`（含 stageFrom/stageTo/growthValue）
 * @param {string} opts.pairId   关系标识（本项目统一用 pairKey，见文件头说明）
 */
async function trackIfStageChanged(ctx, opts = {}) {
  try {
    const a = opts.applied
    if (!a || !a.stageFrom || !a.stageTo) return { code: -1, message: '缺少阶段信息' }
    if (a.stageFrom === a.stageTo) return { code: 0 }
    return await track(ctx, {
      openid: opts.openid,
      eventName: 'pair_stage_changed',
      pairId: opts.pairId,
      props: { from: a.stageFrom, to: a.stageTo, growthValue: a.growthValue }
    })
  } catch (e) {
    console.error('[metrics-core.trackIfStageChanged] 异常：', (e && e.message) || e)
    return { code: -1, message: (e && e.message) || String(e) }
  }
}

module.exports = {
  EVENTS_COL,
  EVENTS,
  MAX_PROPS_BYTES,
  MAX_BATCH,
  RATE_WINDOW_MS,
  RATE_MAX_PER_WINDOW,
  dayOfCST,
  sanitizeProps,
  track,
  trackMany,
  trackIfStageChanged
}
