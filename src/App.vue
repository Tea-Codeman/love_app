<script>
import { initCloud } from './utils/cloud'
import { getOpenid, getPrivacyAgreed } from './utils/storage'

export default {
  onLaunch: function () {
    console.log('[app] onLaunch')
    initCloud()
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
