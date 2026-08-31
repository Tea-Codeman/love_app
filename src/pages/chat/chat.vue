<template>
  <view class="chat">
    <!-- 关系状态条：S1 才解锁聊天，未解锁时展示还需多少成长值 -->
    <view class="relbar">
      <view class="rel-head">
        <view class="peer-col">
          <text class="peer">{{ nickname || 'TA' }}</text>
          <!-- F-new：对方在线/离线状态，定时拉取 -->
          <view class="status" :class="{ online: peerOnline }">
            <text class="dot"></text>
            <text class="status-text">{{ peerOnline ? '在线' : '离线' }}</text>
          </view>
        </view>
        <text class="stage">{{ stageLabel }}</text>
        <!-- M3.4：S4 解锁后可在聊天里直达联系方式页 -->
        <text class="goto" v-if="contactUnlocked" @click="goContact">联系方式 ›</text>
      </view>
      <growth-bar :growth-value="growthValue"></growth-bar>
    </view>

    <!-- S1 门禁：关系未到 S1 时禁止发消息，引导先一起玩 -->
    <view class="locked" v-if="!unlocked">
      <text class="locked-title">聊天还没解锁</text>
      <text class="locked-desc">再一起玩几局、把成长值提升到 12 就能开始轻聊啦</text>
    </view>

    <scroll-view class="msgs" scroll-y :scroll-into-view="anchor" @scrolltoupper="onReachTop" @scrolltolower="onReachBottom" v-else>
      <view class="hist" v-if="!olderExhausted">{{ olderLoading ? '加载更早消息…' : '下滑到顶加载更早消息' }}</view>
      <view class="hist" v-else>没有更多了</view>
      <view class="empty" v-if="messages.length === 0">还没有消息，打个招呼吧 ›</view>
      <view :id="'m-' + m.msgId" class="row" :class="{ mine: m.mine }" v-for="m in messages" :key="m.msgId">
        <text class="bubble">{{ m.content }}</text>
      </view>
    </scroll-view>

    <view class="composer">
      <input
        class="input"
        v-model="draft"
        :disabled="!unlocked"
        :placeholder="unlocked ? '说点什么…' : '聊天未解锁'"
        placeholder-class="ph"
        confirm-type="send"
        @confirm="onSend"
        maxlength="500"
      />
      <text class="send" :class="{ disabled: !unlocked || !draft.trim() || sending }" @click="onSend">发送</text>
    </view>
  </view>
</template>

<script>
import { callFunction } from '../../utils/request'
import { getOpenid } from '../../utils/storage'
import growthBar from '../../components/growth-bar.vue'
import { stageOf, stageInfo, reached } from '../../utils/growth'

// 轻聊解锁门槛：S1（与服务端 chat 的 MIN_CHAT_GROWTH 一致）
const CHAT_UNLOCK_STAGE = 'S1'
// 联系方式解锁门槛：S4（与服务端 chat 的 MIN_CONTACT_GROWTH 一致）
const CONTACT_UNLOCK_STAGE = 'S4'

