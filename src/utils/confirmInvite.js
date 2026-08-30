// src/utils/confirmInvite.js —— 关系确认邀请「全局投递」中心（修复 M4.4 收不到弹窗）
//
// 【根因】原实现把邀请轮询挂在 relation.vue 的 onShow 里，B 不在关系页时轮询被 onHide
// 停掉，导致 A 发邀请 B 收不到。本文件把轮询提升到**应用级**（App.vue onShow 启动 / onHide 停止），
// 这样 B 在 App 内任意页面都能收到邀请：检测到新邀请时用 uni.showModal 原生弹窗通知（任意页面盖顶），
// 点「去处理」跳关系页用富弹窗操作；关系页内仍用带倒计时的自定义弹窗。
//
// 用 vue 的 reactive 单例做跨页面共享状态（项目无 Pinia/Vuex，App.vue 模板在小程序端不渲染，
// 故通知走原生 showModal 而非 App 模板组件）。

import { reactive } from 'vue'
import { callFunction } from './request'
import { getOpenid } from './storage'

export const inviteState = reactive({
  openid: '',
  pairs: [],
  nowTs: Date.now(),
  // 已弹过原生通知的邀请 key，避免每 4s 重复弹
  notifiedKey: ''
})

// 邀请剩余时间文案（基于 inviteState.nowTs，每秒 tick 重算）
export function inviteRemain(p) {
  const i = p && p.confirmInvite
  if (!i) return ''
  const s = Math.max(0, Math.ceil((Number(i.expiresAt) - inviteState.nowTs) / 1000))
  const m = Math.floor(s / 60)
  const ss = s % 60
  return m > 0 ? (m + '分' + (ss < 10 ? '0' : '') + ss + '秒') : (ss + '秒')
}

// 我收到的（对方发起、仍有效）—— 供关系页富弹窗与全局通知共用
export function currentReceived() {
  return (inviteState.pairs || []).find(p => {
    const i = p.confirmInvite
    return i && i.from && i.from !== inviteState.openid && Number(i.expiresAt) > inviteState.nowTs
  }) || null
}

// 我发起的、仍有效
export function isMyInvite(p) {
  const i = p && p.confirmInvite
  return !!(i && i.from && i.from === inviteState.openid && Number(i.expiresAt) > inviteState.nowTs)
}

// 任意有效邀请（用于「可发起」按钮的禁用判断）
export function isInviteActive(p) {
  const i = p && p.confirmInvite
  return !!(i && i.from && i.expiresAt && Number(i.expiresAt) > inviteState.nowTs)
}

function invKey(p) {
  const i = p.confirmInvite
  return (p.pairKey || p._id) + '|' + (i && i.expiresAt)
}

// 拉一次关系列表（顺带自恢复 openid：登录后首次轮询即可接管）
async function refresh() {
  inviteState.nowTs = Date.now()
  const oid = getOpenid()
  if (oid) inviteState.openid = oid
  if (!inviteState.openid) return
  try {
    const r = await callFunction('growth', { action: 'listPairs' })
    if (r.ok && r.data && r.data.pairs) inviteState.pairs = r.data.pairs
  } catch (e) {
    // 网络抖动不阻断：下一轮继续
  }
}

let timer = null
let tick = null

// 应用级常驻轮询：4s 拉列表（驱动邀请状态同步）+ 1s tick（仅驱动倒计时显示）
export function startInviteWatch(onNewInvite) {
  stopInviteWatch()
  timer = setInterval(() => {
    refresh().then(() => {
      const inv = currentReceived()
      if (!inv) {
        // 邀请已清空/过期/被处理 → 重置通知锁，未来新邀请可再弹
        inviteState.notifiedKey = ''
        return
      }
      // 同一邀请只原生通知一次；关系页内的富弹窗由 currentReceived() 直接驱动，不在此去重
      if (inviteState.notifiedKey !== invKey(inv)) {
        inviteState.notifiedKey = invKey(inv)
        if (onNewInvite) onNewInvite(inv)
      }
    })
  }, 4000)
  tick = setInterval(() => { inviteState.nowTs = Date.now() }, 1000)
}

export function stopInviteWatch() {
  if (timer) { clearInterval(timer); timer = null }
  if (tick) { clearInterval(tick); tick = null }
}

// 页面级手动刷新（onShow 立即拉一次，不等首个 4s 轮询）
export function refreshInvites() {
  return refresh()
}

export function sendConfirmInvite(peerId) {
  return callFunction('growth', { action: 'sendConfirmInvite', peerId })
}
export function acceptConfirmInvite(peerId) {
  return callFunction('growth', { action: 'acceptConfirmInvite', peerId })
}
export function rejectConfirmInvite(peerId) {
  return callFunction('growth', { action: 'rejectConfirmInvite', peerId })
}
export function cancelConfirmInvite(peerId) {
  return callFunction('growth', { action: 'cancelConfirmInvite', peerId })
}
