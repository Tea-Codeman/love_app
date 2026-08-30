// src/utils/storage.js —— 本地缓存（openid 不落仓库/明文，仅存客户端本地）
const OPENID_KEY = 'rg_openid'
const USER_KEY = 'rg_user'
const PRIVACY_KEY = 'rg_privacy_agreed'
// O4：隐私政策版本。政策重大变更时提升此号，App.vue 入口比对版本，落后自动重弹门禁（强制重同意）
export const PRIVACY_VERSION = '1.0.0'
const INVITER_KEY = 'rg_pending_inviter'
const MY_INVITE_KEY = 'rg_my_invite_code'

export function getOpenid() {
  try { return uni.getStorageSync(OPENID_KEY) || '' } catch (e) { return '' }
}
export function setOpenid(v) {
  try { uni.setStorageSync(OPENID_KEY, v) } catch (e) {}
}
export function clearOpenid() {
  try { uni.removeStorageSync(OPENID_KEY) } catch (e) {}
}
export function getUser() {
  try { return uni.getStorageSync(USER_KEY) || null } catch (e) { return null }
}
export function setUser(u) {
  try { uni.setStorageSync(USER_KEY, u) } catch (e) {}
}
export function getPrivacyAgreed() {
  // O4：仅当已同意且版本为当前版本才算通过（旧版/未同意 → false，触发重弹）
  try { return uni.getStorageSync(PRIVACY_KEY) === PRIVACY_VERSION } catch (e) { return false }
}
export function getPrivacyAgreedVersion() {
  try { return uni.getStorageSync(PRIVACY_KEY) || '' } catch (e) { return '' }
}
export function setPrivacyAgreed() {
  try { uni.setStorageSync(PRIVACY_KEY, PRIVACY_VERSION) } catch (e) {}
}
export function getPendingInviter() {
  try { return uni.getStorageSync(INVITER_KEY) || '' } catch (e) { return '' }
}
export function setPendingInviter(code) {
  try { uni.setStorageSync(INVITER_KEY, code || '') } catch (e) {}
}
export function clearPendingInviter() {
  try { uni.removeStorageSync(INVITER_KEY) } catch (e) {}
}
export function getMyInviteCode() {
  try { return uni.getStorageSync(MY_INVITE_KEY) || '' } catch (e) { return '' }
}
export function setMyInviteCode(code) {
  try { uni.setStorageSync(MY_INVITE_KEY, code || '') } catch (e) {}
}
