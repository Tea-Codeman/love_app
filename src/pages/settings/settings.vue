<template>
  <view class="settings">
    <view class="section">
      <text class="section-title">黑名单</text>
      <text class="section-desc">拉黑后你们不会再出现在彼此的推荐里</text>

      <view class="block-card" v-for="b in blocks" :key="b.userId">
        <image class="avatar" :src="b.avatarUrl || '/static/logo.png'" mode="aspectFill"></image>
        <view class="meta">
          <text class="nickname" :class="{ muted: b.missing }">{{ b.nickname }}</text>
          <text class="date" v-if="b.createdAt">{{ formatDate(b.createdAt) }}</text>
        </view>
        <text class="btn unblock" @click="onUnblock(b)">解除</text>
      </view>

      <view class="empty" v-if="!loading && blocks.length === 0">还没有拉黑任何人</view>
      <view class="loading" v-if="loading">加载中…</view>
    </view>
  </view>
</template>

<script>
import { callFunction } from '../../utils/request'

export default {
  data() {
    return {
      blocks: [],
      loading: false,
      busy: false
    }
  },
  onShow() {
    this.loadBlocks()
  },
  methods: {
    async loadBlocks() {
      this.loading = true
      const r = await callFunction('safety', { action: 'listBlocks' })
      this.loading = false
      if (r.ok) this.blocks = (r.data && r.data.blocks) || []
      else uni.showToast({ title: r.message || '加载失败', icon: 'none' })
    },
    async onUnblock(b) {
      if (this.busy) return
      const confirmed = await new Promise(resolve => {
        uni.showModal({
          title: '解除拉黑？',
          content: (b.nickname || '该用户') + ' 将重新出现在你的推荐里。',
          confirmText: '解除',
          success: r => resolve(!!r.confirm),
          fail: () => resolve(false)
        })
      })
      if (!confirmed) return
      this.busy = true
      const r = await callFunction('safety', { action: 'unblock', targetId: b.userId })
      this.busy = false
      if (!r.ok) {
        uni.showToast({ title: r.message || '操作失败', icon: 'none' })
        return
      }
      uni.showToast({ title: '已解除', icon: 'none' })
      this.blocks = this.blocks.filter(x => x.userId !== b.userId)
    },
    formatDate(ts) {
      const d = new Date(Number(ts))
      if (isNaN(d.getTime())) return ''
      const p = n => String(n).padStart(2, '0')
      return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate())
    }
  }
}
</script>

<style>
.settings { min-height: 100vh; background: #FFF7F8; padding-bottom: 40rpx; }
.section { margin: 20rpx 24rpx; }
.section-title { font-size: 28rpx; color: #666; font-weight: 600; display: block; margin: 16rpx 4rpx; }
.section-desc { font-size: 22rpx; color: #aaa; display: block; margin: 0 4rpx 16rpx; }
.block-card {
  display: flex;
  align-items: center;
  background: #fff;
  border-radius: 20rpx;
  padding: 24rpx;
  margin-bottom: 18rpx;
  box-shadow: 0 4rpx 16rpx rgba(255, 107, 129, 0.08);
}
.avatar { width: 88rpx; height: 88rpx; border-radius: 50%; background: #eee; flex-shrink: 0; }
.meta { flex: 1; margin-left: 20rpx; display: flex; flex-direction: column; }
.nickname { font-size: 30rpx; color: #333; font-weight: 600; }
.nickname.muted { color: #bbb; font-weight: 400; }
.date { font-size: 22rpx; color: #aaa; margin-top: 6rpx; }
.btn {
  font-size: 26rpx;
  color: #fff;
  background: #FF6B81;
  padding: 14rpx 28rpx;
  border-radius: 30rpx;
  flex-shrink: 0;
}
.btn.unblock { background: #f2f2f2; color: #666; }
.empty, .loading { text-align: center; font-size: 26rpx; color: #bbb; padding: 60rpx 0; }
</style>
