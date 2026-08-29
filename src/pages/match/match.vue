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
      <view class="cand-card" v-for="c in visibleCandidates" :key="c.userId">
        <image class="avatar" :src="c.avatarUrl || '/static/logo.png'" mode="aspectFill"></image>
        <view class="cand-meta">
          <text class="nickname">{{ c.nickname }}</text>
          <text class="info" v-if="c.age || c.city">{{ [c.age ? c.age + '岁' : '', c.city].filter(Boolean).join(' · ') }}</text>
          <text class="mbti" v-if="c.mbti">MBTI {{ c.mbti }}</text>
          <view class="tags" v-if="c.sharedTags.length">
            <text class="tag" v-for="t in c.sharedTags" :key="t">#{{ t }}</text>
          </view>
          <text class="score" v-if="c.score > 0">契合度 {{ c.score }}</text>
          <text class="tacit" v-if="c.gameCount > 0">已玩{{ c.gameCount }}局 · 默契{{ c.gameTacit }}题</text>
          <!-- M3.2：关系成长进度（数据来自 recommend 返回的 pairs.growthValue） -->
          <growth-bar :growth-value="c.growthValue"></growth-bar>
        </view>
        <view class="cand-actions">
          <text class="btn play" @click="onPlay(c)">一起玩</text>
          <!-- M3.3：关系到 S1（成长值 12）解锁轻聊，未解锁时不显示入口 -->
          <text class="btn chat" v-if="canChat(c)" @click="onChat(c)">聊聊</text>
          <!-- M3.4：S4（成长值 150）解锁联系方式 -->
          <text class="btn contact" v-if="canContact(c)" @click="onContact(c)">联系方式</text>
          <text class="btn block" @click="onBlock(c)">拉黑</text>
        </view>
      </view>
      <view class="empty" v-if="!loading && visibleCandidates.length === 0">附近还没有更多小伙伴，晚点再来看看 ›</view>
      <view class="loading" v-if="loading">匹配中…</view>
    </view>
  </view>
</template>

<script>
import { callFunction } from '../../utils/request'
import { getOpenid } from '../../utils/storage'
import growthBar from '../../components/growth-bar.vue'
import { stageOf, reached } from '../../utils/growth'
import { track, flushTrack } from '../../utils/track'

