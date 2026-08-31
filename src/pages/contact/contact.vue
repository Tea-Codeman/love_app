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
.contact { min-height: 100vh; background: var(--grad-soft, linear-gradient(180deg, #FFF1F4, #FFFAFB)); padding: 32rpx 24rpx 80rpx; }
.card {
  background: #fff; border: 1rpx solid var(--border, #FBE1E7);
  border-radius: var(--r-lg, 32rpx); padding: 48rpx 32rpx;
  box-shadow: var(--shadow, 0 8rpx 24rpx rgba(244,63,106,.10));
  text-align: center;
}
.qr {
  width: 400rpx; height: 400rpx; margin: 0 auto 20rpx; display: block;
  background: var(--brand-50, #FFF1F4); border-radius: var(--r, 24rpx); padding: 16rpx;
  border: 1rpx solid var(--border, #FBE1E7);
}
.qr-tip { display: block; text-align: center; font-size: 24rpx; color: var(--ink-500, #7A7280); margin-bottom: 24rpx; }
.row { display: flex; align-items: center; margin-top: 16rpx; background: var(--brand-50, #FFF1F4); padding: 20rpx 24rpx; border-radius: var(--r, 24rpx); }
.label { font-size: 26rpx; color: var(--ink-500, #7A7280); width: 120rpx; text-align: left; }
.value { flex: 1; font-size: 30rpx; color: var(--ink-900, #2B2330); font-weight: 600; text-align: left; }
.copy {
  font-size: 24rpx; color: #fff; font-weight: 600;
  background: var(--grad-primary, linear-gradient(135deg, #FF8A65, #F43F6A));
  padding: 12rpx 28rpx; border-radius: 999rpx;
  transition: transform .12s ease;
}
.copy:active { transform: scale(.95); }
.empty-tip { text-align: center; font-size: 26rpx; color: var(--ink-400, #A89FA8); padding: 30rpx 0; }
.locked { text-align: center; }
.locked-title { font-size: 32rpx; color: var(--ink-700, #4A4250); font-weight: 700; display: block; }
.locked-desc { font-size: 24rpx; color: var(--ink-400, #A89FA8); margin-top: 12rpx; display: block; line-height: 1.6; }
.locked-need {
  display: inline-block; margin-top: 20rpx; font-size: 26rpx; font-weight: 700; color: #fff;
  background: var(--grad-primary, linear-gradient(135deg, #FF8A65, #F43F6A));
  padding: 12rpx 28rpx; border-radius: 999rpx;
}
</style>
