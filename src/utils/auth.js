// src/utils/auth.js —— 登录引导（M0.2）
import { callFunction } from './request'
import { getOpenid, setOpenid, setUser } from './storage'

/**
 * 静默登录：调用 auth 云函数，按 openid 写/读 users。
 * 返回 { ok, error?, openid, user }
 */
export async function bootstrapLogin() {
  const res = await callFunction('auth', { action: 'login' })
  if (!res.ok) return { ok: false, error: res.message || '登录失败' }
  const { openid, user } = res.data || {}
  if (openid) setOpenid(openid)
  if (user) setUser(user)
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
