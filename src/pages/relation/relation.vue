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
        <!-- 我发起的邀请：等待状态行放信息区，不占按钮列（rel-actions 尺寸稳定不跳动） -->
        <view class="invite-status" v-if="isMyInvite(p)">
          <text>💌 等待 {{ p.peer.nickname || 'TA' }} 回应 · {{ inviteRemain(p) }}</text>
          <text class="cancel-link" @click="onCancel(p)">撤销</text>
        </view>
      </view>
      <view class="rel-actions">
        <text class="btn play" @click="onPlay(p)">一起玩</text>
        <text class="btn chat" v-if="reached(stageOf(p.growthValue), 'S1')" @click="onChat(p)">聊聊</text>
        <text class="btn contact" v-if="reached(stageOf(p.growthValue), 'S4')" @click="onContact(p)">联系方式</text>

        <!-- 未确认、达 S1、且无进行中邀请：可发起 -->
        <text class="btn confirm" v-if="canConfirm(p) && !isInviteActive(p)" @click="onConfirm(p)">我们在一起了 🎉</text>
      </view>
    </view>

    <!-- B 收到的「在一起确认邀请」弹窗（computed 派生，无邀请时为 null 不显示） -->
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
import growthBar from '../../components/growth-bar.vue'
import { stageOf, stageInfo, reached } from '../../utils/growth'
import {
  inviteState,
  currentReceived,
  isMyInvite as isMyInviteOf,
  isInviteActive as isInviteActiveOf,
  inviteRemain as inviteRemainOf,
  refreshInvites,
  sendConfirmInvite,
  acceptConfirmInvite,
  rejectConfirmInvite,
  cancelConfirmInvite
} from '../../utils/confirmInvite'

export default {
  components: { growthBar },
  data() {
    return {
      loading: false,
      busy: false
    }
  },
  computed: {
    // 数据源统一为全局 store：应用级轮询（App.vue onShow 启动）驱动，
    // B 在任意页面都能收到 A 的邀请，关系页不再自建轮询
    pairs() { return inviteState.pairs },
    // 注意必须是 computed：之前写成 method 后模板里拿到的是函数引用（恒真值），
    // 导致弹窗常显、动作传参错误
    receivedInvite() { return currentReceived() }
  },
  onShow() {
    const oid = getOpenid()
    if (!oid) {
      uni.reLaunch({ url: '/pages/login/login' })
      return
    }
    inviteState.openid = oid
    // 立即拉一次（不等应用级首个 4s 轮询），保证进入页面即见最新邀请状态
    this.load(false)
  },
  methods: {
    // 模板里直接调用（方法比 computed-per-item 更简单，且 growthValue 已是服务端权威值）
    stageOf,
    reached,
    stageLabel(v) {
      return stageInfo(stageOf(v)).label
    },
    async load(silent) {
      if (!silent) this.loading = true
      await refreshInvites()
      if (!silent) this.loading = false
    },
    // ───── 邀请状态派生（委托全局 store，基于 inviteState.nowTs 每秒 tick 重算） ─────
    isInviteActive(p) { return isInviteActiveOf(p) },
    isMyInvite(p) { return isMyInviteOf(p) },
    inviteRemain(p) { return inviteRemainOf(p) },
    // M4.4 SC4：关系达 S1 且未确认 → 显示「我们在一起了 🎉」（进行中邀请由 !isInviteActive 排除）
    canConfirm(p) {
      if (!p) return false
      if ((p.milestones || []).some(m => String(m).indexOf('在一起') !== -1)) return false
      return reached(stageOf(p.growthValue), 'S1')
    },

    // ───── 交互动作（服务端动作后刷新全局 store，页面响应式跟随） ─────
    // A 发起邀请
    async onConfirm(p) {
      if (this.busy) return
      this.busy = true
      const r = await sendConfirmInvite(p.peerId)
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
      const r = await cancelConfirmInvite(p.peerId)
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
      const r = await acceptConfirmInvite(p.peerId)
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
      const r = await rejectConfirmInvite(p.peerId)
      this.busy = false
      if (!r.ok) {
        uni.showToast({ title: r.message || '操作失败', icon: 'none' })
        return
      }
      uni.showToast({ title: '已拒绝', icon: 'none' })
      this.load(true)
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
.btn.confirm { background: #FFD166; color: #7a5b00; }
.invite-status {
  margin-top: 10rpx;
  align-self: flex-start;
  display: flex;
  align-items: center;
  font-size: 22rpx;
  color: #9a7b00;
  background: #fff8e1;
  padding: 6rpx 16rpx;
  border-radius: 20rpx;
}
.cancel-link { color: #FF6B81; margin-left: 14rpx; text-decoration: underline; }
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
