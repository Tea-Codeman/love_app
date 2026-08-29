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
  </view>
</template>

<script>
import { getOpenid } from '../../utils/storage'
import { FEATURES } from '../../utils/config'

export default {
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
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: #FFF7F8;
}

.logo {
  height: 200rpx;
  width: 200rpx;
  margin-top: 200rpx;
  margin-left: auto;
  margin-right: auto;
  margin-bottom: 50rpx;
}

.text-area {
  display: flex;
  justify-content: center;
}

.title {
  font-size: 40rpx;
  font-weight: 700;
  color: #FF6B81;
}

.state {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 40rpx;
}

.state-ok { font-size: 30rpx; color: #2ecc71; }
.state-no { font-size: 30rpx; color: #e67e22; }

.openid {
  font-size: 22rpx;
  color: #999;
  margin-top: 12rpx;
  word-break: break-all;
  max-width: 600rpx;
  text-align: center;
}

.link {
  margin-top: 20rpx;
  font-size: 28rpx;
  color: #FF6B81;
}
</style>
