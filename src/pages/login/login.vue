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

<style>
.login { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #FFF7F8; }
.hero { display: flex; flex-direction: column; align-items: center; margin-bottom: 80rpx; }
.logo { width: 200rpx; height: 200rpx; border-radius: 32rpx; }
.app-name { font-size: 44rpx; font-weight: 700; color: #FF6B81; margin-top: 24rpx; }
.slogan { font-size: 26rpx; color: #b0a0a4; margin-top: 12rpx; }
.login-btn { width: 560rpx; height: 88rpx; line-height: 88rpx; background: #FF6B81; color: #fff; border-radius: 44rpx; font-size: 32rpx; }
.tip { margin-top: 24rpx; font-size: 24rpx; color: #e74c3c; }
</style>
