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

        <!-- 我发起的邀请：等待对方回应（点一下可撤销） -->
        <text class="btn pending" v-if="isMyInvite(p)" @click="onCancel(p)">
          等待 {{ p.peer.nickname || 'TA' }} 回应 · {{ inviteRemain(p) }}（点此撤销）
        </text>
        <!-- 未确认、达 S1、且无进行中邀请：可发起 -->
        <text class="btn confirm" v-if="canConfirm(p) && !isInviteActive(p)" @click="onConfirm(p)">我们在一起了 🎉</text>
      </view>
    </view>

    <!-- B 收到的「在一起确认邀请」弹窗 -->
    <view class="modal-mask" v-if="receivedInvite">
      <view class="modal">
        <view class="modal-emoji">💌</view>
        <view class="modal-title">在一起确认邀请</view>
        <view class="modal-body">
          <text class="modal-peer">{{ (receivedInvite.peer && receivedInvite.peer.nickname) || 'TA' }}</text>
          想和你确认在一起
        </view>
        <view class="modal-tip">邀请有效期 {{ inviteRemain(receivedInvite) }}，超时将自动失效</view>
        <view class="modal-actions">
          <text class="m-btn reject" @click="onReject(receivedInvite)">拒绝</text>
          <text class="m-btn accept" @click="onAccept(receivedInvite)">同意 🎉</text>
        </view>
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
      busy: false,
      timer: null,    // 4s 轮询：刷新关系列表（含邀请状态）
      tick: null,     // 1s 计时：仅驱动倒计时显示
      nowTs: Date.now()
    }
  },
  onShow() {
    this.openid = getOpenid()
    if (!this.openid) {
      uni.reLaunch({ url: '/pages/login/login' })
      return
    }
    this.load(false)
    this.startPolling()
  },
  onHide() { this.stopPolling() },
  onUnload() { this.stopPolling() },
  methods: {
    // 模板里直接调用（方法比 computed-per-item 更简单，且 growthValue 已是服务端权威值）
    stageOf,
    reached,
    stageLabel(v) {
      return stageInfo(stageOf(v)).label
    },
    async load(silent) {
      if (!silent) this.loading = true
      const r = await callFunction('growth', { action: 'listPairs' })
      if (!silent) this.loading = false
      if (!r.ok) {
        if (!silent) uni.showToast({ title: r.message || '加载失败', icon: 'none' })
        return
      }
      // 服务端已按 updatedAt 降序 + 补齐 peer 资料（含 confirmInvite），前端直接渲染
      this.pairs = (r.data && r.data.pairs) || []
    },
    // 弱实时轮询：照搬 chat 的 3s 模式，这里用 4s。邀请状态靠轮询在双方页面间同步，
    // 无需 realtime.js；倒计时另起 1s tick 仅做显示，状态切换仍由轮询驱动。
    startPolling() {
      this.stopPolling()
      this.timer = setInterval(() => { this.load(true) }, 4000)
      this.tick = setInterval(() => { this.nowTs = Date.now() }, 1000)
    },
    stopPolling() {
      if (this.timer) { clearInterval(this.timer); this.timer = null }
      if (this.tick) { clearInterval(this.tick); this.tick = null }
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
    },

    // ───── 邀请状态派生（基于 pairs[i].confirmInvite） ─────
    // 邀请是否有效（未过期）
    isInviteActive(p) {
      const i = p && p.confirmInvite
      return !!(i && i.from && i.expiresAt && Number(i.expiresAt) > this.nowTs)
    },
    // 我发起的、仍有效的邀请
    isMyInvite(p) {
      return this.isInviteActive(p) && p.confirmInvite.from === this.openid
    },
    // 我收到的（对方发起、仍有效）—— 用于弹窗
    receivedInvite() {
      return (this.pairs || []).find(p => {
        const i = p.confirmInvite
        return i && i.from && i.from !== this.openid && Number(i.expiresAt) > this.nowTs
      }) || null
    },
    inviteRemain(p) {
      const i = p && p.confirmInvite
      if (!i) return ''
      const s = Math.max(0, Math.ceil((Number(i.expiresAt) - this.nowTs) / 1000))
      const m = Math.floor(s / 60)
      const ss = s % 60
      return m > 0 ? (m + '分' + (ss < 10 ? '0' : '') + ss + '秒') : (ss + '秒')
    },
    // M4.4 SC4：关系达 S1 且未确认且无进行中邀请 → 显示「我们在一起了 🎉」
    canConfirm(p) {
      if (!p) return false
      if ((p.milestones || []).some(m => String(m).indexOf('在一起') !== -1)) return false
      return reached(stageOf(p.growthValue), 'S1')
    },

    // ───── 交互动作 ─────
    // A 发起邀请
    async onConfirm(p) {
      if (this.busy) return
      this.busy = true
      const r = await callFunction('growth', { action: 'sendConfirmInvite', peerId: p.peerId })
      this.busy = false
      if (r.code === 409) {
        // 对方已向我发起邀请：引导去确认（弹窗会由轮询自动出现）
        uni.showToast({ title: '对方已向你发起邀请，去确认吧', icon: 'none' })
        this.load(true)
        return
      }
      if (!r.ok) {
        uni.showToast({ title: r.message || '操作失败', icon: 'none' })
        return
      }
      uni.showToast({ title: '邀请已发送，等待对方回应', icon: 'none' })
      this.load(true)
    },
    // A 撤销自己发起的邀请
    async onCancel(p) {
      if (this.busy) return
      this.busy = true
      const r = await callFunction('growth', { action: 'cancelConfirmInvite', peerId: p.peerId })
      this.busy = false
      if (!r.ok) {
        uni.showToast({ title: r.message || '操作失败', icon: 'none' })
        return
      }
      uni.showToast({ title: '已撤销邀请', icon: 'none' })
      this.load(true)
    },
    // B 同意 → 真正落里程碑 + 上报 relation_confirmed（服务端已校验未过期、且非本人邀请）
    async onAccept(p) {
      if (this.busy) return
      this.busy = true
      const r = await callFunction('growth', { action: 'acceptConfirmInvite', peerId: p.peerId })
      this.busy = false
      if (r.code === 409) {
        uni.showToast({ title: '邀请已过期，请重新发起', icon: 'none' })
        this.load(true)
        return
      }
      if (!r.ok) {
        uni.showToast({ title: r.message || '操作失败', icon: 'none' })
        return
      }
      uni.showToast({ title: '已确认在一起 🎉', icon: 'none' })
      this.load(true)
    },
    // B 拒绝 → 清空邀请，A 端轮询到点自动回到「可重新发起」
    async onReject(p) {
      if (this.busy) return
      this.busy = true
      const r = await callFunction('growth', { action: 'rejectConfirmInvite', peerId: p.peerId })
      this.busy = false
      if (!r.ok) {
        uni.showToast({ title: r.message || '操作失败', icon: 'none' })
        return
      }
      uni.showToast({ title: '已拒绝', icon: 'none' })
      this.load(true)
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
.btn.confirm { background: #FFD166; color: #7a5b00; }
.btn.pending { background: #cfcfcf; color: #555; }
.empty, .loading { text-align: center; font-size: 26rpx; color: #bbb; padding: 60rpx 0; }

/* 在一起确认邀请弹窗 */
.modal-mask {
  position: fixed;
  left: 0; top: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}
.modal {
  width: 560rpx;
  background: #fff;
  border-radius: 28rpx;
  padding: 44rpx 36rpx 32rpx;
  text-align: center;
  box-shadow: 0 12rpx 40rpx rgba(0, 0, 0, 0.18);
}
.modal-emoji { font-size: 64rpx; }
.modal-title { font-size: 32rpx; font-weight: 700; color: #FF6B81; margin-top: 8rpx; }
.modal-body { font-size: 28rpx; color: #333; margin-top: 20rpx; line-height: 1.5; }
.modal-peer { color: #FF6B81; font-weight: 600; }
.modal-tip { font-size: 22rpx; color: #999; margin-top: 12rpx; }
.modal-actions { display: flex; margin-top: 32rpx; }
.m-btn {
  flex: 1;
  font-size: 28rpx;
  padding: 18rpx 0;
  border-radius: 30rpx;
  margin: 0 10rpx;
}
.m-btn.reject { background: #f2f2f2; color: #888; }
.m-btn.accept { background: #FF6B81; color: #fff; }
</style>
