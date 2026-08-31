<template>
  <view class="game">
    <!-- 加载中 -->
    <view class="center" v-if="!game">
      <text class="tip">加载中…</text>
    </view>

    <!-- 取消 / 失效 -->
    <view class="center" v-else-if="game.state === 'cancelled'">
      <text class="tip">对局已取消</text>
      <text class="btn" @click="goBack">返回</text>
    </view>

    <!-- 等待对方加入（creator 视角） -->
    <view class="center" v-else-if="game.state === 'waiting' && game.createdBy === openid">
      <text class="big">⏳</text>
      <text class="tip">已发起，等待对方加入…</text>
      <text class="btn ghost" @click="onCancel">取消邀请</text>
    </view>

    <!-- 等待对方加入（invitee 正在自动加入） -->
    <view class="center" v-else-if="game.state === 'waiting'">
      <text class="tip">正在加入对局…</text>
    </view>

    <!-- 进行中（各自独立答题，互不阻塞） -->
    <view class="playing" v-else-if="game.state === 'playing'">
      <view class="progress">
        <text class="round">第 {{ Math.min(myRound + 1, game.totalRounds) }} / {{ game.totalRounds }} 题（你）</text>
        <text class="tacit">对方已答 {{ oppRound }} / {{ game.totalRounds }}</text>
      </view>
      <quiz
        v-if="currentQuestion"
        :question="currentQuestion"
        :chosen="myAnswer"
        @answer="onAnswer"
      ></quiz>
      <view class="status" v-if="!iAmDone">选一个你的答案吧</view>
      <view class="status ok" v-else-if="iAmDone && game.state === 'playing'">
        你的答案已提交，等对方答完即出结果
      </view>
    </view>

    <!-- 结束 -->
    <view class="center" v-else-if="game.state === 'done'">
      <text class="big">💞</text>
      <text class="result">默契 {{ game.tacitCount || 0 }} / {{ game.totalRounds }} 题</text>
      <text class="tip">{{ resultText }}</text>
      <text class="btn" @click="goBack">完成破冰</text>
    </view>
  </view>
</template>

<script>
import { callFunction } from '../../utils/request'
import { getOpenid } from '../../utils/storage'
import { startGameSync } from '../../utils/realtime'
import quiz from './quiz.vue'