export default {
  components: { growthBar },
  data() {
    return {
      openid: '',
      peerId: '',
      nickname: '',
      growthValue: 0,
      messages: [],
      draft: '',
      sending: false,
      timer: null,
      peerOnline: true,
      statusTimer: null,
      anchor: '',
      lastCreatedAt: 0,
      oldestCreatedAt: 0,
      olderLoading: false,
      olderExhausted: false,
      atBottom: true
    }
  },
  computed: {
    stage() {
      return stageOf(this.growthValue)
    },
    stageLabel() {
      return stageInfo(this.stage).label
    },
    unlocked() {
      return reached(this.stage, CHAT_UNLOCK_STAGE)
    },
    contactUnlocked() {
      return reached(this.stage, CONTACT_UNLOCK_STAGE)
    }
  },
  onLoad(options) {
    this.peerId = options.peerId || ''
    this.nickname = options.nickname ? decodeURIComponent(options.nickname) : ''
    this.openid = getOpenid()
    if (!this.openid) {
      uni.reLaunch({ url: '/pages/login/login' })
      return
    }
    if (this.nickname) uni.setNavigationBarTitle({ title: this.nickname })
  },
  onShow() {
    this.refresh()
    this.startPolling()
    this.startStatusPolling()
  },
  onHide() { this.stopPolling(); this.stopStatusPolling() },
  onUnload() { this.stopPolling(); this.stopStatusPolling() },
  methods: {
    async refresh() {
      // 重新进入页面（onShow）时整页刷新：游标归零，loadMessages 走服务端全量
      this.lastCreatedAt = 0
      this.oldestCreatedAt = 0
      this.olderExhausted = false
      this.atBottom = true
      await Promise.all([this.loadPair(), this.loadMessages()])
    },
    // 关系状态：阶段由 growthValue 派生，门禁以前端计算为准、服务端再兜一次
    async loadPair() {
      const r = await callFunction('growth', { action: 'getPair', peerId: this.peerId })
      if (r.ok && r.data && r.data.pair) this.growthValue = Number(r.data.pair.growthValue) || 0
    },
    async loadMessages() {
      // 防并发：轮询与 onSend 可能重叠，重叠时共享过期游标会各拉一份并重复 append
      if (this._fetching) return
      this._fetching = true
      const since = this.lastCreatedAt
      try {
        const r = await callFunction('chat', { action: 'list', peerId: this.peerId, limit: 50, since })
        if (!r.ok) {
          if (r.code === 500) uni.showToast({ title: r.message, icon: 'none' })
          return
        }
        const incoming = (r.data && r.data.messages) || []
        if (since <= 0) {
          // 首屏 / 重新进入：全量替换（服务端 since<=0 时返回全部）
          this.messages = incoming
          this.oldestCreatedAt = incoming.length ? incoming[0].createdAt : 0
        } else if (incoming.length) {
          // 轮询增量：按 msgId 去重后仅追加真正的新消息，杜绝重复拼接旧记录
          const have = new Set(this.messages.map(m => m.msgId))
          const fresh = incoming.filter(m => !have.has(m.msgId))
          if (fresh.length) this.messages = this.messages.concat(fresh)
        }
        // 推进游标：取当前已知最新一条的 createdAt（messages 始终按 createdAt 升序）
        const known = this.messages
        const latest = known.length ? known[known.length - 1] : null
        if (latest) this.lastCreatedAt = latest.createdAt
        // 首屏必沉底；轮询仅在用户本就贴底时自动沉底（避免抢走向上看历史的滚动位置）
        if (since <= 0 || (incoming.length && this.atBottom)) this.scrollToBottom()
      } finally {
        this._fetching = false
      }
    },
    // 上滑到顶：加载更早历史（prepend 到顶部，msgId 去重，游标用 oldestCreatedAt）
    async loadOlder() {
      if (this.olderLoading || this.olderExhausted) return
      if (!this.messages.length) return
      this.olderLoading = true
      const before = this.oldestCreatedAt
      try {
        const r = await callFunction('chat', { action: 'list', peerId: this.peerId, limit: 50, before })
        if (!r.ok) return
        const incoming = (r.data && r.data.messages) || []
        if (!incoming.length) { this.olderExhausted = true; return }
        const have = new Set(this.messages.map(m => m.msgId))
        const fresh = incoming.filter(m => !have.has(m.msgId))
        if (fresh.length) {
          this.messages = fresh.concat(this.messages)   // 早的在前，拼到顶部
          this.oldestCreatedAt = fresh[0].createdAt      // fresh 升序，首条最早
          // 锚定到首条新载入的消息，保持用户阅读位置不跳
          this.anchor = 'm-' + fresh[0].msgId
        }
        if (!r.data || !r.data.hasMore) this.olderExhausted = true
      } finally {
        this.olderLoading = false
      }
    },
    onReachTop() {
      // 滚到顶：标记不在底部，并触发历史翻页
      this.atBottom = false
      this.loadOlder()
    },
    onReachBottom() {
      // 滚到底：标记在底部，新消息来时自动沉底
      this.atBottom = true
    },
    scrollToBottom() {
      const last = this.messages[this.messages.length - 1]
      this.anchor = last ? 'm-' + last.msgId : ''
    },
    // MVP 轮询：与匹配大厅一致，走云函数而非客户端直读（messages 由服务端写入，
    // 跨用户文档直读会被安全规则拦截）。后续可换 realtime watch。
    startPolling() {
      this.stopPolling()
      this.timer = setInterval(() => {
        if (!this.openid || !this.unlocked) return
        this.loadMessages()
      }, 1500)
    },
    stopPolling() {
      if (this.timer) {
        clearInterval(this.timer)
        this.timer = null
      }
    },
    // F-new：定时拉取对方在线状态（8s 一次，够及时又不刷屏）。聊天页已轮询消息，
    // 状态单独走低频定时，避免叠加到消息轮询里放大调用量。
    startStatusPolling() {
      this.stopStatusPolling()
      this.fetchPeerStatus()
      this.statusTimer = setInterval(() => this.fetchPeerStatus(), 8000)
    },
    stopStatusPolling() {
      if (this.statusTimer) {
        clearInterval(this.statusTimer)
        this.statusTimer = null
      }
    },
    async fetchPeerStatus() {
      if (!this.peerId) return
      const r = await callFunction('auth', { action: 'getStatus', targetId: this.peerId })
      if (r.ok && r.data) this.peerOnline = !!r.data.online
    },
    goContact() {
      uni.navigateTo({
        url: '/pages/contact/contact?peerId=' + this.peerId + '&nickname=' + encodeURIComponent(this.nickname || 'TA')
      })
    },
    async onSend() {
      const text = (this.draft || '').trim()
      if (!text || this.sending) return
      if (!this.unlocked) {
        uni.showToast({ title: '关系还不够熟，再一起玩几局吧', icon: 'none' })
        return
      }
      this.sending = true
      const r = await callFunction('chat', { action: 'send', peerId: this.peerId, content: text })
      this.sending = false
      if (!r.ok) {
        // 403 且带 auditFailed：内容未过审，保留草稿让用户修改，不清空输入
        if (r.code === 403 && r.data && r.data.auditFailed) return uni.showToast({ title: r.message, icon: 'none' })
        return uni.showToast({ title: r.message || '发送失败', icon: 'none' })
      }
      this.draft = ''
      // 乐观追加自己刚发的消息（服务端已返回 msgId/createdAt）；轮询按 msgId 去重不会重复
      this.messages = this.messages.concat([{
        msgId: r.data.msgId,
        content: text,
        type: 'text',
        senderId: this.openid,
        mine: true,
        createdAt: r.data.createdAt
      }])
      this.lastCreatedAt = Math.max(this.lastCreatedAt || 0, r.data.createdAt || 0)
      this.atBottom = true
      this.scrollToBottom()
      // 互聊结算会让成长值上涨，顺带刷新关系状态条（消息已在本地乐观追加，无需再 loadMessages）
      await this.loadPair()
    }
  }
}
</script>

