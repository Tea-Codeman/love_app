<template>
  <view class="relation">
    <view class="topbar">
      <text class="title">我的关系</text>
      <text class="sub">一起玩得越多，成长值越高，解锁的互动也越多</text>
    </view>

    <view class="empty" v-if="!loading && pairs.length === 0">还没有开始的关系，去匹配页约人一起玩吧 ›</view>
    <view class="loading" v-if="loading">加载中…</view>

    <view class="rel-card" v-for="p in pairs" :key="p._id">
      <image class="avatar" :src="p.peer.avatarUrl || '/static/logo.png'" mode="aspectFill"></image>
      <view class="rel-meta">
        <view class="name-row">
          <text class="nickname">{{ p.peer.nickname || '未知用户' }}</text>
          <text class="stage">{{ stageLabel(p.growthValue) }}</text>
        </view>
        <text class="stat" v-if="p.gameCount > 0">已玩 {{ p.gameCount }} 局 · 默契 {{ p.tacitTotal || 0 }} 题</text>
        <text class="stat" v-else>还没一起玩过</text>
        <growth-bar :growth-value="p.growthValue"></growth-bar>
        <view class="chips" v-if="(p.milestones || []).length">
          <text class="chip" v-for="m in p.milestones" :key="m">{{ m }}</text>
        </view>
      </view>
      <view class="rel-actions">
        <text class="btn play" @click="onPlay(p)">一起玩</text>
        <text class="btn chat" v-if="reached(stageOf(p.growthValue), 'S1')" @click="onChat(p)">聊聊</text>
        <text class="btn contact" v-if="reached(stageOf(p.growthValue), 'S4')" @click="onContact(p)">联系方式</text>
      </view>
    </view>
  </view>
</template>

<script>
import { callFunction } from '../../utils/request'
import { getOpenid } from '../../utils/storage'
import growthBar from '../../components/growth-bar.vue'
import { stageOf, stageInfo, reached } from '../../utils/growth'

export default {
  components: { growthBar },
  data() {
    return {
      openid: '',
      pairs: [],
      loading: false,
      busy: false
    }
  },
  onShow() {
    this.openid = getOpenid()
    if (!this.openid) {
      uni.reLaunch({ url: '/pages/login/login' })
      return
    }
    this.load()
  },
  methods: {
    // 模板里直接调用（方法比 computed-per-item 更简单，且 growthValue 已是服务端权威值）
    stageOf,
    reached,
    stageLabel(v) {
      return stageInfo(stageOf(v)).label
    },
    async load() {
      this.loading = true
      const r = await callFunction('growth', { action: 'listPairs' })
      this.loading = false
      if (!r.ok) {
        uni.showToast({ title: r.message || '加载失败', icon: 'none' })
        return
      }
      // 服务端已按 updatedAt 降序 + 补齐 peer 资料，前端直接渲染
      this.pairs = (r.data && r.data.pairs) || []
    },
    async onPlay(p) {
      if (this.busy) return
      this.busy = true
      const r = await callFunction('match', { action: 'accept', candidateId: p.peerId })
      this.busy = false
      if (!r.ok) {
        uni.showToast({ title: r.message || '操作失败', icon: 'none' })
        return
      }
      uni.navigateTo({ url: '/pages/game/game?gameId=' + r.data.gameId })
    },
    onChat(p) {
      uni.navigateTo({
        url: '/pages/chat/chat?peerId=' + p.peerId + '&nickname=' + encodeURIComponent(p.peer.nickname || 'TA')
      })
    },
    onContact(p) {
      uni.navigateTo({
        url: '/pages/contact/contact?peerId=' + p.peerId + '&nickname=' + encodeURIComponent(p.peer.nickname || 'TA')
      })
    }
  }
}
</script>

<style>
.relation { min-height: 100vh; background: #FFF7F8; padding-bottom: 40rpx; }
.topbar { padding: 24rpx 32rpx 8rpx; }
.title { font-size: 38rpx; font-weight: 700; color: #FF6B81; display: block; }
.sub { font-size: 24rpx; color: #999; margin-top: 6rpx; display: block; }
.rel-card {
  display: flex;
  align-items: flex-start;
  background: #fff;
  border-radius: 20rpx;
  padding: 24rpx;
  margin: 20rpx 24rpx;
  box-shadow: 0 4rpx 16rpx rgba(255, 107, 129, 0.08);
}
.avatar { width: 96rpx; height: 96rpx; border-radius: 50%; background: #eee; flex-shrink: 0; }
.rel-meta { flex: 1; margin-left: 20rpx; display: flex; flex-direction: column; }
.name-row { display: flex; align-items: baseline; justify-content: space-between; }
.nickname { font-size: 30rpx; color: #333; font-weight: 600; }
.stage { font-size: 22rpx; color: #FF6B81; }
.stat { font-size: 22rpx; color: #999; margin-top: 6rpx; }
.chips { margin-top: 10rpx; }
.chip {
  font-size: 20rpx;
  color: #FF9F43;
  background: #fff5e9;
  padding: 4rpx 14rpx;
  border-radius: 20rpx;
  margin-right: 10rpx;
}
.rel-actions { display: flex; flex-direction: column; flex-shrink: 0; margin-left: 16rpx; }
.btn {
  font-size: 24rpx;
  color: #fff;
  background: #FF6B81;
  padding: 12rpx 24rpx;
  border-radius: 26rpx;
  text-align: center;
  margin-bottom: 12rpx;
}
.btn.chat { background: #FFB199; }
.btn.contact { background: #7c5cff; }
.empty, .loading { text-align: center; font-size: 26rpx; color: #bbb; padding: 60rpx 0; }
</style>
