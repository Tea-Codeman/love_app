<script>
import { initCloud } from './utils/cloud'
import { getOpenid, getPrivacyAgreed, setPendingInviter } from './utils/storage'
import { track, flushTrack } from './utils/track'

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
  },
  onHide: function () {
    console.log('[app] onHide')
    // 切后台立即发送攒批队列，避免定时器被挂起导致丢数据
    flushTrack()
  },
}
</script>

<style>
/* 每个页面公共 css */
</style>
