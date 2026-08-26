<template>
  <view class="privacy">
    <view class="card">
      <text class="title">隐私政策</text>
      <scroll-view scroll-y class="body">
        <text class="para">欢迎使用「恋爱成长」。我们非常重视你的隐私。本政策说明我们如何收集、使用与保护你的信息：</text>
        <text class="para">1. 我们仅收集为提供核心功能所必需的最小信息（微信 openid、昵称、头像、基础资料与兴趣标签），不收集与功能无关的敏感信息。</text>
        <text class="para">2. 你的身份以微信 openid 标识，不会向其他用户公开你的微信号等联系方式，除非关系成长达到可解锁阶段（S4）并经由你主动确认。</text>
        <text class="para">3. 你发布的内容（帖子、私聊、游戏互动）会经过微信内容安全审核，违规内容将被拦截或下架。</text>
        <text class="para">4. 你可以随时在资料页修改或撤回已填写的资料；注销相关请求可通过开发者联系方式提交。</text>
        <text class="para">5. 我们采用云开发安全规则与最小权限原则保护你的数据，未经授权不会向第三方提供。</text>
        <text class="para">继续使用即表示你理解并同意上述条款。</text>
      </scroll-view>
      <button class="agree-btn" @click="onAgree">同意并继续</button>
      <text class="decline" @click="onDecline">暂不同意</text>
    </view>
  </view>
</template>

<script>
import { setPrivacyAgreed } from '../../utils/storage'

export default {
  methods: {
    onAgree() {
      setPrivacyAgreed(true)
      uni.reLaunch({ url: '/pages/login/login' })
    },
    onDecline() {
      uni.showToast({ title: '需同意后才能使用', icon: 'none' })
    }
  }
}
</script>

<style>
.privacy { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #FFF7F8; padding: 32rpx; }
.card { width: 100%; background: #fff; border-radius: 24rpx; padding: 40rpx; box-shadow: 0 8rpx 30rpx rgba(255,107,129,0.12); }
.title { font-size: 38rpx; font-weight: 700; color: #FF6B81; display: block; margin-bottom: 24rpx; }
.body { max-height: 620rpx; }
.para { font-size: 26rpx; color: #666; line-height: 1.7; display: block; margin-bottom: 16rpx; }
.agree-btn { margin-top: 32rpx; height: 88rpx; line-height: 88rpx; background: #FF6B81; color: #fff; border-radius: 44rpx; font-size: 32rpx; }
.decline { display: block; text-align: center; margin-top: 20rpx; font-size: 26rpx; color: #999; }
</style>
