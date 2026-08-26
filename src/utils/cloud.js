// src/utils/cloud.js —— CloudBase 初始化（M0.1 / F1 依赖）
// 编译到 mp-weixin 后在微信小程序环境内运行，直接使用 wx.cloud（与微信原生一致）。
// M0.1 收尾：已填入 CloudBase 环境 ID（2026-08-26 用户提供，微信开发者工具创建的 PG 内核环境）。
const CLOUD_ENV = 'love-app-server-d2fhg32320d65c12'

let inited = false

/**
 * 初始化 CloudBase（幂等，仅执行一次）
 * @param {string} [env] 环境 ID，缺省用 CLOUD_ENV
 * @returns {boolean} 是否初始化成功
 */
export function initCloud(env = CLOUD_ENV) {
  // #ifdef MP-WEIXIN
  if (inited) return true
  if (!wx.cloud) {
    console.error('[cloud] 当前微信基础库版本过低，不支持云开发，请升级基础库（>= 2.2.3）')
    return false
  }
  wx.cloud.init({ env: env || undefined, traceUser: true })
  inited = true
  return true
  // #endif
  // #ifndef MP-WEIXIN
  return false
  // #endif
}
