// cloudfunctions/metrics/index.js —— F9 埋点入口（M4.1）
//
// 【定位】本函数**只服务前端上报**（`app_open` / `recommend_view` 这类没有云函数承接的
// 纯客户端事件）。**服务端入桩一律不走这里** —— 调用方在自己的进程内直接 require
// `./metrics-core` 写 events，因为云函数间 `cloud.callFunction` 会丢失 OPENID
// （BUG-1，详见 metrics-core.js 头部与 HANDOFF「盲区防护」第 19 条）。
//
// 动作：track（单条）/ trackBatch（批量，前端攒批）/ dashboard（M4.2 实现）
//
// 铁律（plan-m4.md §1.5 / §7）：**埋点绝不能阻断业务**。
// 本文件任何分支都不抛异常给调用方，一律返回 code=0 + 打日志。

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

exports.main = async (event = {}) => {
  const action = event.action
  const OPENID = cloud.getWXContext().OPENID
  try {
    if (action === 'track') return await track(event, OPENID)
    if (action === 'trackBatch') return await trackBatch(event, OPENID)
    return { code: 404, message: 'unknown action: ' + action }
  } catch (e) {
    // 兜底：埋点异常绝不能冒到调用方
    console.error('[metrics.main] 未捕获异常 action=' + action + ' :', (e && e.message) || e)
    return { code: 0, data: { accepted: false } }
  }
}
