// src/utils/request.js —— 云函数调用封装（M0.2）
import { initCloud } from './cloud'

let cloudReady = false
function ensureCloud() {
  if (!cloudReady) cloudReady = initCloud()
  return cloudReady
}

/**
 * 调用云函数
 * @param {string} name 云函数名
 * @param {object} data 入参
 * @returns {Promise<{ok:boolean, code:number, message?:string, data?:any}>}
 */
export async function callFunction(name, data = {}) {
  ensureCloud()
  try {
    const res = await wx.cloud.callFunction({ name, data })
    const result = res && res.result
    if (!result) return { ok: false, code: -2, message: '云函数空返回' }
    if (result.code !== 0 && result.code !== undefined) {
      return { ok: false, code: result.code, message: result.message || '业务错误', data: result.data }
    }
    return { ok: true, code: 0, data: result.data }
  } catch (e) {
    return { ok: false, code: -1, message: (e && e.errMsg) || (e && e.message) || '网络错误' }
  }
}
