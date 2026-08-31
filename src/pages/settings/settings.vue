<template>
  <view class="settings">
    <view class="section" v-if="isAdmin">
      <text class="section-title">管理</text>
      <text class="section-desc">管理员专属：处置用户举报</text>
      <view class="row" @click="goAdmin">
        <text class="row-label">管理后台</text>
        <text class="arrow">›</text>
      </view>
    </view>

    <view class="section">
      <text class="section-title">在线状态</text>
      <text class="section-desc">选择「离线」后，你不会出现在他人的推荐里</text>
      <view class="row">
        <text class="row-label">当前在线</text>
        <switch :checked="online" @change="onToggleOnline" color="#F43F6A" />
      </view>
    </view>

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
    <tab-bar current="profile"></tab-bar>
  </view>
</template>

<script>
import { callFunction } from '../../utils/request'
import { isCurrentUserAdmin } from '../../utils/admin'
import tabBar from '../../components/tab-bar.vue'

export default {
  components: { tabBar },
  data() {
    return {
      blocks: [],
      loading: false,
      busy: false,
      isAdmin: false,
      online: true
    }
  },
  onShow() {
    this.loadBlocks()
    this.loadAdmin()
    this.loadOnline()
  },
  methods: {
    async loadAdmin() {
      this.isAdmin = await isCurrentUserAdmin()
    },
    goAdmin() {
      uni.navigateTo({ url: '/pages/admin/reports' })
    },
    // 读取当前在线状态（存量未设 online 字段的用户按在线处理）
    async loadOnline() {
      const r = await callFunction('auth', { action: 'getProfile' })
      if (r.ok && r.data && r.data.user) this.online = r.data.user.online !== false
    },
    // 手动切换在线/离线，失败回滚
    async onToggleOnline(e) {
      const v = !!e.detail.value
      this.online = v
      const r = await callFunction('auth', { action: 'setOnline', online: v })
      if (!r.ok) {
        this.online = !v
        uni.showToast({ title: r.message || '设置失败', icon: 'none' })
      }
    },
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

<style scoped>
.settings { min-height: 100vh; background: var(--bg, #FFFAFB); padding-bottom: 180rpx; }
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
  box-shadow: var(--shadow, 0 8rpx 24rpx rgba(244,63,106,.10));
}
.avatar { width: 88rpx; height: 88rpx; border-radius: 50%; background: #eee; flex-shrink: 0; }
.meta { flex: 1; margin-left: 20rpx; display: flex; flex-direction: column; }
.nickname { font-size: 30rpx; color: #333; font-weight: 600; }
.nickname.muted { color: #bbb; font-weight: 400; }
.date { font-size: 22rpx; color: #aaa; margin-top: 6rpx; }
.btn {
  font-size: 26rpx;
  color: #fff;
  background: var(--brand-500, #F43F6A);
  padding: 14rpx 28rpx;
  border-radius: 30rpx;
  flex-shrink: 0;
}
.btn.unblock { background: #f2f2f2; color: #666; }
.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #fff;
  border-radius: 20rpx;
  padding: 28rpx 24rpx;
  margin-bottom: 18rpx;
  box-shadow: var(--shadow, 0 8rpx 24rpx rgba(244,63,106,.10));
}
.row-label { font-size: 30rpx; color: #333; font-weight: 600; }
.arrow { font-size: 36rpx; color: #ccc; }
.empty, .loading { text-align: center; font-size: 26rpx; color: #bbb; padding: 60rpx 0; }
</style>
