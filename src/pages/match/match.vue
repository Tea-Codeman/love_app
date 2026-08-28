<template>
  <view class="match">
    <view class="topbar">
      <text class="title">匹配破冰</text>
      <text class="sub">找到和你聊得来的人，一起玩个小游戏</text>
    </view>

    <!-- B 侧：待接受的对局邀请 -->
    <view class="section" v-if="invites.length">
      <text class="section-title">有人想和你玩 ›</text>
      <view class="invite-card" v-for="inv in invites" :key="inv.gameId">
        <image class="avatar" :src="inv.creator.avatarUrl || '/static/logo.png'" mode="aspectFill"></image>
        <view class="invite-meta">
          <text class="nickname">{{ inv.creator.nickname || '匿名' }}</text>
          <text class="hint">邀请你一起玩默契问答</text>
        </view>
        <view class="invite-actions">
          <text class="btn accept" @click="onAcceptInvite(inv)">接受</text>
          <text class="btn decline" @click="onDecline(inv)">拒绝</text>
        </view>
      </view>
    </view>

    <!-- A 侧：推荐候选 -->
    <view class="section">
      <text class="section-title">为你推荐</text>
      <view class="cand-card" v-for="c in candidates" :key="c.userId">
        <image class="avatar" :src="c.avatarUrl || '/static/logo.png'" mode="aspectFill"></image>
        <view class="cand-meta">
          <text class="nickname">{{ c.nickname }}</text>
          <text class="info" v-if="c.age || c.city">{{ [c.age ? c.age + '岁' : '', c.city].filter(Boolean).join(' · ') }}</text>
          <view class="tags" v-if="c.sharedTags.length">
            <text class="tag" v-for="t in c.sharedTags" :key="t">#{{ t }}</text>
          </view>
          <text class="score" v-if="c.score > 0">契合度 {{ c.score }}</text>
          <text class="tacit" v-if="c.gameCount > 0">已玩{{ c.gameCount }}局 · 默契{{ c.gameTacit }}题</text>
        </view>
        <text class="btn play" @click="onPlay(c)">一起玩</text>
      </view>
      <view class="empty" v-if="!loading && candidates.length === 0">附近还没有更多单身小伙伴，去社区多聊聊吧 ›</view>
      <view class="loading" v-if="loading">匹配中…</view>
    </view>
  </view>
</template>

<script>
import { callFunction } from '../../utils/request'
import { getOpenid } from '../../utils/storage'

export default {
  data() {
    return {
      openid: '',
      candidates: [],
      invites: [],
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
    this.loadAll()
  },
  methods: {
    async loadAll() {
      await Promise.all([this.loadRecommend(), this.loadPending()])
    },
    async loadRecommend() {
      this.loading = true
      const r = await callFunction('match', { action: 'recommend', limit: 10 })
      this.loading = false
      if (r.ok) this.candidates = (r.data && r.data.candidates) || []
      else if (r.code === 500) uni.showToast({ title: r.message, icon: 'none' })
    },
    async loadPending() {
      const r = await callFunction('match', { action: 'myPending' })
      if (r.ok) this.invites = (r.data && r.data.invites) || []
      else if (r.code === 500) uni.showToast({ title: r.message, icon: 'none' })
    },
    // A 发起：创建匹配 + waiting 局，进入游戏房等待对方
    async onPlay(c) {
      if (this.busy) return
      this.busy = true
      const r = await callFunction('match', { action: 'accept', candidateId: c.userId })
      this.busy = false
      if (!r.ok) {
        uni.showToast({ title: r.message || '操作失败', icon: 'none' })
        return
      }
      uni.navigateTo({ url: '/pages/game/game?gameId=' + r.data.gameId })
    },
    // B 接受邀请：进入游戏房，由 game 页自动 joinGame
    onAcceptInvite(inv) {
      uni.navigateTo({ url: '/pages/game/game?gameId=' + inv.gameId })
    },
    async onDecline(inv) {
      const r = await callFunction('match', { action: 'decline', gameId: inv.gameId })
      if (r.ok) {
        uni.showToast({ title: '已拒绝', icon: 'none' })
        this.invites = this.invites.filter(x => x.gameId !== inv.gameId)
      } else {
        uni.showToast({ title: r.message || '操作失败', icon: 'none' })
      }
    }
  }
}
</script>

<style>
.match { min-height: 100vh; background: #FFF7F8; padding-bottom: 40rpx; }
.topbar { padding: 24rpx 32rpx 8rpx; }
.title { font-size: 38rpx; font-weight: 700; color: #FF6B81; display: block; }
.sub { font-size: 24rpx; color: #999; margin-top: 6rpx; display: block; }
.section { margin: 20rpx 24rpx; }
.section-title { font-size: 28rpx; color: #666; font-weight: 600; display: block; margin: 16rpx 4rpx; }
.cand-card, .invite-card {
  display: flex;
  align-items: center;
  background: #fff;
  border-radius: 20rpx;
  padding: 24rpx;
  margin-bottom: 18rpx;
  box-shadow: 0 4rpx 16rpx rgba(255, 107, 129, 0.08);
}
.avatar { width: 88rpx; height: 88rpx; border-radius: 50%; background: #eee; flex-shrink: 0; }
.cand-meta, .invite-meta { flex: 1; margin-left: 20rpx; display: flex; flex-direction: column; }
.nickname { font-size: 30rpx; color: #333; font-weight: 600; }
.info { font-size: 24rpx; color: #999; margin-top: 4rpx; }
.hint { font-size: 24rpx; color: #999; margin-top: 4rpx; }
.tags { margin-top: 8rpx; }
.tag { font-size: 22rpx; color: #FF6B81; background: #fdeef0; padding: 4rpx 14rpx; border-radius: 20rpx; margin-right: 10rpx; }
.score { font-size: 22rpx; color: #2ecc71; margin-top: 6rpx; }
.tacit { font-size: 20rpx; color: #FF9F43; margin-top: 4rpx; }
.btn {
  font-size: 26rpx;
  color: #fff;
  background: #FF6B81;
  padding: 14rpx 28rpx;
  border-radius: 30rpx;
  flex-shrink: 0;
}
.btn.play { margin-left: 16rpx; }
.invite-actions { display: flex; flex-direction: column; }
.btn.accept { margin-bottom: 12rpx; }
.btn.decline { background: #ddd; color: #666; }
.empty, .loading { text-align: center; font-size: 26rpx; color: #bbb; padding: 60rpx 0; }
</style>
