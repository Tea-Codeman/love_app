// src/utils/track.js —— F9 埋点前端封装（M4.1）
//
// 【定位】这里**只负责两个纯客户端事件**：`app_open`、`recommend_view`。
// 其余 11 个事件全部由云函数服务端入桩（plan-m4.md 决策 1）——客户端上报不可信
// （漏报/伪造/版本不一致都会让 SC 结论失真），且服务端入桩能拿到真实的 OPENID。
//
// 【铁律】埋点绝不能阻断业务（plan-m4.md §1.5 / §7）：
//   任何失败一律静默（仅 console.warn），绝不 reject、绝不影响页面流程。
//   上报走 fire-and-forget，业务代码**不要 await track()**。
//
// 【隐私红线】props 只放 ID / 枚举 / 数值；消息正文、微信号、昵称、头像一律不传。
//   服务端 metrics-core 还会再兜一层白名单过滤（双保险）。

import { callFunction } from './request'

// 攒批参数：满 FLUSH_SIZE 条立即发，或每 FLUSH_MS 毫秒发一次（先到先触发）
const FLUSH_SIZE = 10
const FLUSH_MS = 10 * 1000
// 队列上限：埋点卡死时不能让内存无限涨（超出直接丢弃最旧的）
const QUEUE_MAX = 50

let queue = []
let timer = null

function scheduleFlush() {
  if (timer) return
  timer = setTimeout(() => {
    timer = null
    flush()
  }, FLUSH_MS)
}

async function flush() {
  if (!queue.length) return
  const batch = queue
  queue = []
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
  try {
    // 结果不看、失败不管 —— 埋点只管发，成败都不影响业务
    await callFunction('metrics', { action: 'trackBatch', events: batch })
  } catch (e) {
    console.warn('[track] 批量上报失败（已静默）:', (e && e.message) || e)
  }
}

/**
 * 上报一条事件。**不要 await**（fire-and-forget）。
 * @param {string} eventName 必须在服务端 EVENTS 白名单内
 * @param {object} [props]   仅 ID/枚举/数值
 * @param {string} [pairId]  关系维度事件才传
 */
export function track(eventName, props, pairId) {
  try {
    queue.push({ eventName, props: props || {}, pairId: pairId || '', ts: Date.now() })
    if (queue.length > QUEUE_MAX) queue.splice(0, queue.length - QUEUE_MAX)
    if (queue.length >= FLUSH_SIZE) flush()
    else scheduleFlush()
  } catch (e) {
    console.warn('[track] 入队失败（已静默）:', (e && e.message) || e)
  }
}

/** 立即发送队列（页面 onHide / 应用切后台时调用，避免攒批丢数据） */
export function flushTrack() {
  flush()
}

/** 仅用于测试：取当前队列快照 */
export function _queueSnapshot() {
  return queue.slice()
}
