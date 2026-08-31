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
  <tab-bar current="relation"></tab-bar>
  </view>
</template>

<script>
import { callFunction } from '../../utils/request'
import { getOpenid } from '../../utils/storage'
import growthBar from '../../components/growth-bar.vue'
import tabBar from '../../components/tab-bar.vue'
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
  components: { growthBar, tabBar },
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
.relation { min-height: 100vh; background: var(--grad-soft, linear-gradient(180deg, #FFF1F4, #FFFAFB)); padding-bottom: 180rpx; }
.topbar { padding: 28rpx 32rpx 8rpx; }
.title { font-size: 42rpx; font-weight: 700; color: var(--ink-900, #2B2330); font-family: var(--font-display); display: block; }
.sub { font-size: 24rpx; color: var(--ink-500, #7A7280); margin-top: 6rpx; display: block; }
.rel-card {
  display: flex; align-items: flex-start;
  background: #fff; border: 1rpx solid var(--border, #FBE1E7);
  border-radius: var(--r-lg, 32rpx); padding: 24rpx; margin: 20rpx 24rpx;
  box-shadow: var(--shadow, 0 8rpx 24rpx rgba(244,63,106,.10));
}
.avatar { width: 96rpx; height: 96rpx; border-radius: 50%; background: var(--brand-100, #FFE3E9); border: 3rpx solid #fff; box-shadow: 0 0 0 3rpx var(--brand-100, #FFE3E9); flex-shrink: 0; }
.rel-meta { flex: 1; margin-left: 20rpx; display: flex; flex-direction: column; }
.name-row { display: flex; align-items: baseline; justify-content: space-between; }
.nickname { font-size: 30rpx; color: var(--ink-900, #2B2330); font-weight: 600; }
.stage {
  font-size: 20rpx; color: #fff; font-weight: 600;
  background: var(--grad-primary, linear-gradient(135deg, #FF8A65, #F43F6A));
  padding: 4rpx 16rpx; border-radius: 999rpx;
}
.stat { font-size: 22rpx; color: var(--ink-500, #7A7280); margin-top: 6rpx; }
.chips { margin-top: 10rpx; display: flex; flex-wrap: wrap; }
.chip {
  font-size: 20rpx; color: var(--gold-500, #F59E0B);
  background: #FFF7E6; padding: 4rpx 14rpx; border-radius: 999rpx; margin: 4rpx 10rpx 0 0;
}
.rel-actions { display: flex; flex-direction: column; flex-shrink: 0; margin-left: 16rpx; }
.btn {
  font-size: 24rpx; color: #fff; font-weight: 600;
  background: var(--grad-primary, linear-gradient(135deg, #FF8A65, #F43F6A));
  padding: 12rpx 24rpx; border-radius: 999rpx; text-align: center; margin-bottom: 12rpx;
  box-shadow: var(--shadow-glow, 0 8rpx 24rpx rgba(244,63,106,.3));
  transition: transform .12s ease;
}
.btn:active { transform: scale(.95); }
.btn.chat { background: #FFB199; box-shadow: none; }
.btn.contact { background: var(--violet-500, #8B5CF6); box-shadow: none; }
.btn.confirm { background: var(--gold-400, #FBBF24); color: #7A5B00; box-shadow: none; }
.invite-status {
  margin-top: 10rpx; align-self: flex-start; display: flex; align-items: center;
  font-size: 22rpx; color: #9A7B00; background: #FFF8E1; padding: 8rpx 16rpx; border-radius: 999rpx;
}
.cancel-link { color: var(--brand-600, #E11D54); margin-left: 14rpx; text-decoration: underline; }
.empty, .loading { text-align: center; font-size: 26rpx; color: var(--ink-400, #A89FA8); padding: 60rpx 0; }

/* 在一起确认邀请弹窗 */
.modal-mask {
  position: fixed; left: 0; top: 0; right: 0; bottom: 0;
  background: rgba(43,35,48,.45); display: flex; align-items: center; justify-content: center;
  z-index: 100; animation: fadeUp .2s ease both;
}
.modal {
  width: 560rpx; background: #fff; border-radius: var(--r-lg, 32rpx);
  padding: 44rpx 36rpx 32rpx; text-align: center;
  box-shadow: var(--shadow-lg, 0 16rpx 40rpx rgba(244,63,106,.16));
  animation: popIn .28s ease both;
}
.modal-emoji { font-size: 64rpx; animation: floatY 2s ease-in-out infinite; }
.modal-title { font-size: 32rpx; font-weight: 700; color: var(--brand-600, #E11D54); margin-top: 8rpx; }
.modal-body { font-size: 28rpx; color: var(--ink-700, #4A4250); margin-top: 20rpx; line-height: 1.5; }
.modal-peer { color: var(--brand-600, #E11D54); font-weight: 600; }
.modal-tip { font-size: 22rpx; color: var(--ink-400, #A89FA8); margin-top: 12rpx; }
.modal-actions { display: flex; margin-top: 32rpx; }
.m-btn { flex: 1; font-size: 28rpx; padding: 18rpx 0; border-radius: 999rpx; margin: 0 10rpx; transition: transform .12s ease; }
.m-btn:active { transform: scale(.96); }
.m-btn.reject { background: #F2F2F2; color: var(--ink-500, #7A7280); }
.m-btn.accept { background: var(--grad-primary, linear-gradient(135deg, #FF8A65, #F43F6A)); color: #fff; }
</style>