export default {
  components: { growthBar },
  data() {
    return {
      openid: '',
      candidates: [],
      invites: [],
      loading: false,
      busy: false,
      pendingTimer: null,
      recommendTimer: null
    }
  },
  computed: {
    // 已向你发起邀请的人（invites.creatorId）不再重复出现在「为你推荐」里，
    // 避免同一个人同时出现在「有人想和你玩」与「为你推荐」两个区块（点完一起玩后对方看到两个一样的用户）。
    // 邀请解除（接受/拒绝）后自动恢复显示。
    visibleCandidates() {
      const inviterIds = (this.invites || []).map(i => i.creatorId).filter(Boolean)
      return (this.candidates || []).filter(c => !inviterIds.includes(c.userId))
    }
  },
  onShow() {
    this.openid = getOpenid()
    if (!this.openid) {
      uni.reLaunch({ url: '/pages/login/login' })
      return
    }
    this.loadAll()
    this.startPendingPolling()
    this.startRecommendPolling()
  },
  onHide() {
    this.stopPendingPolling()
    this.stopRecommendPolling()
    // M4.1：页面切走时立即把攒批的埋点（含 recommend_view）发出去，
    // 避免停留不足 10s 未触发攒批定时器就丢事件。
    flushTrack()
  },
  onUnload() {
    this.stopPendingPolling()
    this.stopRecommendPolling()
  },
  methods: {
    // 轻聊解锁门禁（S1）。前端只做入口显隐，真正的拦截在 chat.send（服务端权威）。
    canChat(c) {
      return reached(stageOf(c.growthValue), 'S1')
    },
    onChat(c) {
      uni.navigateTo({
        url: '/pages/chat/chat?peerId=' + c.userId + '&nickname=' + encodeURIComponent(c.nickname || 'TA')
      })
    },
    // 联系方式解锁门禁（S4）。同样只是入口显隐，服务端 chat.contact 才是权威拦截。
    canContact(c) {
      return reached(stageOf(c.growthValue), 'S4')
    },
    onContact(c) {
      uni.navigateTo({
        url: '/pages/contact/contact?peerId=' + c.userId + '&nickname=' + encodeURIComponent(c.nickname || 'TA')
      })
    },
    async loadAll() {
      await Promise.all([this.loadRecommend(), this.loadPending()])
    },
    async loadRecommend() {
      this.loading = true
      const r = await callFunction('match', { action: 'recommend', limit: 10 })
      this.loading = false
      if (r.ok) this.candidates = (r.data && r.data.candidates) || []
      else if (r.code === 500) uni.showToast({ title: r.message, icon: 'none' })

      // M4.1：`recommend_view` —— 曝光→配对转化漏斗的第一环。
      // 口径「每次进页 1 条」：本页有 12s 轮询，绝不能放在轮询里报（会把曝光量放大几十倍）。
      // 用 _recommendViewSent 保证一次进页只报一次，onShow 时重置。
      if (!this._recommendViewSent) {
        this._recommendViewSent = true
        track('recommend_view', { count: (this.candidates || []).length })
      }
    },
    async loadPending() {
      const r = await callFunction('match', { action: 'myPending' })
      if (!r.ok) {
        if (r.code === 500) uni.showToast({ title: r.message, icon: 'none' })
        return
      }
      const newInvites = (r.data && r.data.invites) || []
      const prevIds = (this.invites || []).map(i => i.gameId)
      const newIds = newInvites.map(i => i.gameId)
      const changed = newIds.some(id => !prevIds.includes(id)) || prevIds.some(id => !newIds.includes(id))
      this.invites = newInvites
      // 邀请集合变化（新增/移除）时刷新推荐：服务端会按 active 匹配过滤掉已进入匹配的人，
      // 避免「有人想和你玩」与「为你推荐」同时出现同一个人（点完一起玩后对方看到两个一样的用户）。
      // 与 visibleCandidates 的即时去重互补：云端 creatorId 生效时秒级去重，未生效时本刷新在 ≤1 个轮询周期内自愈。
      if (changed && !this.loading) this.loadRecommend()
    },
    // 驻留页面期间对"待接受邀请"轮询：有人现在邀你，无需退页重进即可看到/接受/拒绝。
    // 走云函数轮询而非客户端 watch——games 由服务端创建，跨用户文档直读会被安全规则拦截。
    startPendingPolling() {
      this.stopPendingPolling()
      this.pendingTimer = setInterval(() => {
        if (!this.openid) return
        this.loadPending()
      }, 2500)
    },
    stopPendingPolling() {
      if (this.pendingTimer) {
        clearInterval(this.pendingTimer)
        this.pendingTimer = null
      }
    },
    // 推荐列表自愈：匹配大厅页面不是实时推送，被拉黑方可能停留在页面上看不到更新。
    // 周期性（12s）重拉 recommend，让「对方已拉黑我」等情况在驻留页面期间也能自动生效，
    // 无需用户退页重进。配合 accept 的服务端 403 兜底，客户端再旧也漏不了建局。
    // （MVP 轮询方案；后续可改为 blocks 集合的 realtime watch 订阅，去掉轮询开销。）
    startRecommendPolling() {
      this.stopRecommendPolling()
      this.recommendTimer = setInterval(() => {
        if (!this.openid) return
        this.loadRecommend()
      }, 12000)
    },
    stopRecommendPolling() {
      if (this.recommendTimer) {
        clearInterval(this.recommendTimer)
        this.recommendTimer = null
      }
    },
    // A 发起：创建匹配 + waiting 局，进入游戏房等待对方
    async onPlay(c) {
      if (this.busy) return
      this.busy = true
      const r = await callFunction('match', { action: 'accept', candidateId: c.userId })
      this.busy = false
      if (!r.ok) {
        // 服务端兜底拦截：对方已拉黑/被拉黑时返回 403。
        // 即使推荐快照未及时刷新、卡片还在，点击后本地立即移除并提示，避免「点了还能建局」。
        if (r.code === 403) {
          this.candidates = this.candidates.filter(x => x.userId !== c.userId)
        }
        uni.showToast({ title: r.message || '操作失败', icon: 'none' })
        return
      }
      uni.navigateTo({ url: '/pages/game/game?gameId=' + r.data.gameId })
    },
    // B 接受邀请：进入游戏房，由 game 页自动 joinGame
    onAcceptInvite(inv) {
      uni.navigateTo({ url: '/pages/game/game?gameId=' + inv.gameId })
    },
    // 拉黑：写入 blocks，服务端过滤是权威（前端传参可被绕过，故只在服务端读）
    // 拉黑后立刻从本地候选移除，下次 recommend 也不会再返回对方
    async onBlock(c) {
      if (this.busy) return
      const name = c.nickname || '该用户'
      const confirmed = await new Promise(resolve => {
        uni.showModal({
          title: '拉黑 ' + name + '？',
          content: '拉黑后你们不会再出现在彼此的推荐里，可在「设置 → 黑名单」中解除。',
          confirmText: '拉黑',
          confirmColor: '#FF6B81',
          success: r => resolve(!!r.confirm),
          fail: () => resolve(false)
        })
      })
      if (!confirmed) return
      this.busy = true
      const r = await callFunction('safety', { action: 'block', targetId: c.userId })
      this.busy = false
      if (!r.ok) {
        uni.showToast({ title: r.message || '拉黑失败', icon: 'none' })
        return
      }
      uni.showToast({ title: '已拉黑', icon: 'none' })
      this.candidates = this.candidates.filter(x => x.userId !== c.userId)
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
.mbti { font-size: 20rpx; color: #8e7cc3; margin-top: 4rpx; }
.btn {
  font-size: 26rpx;
  color: #fff;
  background: #FF6B81;
  padding: 14rpx 28rpx;
  border-radius: 30rpx;
  flex-shrink: 0;
}
.btn.play { margin-bottom: 12rpx; }
.btn.chat { background: #FFB199; margin-bottom: 12rpx; text-align: center; }
.btn.contact { background: #7c5cff; margin-bottom: 12rpx; text-align: center; font-size: 24rpx; padding: 10rpx 22rpx; }
.invite-actions, .cand-actions { display: flex; flex-direction: column; flex-shrink: 0; margin-left: 16rpx; }
.btn.accept { margin-bottom: 12rpx; }
.btn.decline { background: #ddd; color: #666; }
.btn.block { background: #f2f2f2; color: #999; font-size: 24rpx; padding: 10rpx 22rpx; text-align: center;}
.empty, .loading { text-align: center; font-size: 26rpx; color: #bbb; padding: 60rpx 0; }
</style>
