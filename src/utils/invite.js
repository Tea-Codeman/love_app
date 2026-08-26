// src/utils/invite.js —— T2 邀请裂变前端封装（M1.5）
import { callFunction } from './request'
import { getMyInviteCode, setMyInviteCode } from './storage'

// 取当前用户邀请码（本地缓存，避免重复生成）
export async function ensureMyInviteCode() {
  let code = getMyInviteCode()
  if (!code) {
    const r = await callFunction('invite', { action: 'generate' })
    if (r.ok && r.data && r.data.code) {
      code = r.data.code
      setMyInviteCode(code)
    }
  }
  return code
}
