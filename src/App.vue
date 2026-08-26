<script>
import { initCloud } from './utils/cloud'
import { getOpenid, getPrivacyAgreed, setPendingInviter } from './utils/storage'

export default {
  onLaunch: function (options) {
    console.log('[app] onLaunch')
    initCloud()
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
  },
  onHide: function () {
    console.log('[app] onHide')
  },
}
</script>

<style>
/* 每个页面公共 css */
</style>
