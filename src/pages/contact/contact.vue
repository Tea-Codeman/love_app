<template>
  <view class="contact">
    <!-- 已解锁：二维码长按识别 + 复制微信号（微信官方无「一键加好友」API，只能双通道） -->
    <view class="card" v-if="unlocked">
      <image class="qr" v-if="wechatQrUrl" :src="wechatQrUrl" mode="aspectFit" show-menu-by-longpress="true"></image>
      <text class="qr-tip" v-if="wechatQrUrl">长按二维码识别添加</text>

      <view class="row" v-if="wechatId">
        <text class="label">微信号</text>
        <text class="value">{{ wechatId }}</text>
        <text class="copy" @click="onCopy">复制</text>
      </view>
      <view class="empty-tip" v-else>对方还没有填写微信号，可以先在轻聊里问 TA ›</view>
    </view>

    <!-- 未解锁：展示还差多少成长值 -->
    <view class="card locked" v-else>
      <text class="locked-title">联系方式还没解锁</text>
      <text class="locked-desc">把成长值提升到 150（S4 心动确认）就能看到对方的微信号</text>
      <text class="locked-need" v-if="needGrowth > 0">还差 {{ needGrowth }} 成长值</text>
    </view>
  </view>
</template>

<script>
import { callFunction } from '../../utils/request'

export default {
  data() {
    return {
      peerId: '',
      nickname: '',
      unlocked: false,
      wechatId: '',
      wechatQrUrl: '',
      needGrowth: 0
    }
  },
  onLoad(options) {
    this.peerId = options.peerId || ''
    this.nickname = options.nickname ? decodeURIComponent(options.nickname) : ''
    if (this.nickname) uni.setNavigationBarTitle({ title: this.nickname + ' 的联系方式' })
  },
  onShow() {
    this.load()
  },
  methods: {
    async load() {
      const r = await callFunction('chat', { action: 'contact', peerId: this.peerId })
      if (!r.ok) {
        // 403 是未达 S4（门禁），按「未解锁」渲染并展示差值，不弹错误
        if (r.code === 403) {
          this.unlocked = false
          this.needGrowth = (r.data && r.data.needGrowth) || 0
          return
        }
        uni.showToast({ title: r.message || '加载失败', icon: 'none' })
        return
      }
      const d = r.data || {}
      this.unlocked = true
      this.wechatId = d.wechatId || ''
      this.wechatQrUrl = d.wechatQrUrl || ''
    },
    onCopy() {
      if (!this.wechatId) return
      uni.setClipboardData({
        data: this.wechatId,
        success: () => uni.showToast({ title: '微信号已复制', icon: 'none' })
      })
    }
  }
}
</script>

<style>
.contact { min-height: 100vh; background: #FFF7F8; padding: 32rpx 24rpx; }
.card {
  background: #fff;
  border-radius: 20rpx;
  padding: 40rpx 32rpx;
  box-shadow: 0 4rpx 16rpx rgba(255, 107, 129, 0.08);
}
.qr { width: 400rpx; height: 400rpx; margin: 0 auto 16rpx; display: block; background: #fafafa; }
.qr-tip { display: block; text-align: center; font-size: 24rpx; color: #999; margin-bottom: 24rpx; }
.row { display: flex; align-items: center; margin-top: 12rpx; }
.label { font-size: 26rpx; color: #999; width: 110rpx; }
.value { flex: 1; font-size: 30rpx; color: #333; font-weight: 600; }
.copy { font-size: 24rpx; color: #fff; background: #FF6B81; padding: 10rpx 26rpx; border-radius: 24rpx; }
.empty-tip { text-align: center; font-size: 26rpx; color: #bbb; padding: 30rpx 0; }
.locked { text-align: center; }
.locked-title { font-size: 32rpx; color: #666; font-weight: 600; display: block; }
.locked-desc { font-size: 24rpx; color: #aaa; margin-top: 12rpx; display: block; }
.locked-need { font-size: 26rpx; color: #FF6B81; margin-top: 20rpx; display: block; }
</style>
