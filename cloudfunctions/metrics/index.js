// cloudfunctions/metrics/index.js —— F9 埋点入口（M4.1 埋点 + M4.2 看板）
//
// 【定位】本函数**只服务前端上报**（`app_open` / `recommend_view` 这类没有云函数承接的
// 纯客户端事件）。**服务端入桩一律不走这里** —— 调用方在自己的进程内直接 require
// `./metrics-core` 写 events，因为云函数间 `cloud.callFunction` 会丢失 OPENID
// （BUG-1，详见 metrics-core.js 头部与 HANDOFF「盲区防护」第 19 条）。
//
// 动作：track（单条）/ trackBatch（批量，前端攒批）/ dashboard（M4.2 聚合看板）
//
// 铁律（plan-m4.md §1.5 / §7）：**埋点绝不能阻断业务**。
// 本文件任何分支都不抛异常给调用方，一律返回 code=0 + 打日志。
// dashboard 为只读聚合，更不应抛异常。

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const core = require('./metrics-core')
const ctx = { db }

const MAX_BATCH = core.MAX_BATCH

async function track(event = {}, OPENID) {
  // userId 只信 WXContext，绝不信任前端传值（plan-m4.md §5 M4.1）
  const r = await core.track(ctx, {
    openid: OPENID,
    eventName: event.eventName,
    pairId: event.pairId,
    props: event.props
  })
  if (r.code !== 0) console.warn('[metrics.track] 已忽略：', r.message)
  return { code: 0, data: { accepted: r.code === 0 } }
}

async function trackBatch(event = {}, OPENID) {
  const list = Array.isArray(event.events) ? event.events.slice(0, MAX_BATCH) : []
  if (!list.length) return { code: 0, data: { ok: 0, failed: 0 } }
  const r = await core.trackMany(
    ctx,
    list.map((e) => ({
      openid: OPENID,
      eventName: e.eventName,
      pairId: e.pairId,
      props: e.props,
      ts: e.ts
    }))
  )
  return { code: 0, data: { ok: r.ok, failed: r.failed } }
}

// ───────────────────────── M4.2 看板聚合 ─────────────────────────
// 口径严格照搬 plan-m4.md §5，保证数字可复算：
//   SC1：growthValue≥40(S2) 的 pair 数 ÷ 期间产生过 ≥1 次 game_done 的 pair 数，目标 ≥30%
//   SC2：配对日 +7 天当天有任意互动事件(game_done/message_sent)的 pair 数 ÷ 期间 match_accept 的 pair 数，目标 ≥25%
//   SC3：contact_unlocked 去重 pair 数 ÷ 期间 match_accept pair 数，目标 ≥15%
//   SC4：relation_confirmed 的 pair 数 + 人工回访记录（定性证据）
//   SC5：reports 集合直读（M5.3）：24h 内处置（handled/dismissed 且 handledAt-createdAt≤24h）比例，目标 ≥95%
//   漏斗：recommend_view → match_accept → game_join → game_done → chat_unlocked → contact_unlocked

const pct = (x) => (x === null || x === undefined || !isFinite(x)) ? null : Math.round(x * 1000) / 10

// 在 YYYY-MM-DD 上加 n 天（用 UTC 解析避免时区漂移；day 本身是日期串）
function addDays(dayStr, n) {
  const [y, m, d] = dayStr.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + n)
  const p = (x) => String(x).padStart(2, '0')
  return dt.getUTCFullYear() + '-' + p(dt.getUTCMonth() + 1) + '-' + p(dt.getUTCDate())
}

// 拉全量 events（分页，单页上限 1000，设上限保护）
async function fetchAllEvents() {
  const out = []
  const CAP = 5000
  let skip = 0
  while (out.length < CAP) {
    const res = await db.collection(core.EVENTS_COL).limit(1000).skip(skip).get()
    const list = (res && res.data) || []
    for (const x of list) out.push(x)
    if (list.length < 1000) break
    skip += 1000
  }
  return out
}