export default {
  components: { quiz },
  data() {
    return {
      openid: '',
      gameId: '',
      game: null,
      sync: null,
      joining: false,
      myRound: 0,        // 我已答完的题数（本地进度，重连时从 answers 恢复）
      myRoundInited: false
    }
  },
  computed: {
    currentQuestion() {
      if (!this.game || this.game.state !== 'playing') return null
      const qs = this.game.questions || []
      return qs[this.myRound] || null
    },
    myAnswer() {
      // 当前题尚未作答（答完即前进到下一题），无需高亮历史选择
      return -1
    },
    oppRound() {
      if (!this.game || !this.game.players) return 0
      const opp = this.game.players.find(p => p !== this.openid)
      if (!opp) return 0
      const total = this.game.totalRounds || 0
      const ans = this.game.answers || {}
      let c = 0
      for (let r = 1; r <= total; r++) {
        if (ans[String(r)] && ans[String(r)][opp] !== undefined) c++
      }
      return c
    },
    iAmDone() {
      if (!this.game) return false
      return this.myRound >= (this.game.totalRounds || 0)
    },
    resultText() {
      const t = this.game ? (this.game.tacitCount || 0) : 0
      const n = this.game ? this.game.totalRounds : 0
      if (t === n) return '完美默契！你们很有戏～'
      if (t >= Math.ceil(n / 2)) return '挺有默契的，继续聊聊吧'
      return '默契需要慢慢培养，别急'
    }
  },
  onLoad(options) {
    this.openid = getOpenid()
    if (!this.openid) {
      uni.reLaunch({ url: '/pages/login/login' })
      return
    }
    this.gameId = (options && options.gameId) || ''
    if (!this.gameId) {
      uni.showToast({ title: '缺少对局参数', icon: 'none' })
      return
    }
    this.loadInitial()
    this.sync = startGameSync(this.gameId, { onUpdate: g => this.onGameUpdate(g) })
  },
  onUnload() {
    if (this.sync && this.sync.stop) this.sync.stop()
  },
  methods: {
    async loadInitial() {
      const r = await callFunction('game', { action: 'getGame', gameId: this.gameId })
      if (r.ok && r.data) {
        this.game = r.data.game
        this.ensureMyRound()
        this.maybeJoin()
      } else if (r.code === 500) {
        uni.showToast({ title: r.message, icon: 'none' })
      }
    },
    onGameUpdate(g) {
      this.game = g
      this.ensureMyRound()
      this.maybeJoin()
    },
    // 已答某玩家在全部题中的作答数（用于本地进度恢复 / 对方进度显示）
    countAnswered(game, openid) {
      if (!game || !game.players) return 0
      const total = game.totalRounds || 0
      const ans = game.answers || {}
      let c = 0
      for (let r = 1; r <= total; r++) {
        if (ans[String(r)] && ans[String(r)][openid] !== undefined) c++
      }
      return c
    },
    // 首次拿到对局时，从已落盘答案恢复我的答题进度（重连/被杀重启后用）
    ensureMyRound() {
      if (this.myRoundInited || !this.game) return
      this.myRound = this.countAnswered(this.game, this.openid)
      this.myRoundInited = true
    },
    // 受邀方进入 waiting 局时自动加入
    async maybeJoin() {
      if (!this.game) return
      if (this.game.state === 'waiting' && this.game.invitedUserId === this.openid &&
          !(this.game.players || []).includes(this.openid) && !this.joining) {
        this.joining = true
        const r = await callFunction('game', { action: 'joinGame', gameId: this.gameId })
        this.joining = false
        if (r.ok && r.data) this.game = r.data.game
        else if (r.code === 500) uni.showToast({ title: r.message, icon: 'none' })
      }
    },
    async onAnswer(i) {
      if (!this.game || this.game.state !== 'playing') return
      if (this.iAmDone) return
      const r = await callFunction('game', {
        action: 'submitAnswer',
        gameId: this.gameId,
        optionIndex: i,
        round: this.myRound + 1
      })
      if (!r.ok) {
        uni.showToast({ title: r.message || '提交失败', icon: 'none' })
        return
      }
      // 本地前进到下一题；对方进度由同步（watch/轮询）刷新驱动
      this.myRound++
    },
    async onCancel() {
      const r = await callFunction('game', { action: 'cancelGame', gameId: this.gameId })
      if (r.ok) uni.showToast({ title: '已取消', icon: 'none' })
      else uni.showToast({ title: r.message || '操作失败', icon: 'none' })
    },
    goBack() {
      uni.navigateBack({ delta: 1 }).catch(() => {
        uni.reLaunch({ url: '/pages/match/match' })
      })
    }
  }
}
</script>

<style scoped>
.game { min-height: 100vh; background: var(--grad-soft, linear-gradient(180deg, #FFF1F4, #FFFAFB)); }
.center { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 80vh; padding: 0 60rpx; }
.big { font-size: 120rpx; margin-bottom: 24rpx; animation: floatY 2.4s ease-in-out infinite; }
.tip { font-size: 30rpx; color: var(--ink-500, #7A7280); text-align: center; }
.result { font-size: 44rpx; color: var(--brand-600, #E11D54); font-weight: 700; margin-bottom: 12rpx; font-family: var(--font-display); }
.btn {
  margin-top: 48rpx; font-size: 30rpx; font-weight: 600; color: #fff;
  background: var(--grad-primary, linear-gradient(135deg, #FF8A65, #F43F6A));
  padding: 22rpx 72rpx; border-radius: 999rpx;
  box-shadow: var(--shadow-glow, 0 8rpx 24rpx rgba(244,63,106,.35));
  transition: transform .12s ease;
}
.btn:active { transform: scale(.96); }
.btn.ghost { background: #F2F2F2; color: var(--ink-500, #7A7280); box-shadow: none; }
.playing { padding-top: 16rpx; }
.progress { display: flex; justify-content: space-between; align-items: center; padding: 24rpx 32rpx; }
.round { font-size: 28rpx; color: var(--ink-900, #2B2330); font-weight: 600; }
.tacit { font-size: 26rpx; color: var(--success, #16A34A); }
.status { text-align: center; font-size: 26rpx; color: var(--ink-500, #7A7280); padding: 16rpx 0 40rpx; }
.status.ok { color: var(--brand-600, #E11D54); font-weight: 600; }
</style>
