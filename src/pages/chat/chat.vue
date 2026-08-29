<template>
  <view class="chat">
    <!-- 关系状态条：S1 才解锁聊天，未解锁时展示还需多少成长值 -->
    <view class="relbar">
      <view class="rel-head">
        <text class="peer">{{ nickname || 'TA' }}</text>
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

    <scroll-view class="msgs" scroll-y :scroll-into-view="anchor" v-else>
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
      anchor: ''
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
  },
  onHide() { this.stopPolling() },
  onUnload() { this.stopPolling() },
  methods: {
    async refresh() {
      await Promise.all([this.loadPair(), this.loadMessages()])
    },
    // 关系状态：阶段由 growthValue 派生，门禁以前端计算为准、服务端再兜一次
    async loadPair() {
      const r = await callFunction('growth', { action: 'getPair', peerId: this.peerId })
      if (r.ok && r.data && r.data.pair) this.growthValue = Number(r.data.pair.growthValue) || 0
    },
    async loadMessages() {
      const r = await callFunction('chat', { action: 'list', peerId: this.peerId, limit: 50 })
      if (!r.ok) {
        if (r.code === 500) uni.showToast({ title: r.message, icon: 'none' })
        return
      }
      this.messages = (r.data && r.data.messages) || []
      this.scrollToBottom()
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
      }, 3000)
    },
    stopPolling() {
      if (this.timer) {
        clearInterval(this.timer)
        this.timer = null
      }
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
      // 互聊结算会让成长值上涨，顺带刷新关系状态条
      await Promise.all([this.loadMessages(), this.loadPair()])
    }
  }
}
</script>

<style>
.chat { min-height: 100vh; background: #FFF7F8; display: flex; flex-direction: column; }
.relbar { background: #fff; padding: 20rpx 28rpx; box-shadow: 0 2rpx 12rpx rgba(255, 107, 129, 0.06); }
.rel-head { display: flex; align-items: baseline; justify-content: space-between; }
.peer { font-size: 30rpx; color: #333; font-weight: 600; }
.stage { font-size: 22rpx; color: #FF6B81; }
.goto { font-size: 22rpx; color: #7c5cff; }
.locked { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 80rpx 60rpx; }
.locked-title { font-size: 30rpx; color: #666; font-weight: 600; }
.locked-desc { font-size: 24rpx; color: #aaa; margin-top: 12rpx; text-align: center; }
.msgs { flex: 1; padding: 20rpx 24rpx; box-sizing: border-box; }
.empty { text-align: center; font-size: 26rpx; color: #bbb; padding: 60rpx 0; }
.row { display: flex; margin-bottom: 20rpx; }
.row.mine { justify-content: flex-end; }
.bubble {
  max-width: 68%;
  background: #fff;
  color: #333;
  font-size: 28rpx;
  line-height: 1.5;
  padding: 16rpx 22rpx;
  border-radius: 18rpx;
  box-shadow: 0 2rpx 10rpx rgba(0, 0, 0, 0.04);
}
.row.mine .bubble { background: #FF6B81; color: #fff; }
.composer {
  display: flex;
  align-items: center;
  background: #fff;
  padding: 16rpx 20rpx;
  border-top: 1rpx solid #f0f0f0;
}
.input {
  flex: 1;
  background: #f6f6f6;
  border-radius: 30rpx;
  padding: 16rpx 24rpx;
  font-size: 28rpx;
  color: #333;
}
.ph { color: #bbb; }
.send {
  margin-left: 16rpx;
  font-size: 28rpx;
  color: #fff;
  background: #FF6B81;
  padding: 16rpx 32rpx;
  border-radius: 30rpx;
}
.send.disabled { background: #ddd; }
</style>