// SC5（M5.3，plan-m5.md 决策 2）：处置率权威源 = `reports` 集合，非 events 流。
//   24h 处置率 = handledAt-createdAt ≤24h 的 handled 数 ÷ 全部 handled 数（目标 ≥95%）
//   另附 pendingCount（当前待处置数）。不做时间窗口过滤——pendingCount 天然是"现值"，
//   存量 handled 全量纳入才能稳定评估处置时效。
//   与 SC1–SC4（events 流聚合）的口径差异在 _note 中写明。
//   幂等保护在 safety.handleReport 侧（非 pending 直接 alreadyHandled），reports 不会重复计数。
function computeSC5(reports) {
  const handled = reports.filter(r => r.status === 'handled' || r.status === 'dismissed')
  let within24h = 0
  for (const r of handled) {
    if (typeof r.handledAt === 'number' && typeof r.createdAt === 'number' && r.handledAt - r.createdAt <= 24 * 3600 * 1000) {
      within24h++
    }
  }
  return {
    SC5_report_24h: {
      status: handled.length ? 'ok' : 'no_data',
      rate: handled.length ? pct(within24h / handled.length) : null,
      handledCount: handled.length,
      within24h,
      pendingCount: reports.filter(r => r.status === 'pending').length,
      source: 'reports'
    }
  }
}

// 拉全量 reports（分页 + 上限保护，与 fetchAllEvents 同惯例）
async function fetchAllReports() {
  const out = []
  const CAP = 5000
  let skip = 0
  while (out.length < CAP) {
    const res = await db.collection('reports').limit(1000).skip(skip).get()
    const list = (res && res.data) || []
    for (const x of list) out.push(x)
    if (list.length < 1000) break
    skip += 1000
  }
  return out
}