<style scoped>
.chat { min-height: 100vh; background: var(--grad-soft, linear-gradient(180deg, #FFF1F4, #FFFAFB)); display: flex; flex-direction: column; }
.relbar { background: #fff; padding: 20rpx 28rpx; border-bottom: 1rpx solid var(--border, #FBE1E7); box-shadow: var(--shadow-sm, 0 2rpx 8rpx rgba(244,63,106,.06)); }
.rel-head { display: flex; align-items: baseline; justify-content: space-between; }
.peer-col { display: flex; flex-direction: column; }
.peer { font-size: 30rpx; color: var(--ink-900, #2B2330); font-weight: 600; }
.status { display: flex; align-items: center; margin-top: 6rpx; }
.status .dot { width: 14rpx; height: 14rpx; border-radius: 50%; background: #C9C9C9; margin-right: 8rpx; }
.status.online .dot { background: var(--success, #16A34A); }
.status-text { font-size: 20rpx; color: #C9C9C9; }
.status.online .status-text { color: var(--success, #16A34A); }
.stage { font-size: 22rpx; color: var(--brand-600, #E11D54); font-weight: 600; }
.goto { font-size: 22rpx; color: var(--violet-500, #8B5CF6); font-weight: 600; }
.locked { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 80rpx 60rpx; }
.locked-title { font-size: 30rpx; color: var(--ink-700, #4A4250); font-weight: 700; }
.locked-desc { font-size: 24rpx; color: var(--ink-400, #A89FA8); margin-top: 12rpx; text-align: center; line-height: 1.6; }
.msgs { flex: 1; padding: 20rpx 24rpx; box-sizing: border-box; }
.empty { text-align: center; font-size: 26rpx; color: var(--ink-400, #A89FA8); padding: 60rpx 0; }
.hist { text-align: center; font-size: 22rpx; color: #C9C9C9; padding: 16rpx 0 8rpx; }
.row { display: flex; margin-bottom: 20rpx; }
.row.mine { justify-content: flex-end; }
.bubble {
  max-width: 68%;
  background: #fff;
  color: var(--ink-900, #2B2330);
  font-size: 28rpx;
  line-height: 1.5;
  padding: 16rpx 22rpx;
  border-radius: 24rpx 24rpx 24rpx 6rpx;
  box-shadow: var(--shadow-sm, 0 2rpx 8rpx rgba(0,0,0,.04));
  border: 1rpx solid var(--border, #FBE1E7);
}
.row.mine .bubble {
  background: var(--grad-primary, linear-gradient(135deg, #FF8A65, #F43F6A));
  color: #fff; border-radius: 24rpx 24rpx 6rpx 24rpx; border-color: transparent;
}
.composer {
  display: flex; align-items: center; background: #fff;
  padding: 16rpx 20rpx; border-top: 1rpx solid var(--border, #FBE1E7);
  padding-bottom: calc(16rpx + env(safe-area-inset-bottom));
}
.input {
  flex: 1;
  background: var(--brand-50, #FFF1F4);
  border-radius: 999rpx;
  padding: 18rpx 24rpx;
  font-size: 28rpx;
  color: var(--ink-900, #2B2330);
}
.ph { color: var(--ink-400, #A89FA8); }
.send {
  margin-left: 16rpx;
  font-size: 28rpx;
  font-weight: 600;
  color: #fff;
  background: var(--grad-primary, linear-gradient(135deg, #FF8A65, #F43F6A));
  padding: 18rpx 34rpx;
  border-radius: 999rpx;
  transition: transform .12s ease;
}
.send:active { transform: scale(.95); }
.send.disabled { background: #DDD; box-shadow: none; }
</style>
