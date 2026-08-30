// src/utils/admin.js —— 管理员身份判定（M6.2）
//
// 设计（plan-m6.md 决策 2-a）：客户端不直接读 admins 集合（服务端私有），
// 统一走 safety.isAdmin 云函数动作判定。结果在会话内缓存，避免每次 onShow 重复请求。
// admins 集合的增删由控制台操作，无需重部署。

import { callFunction } from './request'

// null = 尚未查询；true/false = 已判定。未登录/网络错误不缓存（留 null 以便重试）。
let _adminCache = null

export async function isCurrentUserAdmin() {
  if (_adminCache !== null) return _adminCache
  const r = await callFunction('safety', { action: 'isAdmin' })
  if (r.ok && r.data) {
    _adminCache = !!r.data.isAdmin
    return _adminCache
  }
  // 未登录 / 网络错误：当前按非管理员处理，但不缓存（下次重试）
  return false
}

export function clearAdminCache() {
  _adminCache = null
}
