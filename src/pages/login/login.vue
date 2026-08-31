<template>
  <view class="login">
    <view class="hero">
      <image class="logo" src="/static/logo.png"></image>
      <text class="app-name">恋爱成长</text>
      <text class="slogan">一起玩，慢慢靠近</text>
    </view>
    <button class="login-btn" :loading="loading" @click="onLogin">微信授权登录</button>
    <text class="tip" v-if="error">{{ error }}</text>
  </view>
</template>

<script>
import { bootstrapLogin } from '../../utils/auth'
import { getOpenid } from '../../utils/storage'

export default {
  data() {
    return { loading: false, error: '' }
  },
  onLoad() {
    if (getOpenid()) {
      uni.reLaunch({ url: '/pages/index/index' })
    }
  },
  methods: {
    async onLogin() {
      this.loading = true
      this.error = ''
      const res = await bootstrapLogin()
      this.loading = false
      if (!res.ok) {
        this.error = res.error || '登录失败'
        return
      }
      uni.reLaunch({ url: '/pages/index/index' })
    }
  }
}
</script>

<style scoped>
.login {
  min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center;
  background: radial-gradient(120% 80% at 50% 0%, #FFE3E9 0%, #FFFAFB 60%);
  position: relative; overflow: hidden;
}
.login::before {
  content: ''; position: absolute; top: -120rpx; right: -80rpx; width: 360rpx; height: 360rpx; border-radius: 50%;
  background: radial-gradient(circle, rgba(255,138,101,.35), transparent 70%);
}
.login::after {
  content: ''; position: absolute; bottom: -140rpx; left: -100rpx; width: 380rpx; height: 380rpx; border-radius: 50%;
  background: radial-gradient(circle, rgba(244,63,106,.22), transparent 70%);
}
.hero { display: flex; flex-direction: column; align-items: center; margin-bottom: 90rpx; position: relative; z-index: 1; }
.logo { width: 200rpx; height: 200rpx; border-radius: 40rpx; box-shadow: var(--shadow-lg, 0 16rpx 40rpx rgba(244,63,106,.16)); }
.app-name { font-size: 48rpx; font-weight: 700; color: var(--brand-600, #E11D54); margin-top: 28rpx; font-family: var(--font-display); }
.slogan { font-size: 26rpx; color: var(--ink-500, #7A7280); margin-top: 12rpx; }
.login-btn {
  position: relative; z-index: 1;
  width: 560rpx; height: 92rpx; line-height: 92rpx;
  background: var(--grad-primary, linear-gradient(135deg, #FF8A65, #F43F6A));
  color: #fff; border-radius: 46rpx; font-size: 32rpx; font-weight: 600;
  box-shadow: var(--shadow-glow, 0 8rpx 24rpx rgba(244,63,106,.35));
  transition: transform .12s ease, opacity .2s ease;
}
.login-btn:active { transform: scale(.96); opacity: .94; }
.tip { position: relative; z-index: 1; margin-top: 24rpx; font-size: 24rpx; color: var(--danger, #EF4444); }
</style>