function computeDashboard(events, windowStartDay, reports) {
  const inWindow = (ev) => !windowStartDay || (ev.day || '') >= windowStartDay

  const pairsWithGameDone = new Set()   // 期间有 game_done 的 pair
  const pairsReachedS2 = new Set()      // growthValue≥40 的 pair
  const pairsMatched = new Set()        // 期间 match_accept 的 pair
  const pairsContact = new Set()        // 期间 contact_unlocked 的 pair
  const pairsConfirmed = new Set()      // relation_confirmed 的 pair

  const f = {
    recommend_view: new Set(),  // user 维度，按 userId 计
    match_accept: new Set(),
    game_join: new Set(),
    game_done: new Set(),
    chat_unlocked: new Set(),
    contact_unlocked: new Set()
  }

  const matchDayByPair = {}              // pairId → 最早 match_accept 日
  const interactionDaysByPair = {}       // pairId → Set(有互动事件的 day)

  for (const ev of events) {
    const name = ev.eventName
    const pid = ev.pairId || ''
    const gv = ev.props && typeof ev.props.growthValue === 'number' ? ev.props.growthValue : null

    if (name === 'game_done') {
      if (inWindow(ev)) pairsWithGameDone.add(pid)
      f.game_done.add(pid)
      addDay(pid, ev.day)
    }
    if (gv !== null && gv >= 40 && inWindow(ev)) pairsReachedS2.add(pid)

    if (name === 'match_accept' && inWindow(ev)) {
      pairsMatched.add(pid)
      f.match_accept.add(pid)
      if (!matchDayByPair[pid] || ev.day < matchDayByPair[pid]) matchDayByPair[pid] = ev.day
    }
    if (name === 'contact_unlocked' && inWindow(ev)) {
      pairsContact.add(pid)
      f.contact_unlocked.add(pid)
    }
    if (name === 'relation_confirmed') pairsConfirmed.add(pid)
    if (name === 'game_join') f.game_join.add(pid)
    if (name === 'chat_unlocked') f.chat_unlocked.add(pid)
    if (name === 'recommend_view') f.recommend_view.add(ev.userId)
    if (name === 'message_sent') addDay(pid, ev.day)
  }

  function addDay(pid, day) {
    if (!pid || !day) return
    if (!interactionDaysByPair[pid]) interactionDaysByPair[pid] = new Set()
    interactionDaysByPair[pid].add(day)
  }

  // SC2：配对日 +7 天当天有互动
  let sc2num = 0
  for (const pid of pairsMatched) {
    const md = matchDayByPair[pid]
    if (!md) continue
    const d7 = addDays(md, 7)
    const days = interactionDaysByPair[pid]
    if (days && days.has(d7)) sc2num++
  }

  const sc1 = pairsWithGameDone.size ? pairsReachedS2.size / pairsWithGameDone.size : null
  const sc2 = pairsMatched.size ? sc2num / pairsMatched.size : null
  const sc3 = pairsMatched.size ? pairsContact.size / pairsMatched.size : null

  return {
    windowStartDay: windowStartDay || 'all',
    totalEvents: events.length,
    sc: {
      SC1_stage_s2_rate: pct(sc1),
      SC2_d7_retention: pct(sc2),
      SC3_contact_conv: pct(sc3),
      SC4_relation_confirmed_pairs: pairsConfirmed.size,
      ...computeSC5(reports || [])
    },
    sc_detail: {
      SC1_pairs_reached_S2: pairsReachedS2.size,
      SC1_pairs_with_game_done: pairsWithGameDone.size,
      SC2_pairs_matched: pairsMatched.size,
      SC2_pairs_d7_active: sc2num,
      SC3_pairs_contact: pairsContact.size,
      SC4_pairs_confirmed: pairsConfirmed.size
    },
    funnel: {
      recommend_view_users: f.recommend_view.size,
      match_accept_pairs: f.match_accept.size,
      game_join_pairs: f.game_join.size,
      game_done_pairs: f.game_done.size,
      chat_unlocked_pairs: f.chat_unlocked.size,
      contact_unlocked_pairs: f.contact_unlocked.size
    },
    _note: '口径见 plan-m4.md §5 / plan-m5.md；目标 SC1≥30% / SC2≥25% / SC3≥15% / SC5≥95%。'
      + 'SC1–SC4 从 events 流聚合；SC5 从 reports 集合直读（status/handledAt 为权威事实，避免 events 重复处置坑），不受 days 窗口过滤。'
  }
}

async function dashboard(event = {}) {
  // days：分析窗口（天），默认 30。窗口内 = day >= 今天-窗口+1。
  const days = Number(event.days) > 0 ? Number(event.days) : 30
  const today = core.dayOfCST(Date.now())
  const [y, m, d] = today.split('-').map(Number)
  const start = addDays(today, -(days - 1))
  const windowStartDay = start

  try {
    const events = await fetchAllEvents()
    const reports = await fetchAllReports()
    const result = computeDashboard(events, windowStartDay, reports)
    return { code: 0, data: result }
  } catch (e) {
    console.error('[metrics.dashboard] 聚合失败：', (e && e.message) || e)
    return { code: 0, data: { error: 'dashboard aggregation failed', detail: (e && e.message) || String(e) } }
  }
}

exports.main = async (event = {}) => {
  const action = event.action
  const OPENID = cloud.getWXContext().OPENID
  try {
    if (action === 'track') return await track(event, OPENID)
    if (action === 'trackBatch') return await trackBatch(event, OPENID)
    if (action === 'dashboard') return await dashboard(event)   // 只读聚合，无需 OPENID
    return { code: 404, message: 'unknown action: ' + action }
  } catch (e) {
    // 兜底：埋点异常绝不能冒到调用方
    console.error('[metrics.main] 未捕获异常 action=' + action + ' :', (e && e.message) || e)
    return { code: 0, data: { accepted: false } }
  }
}
