<template>
  <view class="content">
    <image class="logo" src="/static/logo.png"></image>
    <view class="text-area">
      <text class="title">{{ title }}</text>
    </view>
    <view class="state" v-if="openid">
      <text class="state-ok">已登录</text>
      <text class="openid">{{ openid }}</text>
      <text class="link" @click="goProfile">去完善资料 ›</text>
      <text class="link" v-if="features.community" @click="goCommunity">去社区 ›</text>
      <text class="link" @click="goMatch">去匹配破冰 ›</text>
      <text class="link" @click="goRelation">我的关系 ›</text>
      <text class="link" @click="goSettings">设置 ›</text>
    </view>
    <view class="state" v-else>
      <text class="state-no">未登录</text>
      <text class="link" @click="goLogin">去登录 ›</text>
    </view>
    <tab-bar current=""></tab-bar>
  </view>
</template>

<script>
import { getOpenid } from '../../utils/storage'
import { FEATURES } from '../../utils/config'
import tabBar from '../../components/tab-bar.vue'

export default {
  components: { tabBar },
  data() {
    return {
      title: '恋爱成长',
      openid: '',
      features: FEATURES
    }
  },
  onShow() {
    this.openid = getOpenid()
  },
  methods: {
    goProfile() {
      uni.navigateTo({ url: '/pages/profile/profile' })
    },
    goCommunity() {
      uni.navigateTo({ url: '/pages/community/community' })
    },
    goMatch() {
      uni.navigateTo({ url: '/pages/match/match' })
    },
    // M3.5：F7 关系成长主页（复用 pairs，展示阶段/里程碑与聊天、联系方式入口）
    goRelation() {
      uni.navigateTo({ url: '/pages/relation/relation' })
    },
    goSettings() {
      uni.navigateTo({ url: '/pages/settings/settings' })
    },
    goLogin() {
      uni.reLaunch({ url: '/pages/login/login' })
    }
  },
}
</script>

<style>
.content {
  min-height: 100vh; background: var(--grad-soft, linear-gradient(180deg, #FFF1F4, #FFFAFB));
  display: flex; flex-direction: column; align-items: center;
  padding: 140rpx 40rpx 180rpx; box-sizing: border-box;
}
.logo {
  width: 180rpx; height: 180rpx; border-radius: 40rpx;
  box-shadow: var(--shadow, 0 8rpx 24rpx rgba(244,63,106,.10)); margin-bottom: 24rpx;
}
.text-area { margin-bottom: 16rpx; }
.title { font-size: 48rpx; font-weight: 700; color: var(--brand-600, #E11D54); font-family: var(--font-display); }
.state { display: flex; flex-direction: column; align-items: stretch; width: 100%; max-width: 560rpx; margin-top: 56rpx; }
.state-ok { font-size: 28rpx; color: var(--success, #16A34A); text-align: center; margin-bottom: 8rpx; }
.state-no { font-size: 28rpx; color: var(--ink-500, #7A7280); text-align: center; margin-bottom: 8rpx; }
.openid {
  font-size: 22rpx; color: var(--ink-400, #A89FA8);
  margin: 8rpx 0 24rpx; word-break: break-all; text-align: center;
}
.link {
  margin-top: 20rpx; font-size: 28rpx; color: #fff; font-weight: 600;
  background: var(--grad-primary, linear-gradient(135deg, #FF8A65, #F43F6A));
  text-align: center; padding: 24rpx; border-radius: 999rpx;
  box-shadow: var(--shadow-glow, 0 8rpx 24rpx rgba(244,63,106,.3));
  transition: transform .12s ease;
}
.link:active { transform: scale(.97); }
</style>
