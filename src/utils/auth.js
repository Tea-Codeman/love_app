// src/utils/auth.js —— 登录引导（M0.2）
import { callFunction } from './request'
import { getOpenid, setOpenid, setUser, getPendingInviter, clearPendingInviter } from './storage'

/**
 * 静默登录：调用 auth 云函数，按 openid 写/读 users。
 * 若有待归因邀请码（来自分享链接），一并提交，由服务端写入 invitedBy。
 * 返回 { ok, error?, openid, user }
 */
export async function bootstrapLogin() {
  const inviteCode = getPendingInviter()
  const data = { action: 'login' }
  if (inviteCode) data.inviteCode = inviteCode
  const res = await callFunction('auth', data)
  if (!res.ok) return { ok: false, error: res.message || '登录失败' }
  const { openid, user } = res.data || {}
  if (openid) setOpenid(openid)
  if (user) setUser(user)
  if (inviteCode) clearPendingInviter()
  return { ok: true, openid, user }
}

/** 重新拉取最新资料并缓存 */
export async function refreshUser() {
  const res = await callFunction('auth', { action: 'getProfile' })
  if (res.ok && res.data && res.data.user) {
    setUser(res.data.user)
    return res.data.user
  }
  return null
}

export function isLoggedIn() {
  return !!getOpenid()
}
