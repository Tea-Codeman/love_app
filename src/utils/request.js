// src/utils/request.js —— 云函数调用封装（M0.2）
import { initCloud } from './cloud'

let cloudReady = false
function ensureCloud() {
  if (!cloudReady) cloudReady = initCloud()
  return cloudReady
}

/**
 * 计时开关：DevTools 复核用。默认关（不影响线上）。
 * 在 DevTools Console 执行一次 wx.setStorageSync('__perf_on', true) 即开启，
 * 之后每次 callFunction 会在 console 打印 `[perf] <name>.<action> = <ms>ms`（客户端往返耗时，即用户体感延迟）。
 * 关闭：wx.setStorageSync('__perf_on', false)
 * 注：小程序 Console 的全局是 wx（uni 仅在业务代码作用域可用），故开关用 wx 读写；
 *     应用运行时优先读 uni、兜底读 wx，二者共享同一底层 storage。
 */
function perfEnabled() {
  try {
    if (typeof uni !== 'undefined' && uni.getStorageSync) return !!uni.getStorageSync('__perf_on')
  } catch (e) {}
  try {
    if (typeof wx !== 'undefined' && wx.getStorageSync) return !!wx.getStorageSync('__perf_on')
  } catch (e) {}
  return false
}

/**
 * 调用云函数
 * @param {string} name 云函数名
 * @param {object} data 入参
 * @returns {Promise<{ok:boolean, code:number, message?:string, data?:any}>}
 */
export async function callFunction(name, data = {}) {
  ensureCloud()
  const enabled = perfEnabled()
  const t0 = enabled ? Date.now() : 0
  try {
    const res = await wx.cloud.callFunction({ name, data })
    if (enabled) {
      const ms = Date.now() - t0
      const action = (data && data.action) || ''
      console.log(`[perf] ${name}${action ? '.' + action : ''} = ${ms}ms`)
    }
    const result = res && res.result
    if (!result) return { ok: false, code: -2, message: '云函数空返回' }
    if (result.code !== 0 && result.code !== undefined) {
      return { ok: false, code: result.code, message: result.message || '业务错误', data: result.data }
    }
    return { ok: true, code: 0, data: result.data }
  } catch (e) {
    if (enabled) {
      const ms = Date.now() - t0
      const action = (data && data.action) || ''
      console.log(`[perf] ${name}${action ? '.' + action : ''} = ${ms}ms (ERROR)`)
    }
    return { ok: false, code: -1, message: (e && e.errMsg) || (e && e.message) || '网络错误' }
  }
}
