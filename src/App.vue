<script>
import { initCloud } from './utils/cloud'
import { getOpenid, getPrivacyAgreed, setPendingInviter } from './utils/storage'
import { track, flushTrack } from './utils/track'
import { startInviteWatch, stopInviteWatch, inviteRemain } from './utils/confirmInvite'

// 检测到 B 收到新邀请：原生弹窗通知（任意页面盖顶，绕过「必须停在关系页」的限制）
function handleNewInvite(inv) {
  const pages = getCurrentPages()
  const top = pages[pages.length - 1]
  // 已在关系页：页内自定义富弹窗会自己显示，不再叠原生弹窗
  if (top && top.route === 'pages/relation/relation') return
  const name = (inv.peer && inv.peer.nickname) || 'TA'
  uni.showModal({
    title: '💌 在一起确认邀请',
    content: name + ' 想和你确认在一起\n邀请有效期 ' + inviteRemain(inv) + '，超时将自动失效',
    confirmText: '去处理',
    cancelText: '稍后',
    success: (res) => {
      if (res.confirm) uni.navigateTo({ url: '/pages/relation/relation' })
    }
  })
}

export default {
  onLaunch: function (options) {
    console.log('[app] onLaunch')
    initCloud()
    // M4.1：`app_open` —— DAU 的唯一数据源（SC2 留存分母）。
    // 冷启动（onLaunch）与切前台（onShow）各计一次，口径与微信「启动/切前台」一致。
    track('app_open')
    // 邀请裂变（T2）：从分享链接进入时记录邀请人，登录时归因
    if (options && options.query && options.query.inviter) {
      setPendingInviter(options.query.inviter)
    }
    // 隐私门禁：未同意则先走隐私政策（M0.3）
    if (!getPrivacyAgreed()) {
      uni.reLaunch({ url: '/pages/privacy/privacy' })
      return
    }
    // 未登录则走登录（M0.2）
    if (!getOpenid()) {
      uni.reLaunch({ url: '/pages/login/login' })
    }
  },
  onShow: function () {
    console.log('[app] onShow')
    // 切前台也算一次启动（与 onLaunch 合计为 DAU 口径）
    track('app_open')
    // M4.4 全局邀请投递：登录态下启动应用级轮询，B 在任意页面都能收到 A 的确认邀请
    startInviteWatch(handleNewInvite)
  },
  onHide: function () {
    console.log('[app] onHide')
    // 切后台立即发送攒批队列，避免定时器被挂起导致丢数据
    flushTrack()
    // 后台停轮询，避免无谓请求；切前台 onShow 会重启
    stopInviteWatch()
  },
}
</script>

<style>
/* 每个页面公共 css */
</style>
