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

    <!-- 进行中 -->
    <view class="playing" v-else-if="game.state === 'playing'">
      <view class="progress">
        <text class="round">第 {{ game.round }} / {{ game.totalRounds }} 题</text>
        <text class="tacit">默契 {{ game.tacitCount || 0 }}</text>
      </view>
      <quiz
        v-if="currentQuestion"
        :question="currentQuestion"
        :chosen="myAnswer"
        @answer="onAnswer"
      ></quiz>
      <view class="status" v-if="hasSubmitted && !oppSubmitted">已选择，等待对方…</view>
      <view class="status" v-else-if="!hasSubmitted">选一个你的答案吧</view>
      <view class="status ok" v-else-if="hasSubmitted && oppSubmitted">双方已选，马上进入下一题</view>
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
      joining: false
    }
  },
  computed: {
    currentQuestion() {
      if (!this.game || this.game.state !== 'playing') return null
      const qs = this.game.questions || []
      return qs[this.game.round - 1] || null
    },
    myAnswer() {
      if (!this.game) return -1
      const ans = this.game.answers && this.game.answers[String(this.game.round)]
      if (ans && ans[this.openid] !== undefined) return ans[this.openid]
      return -1
    },
    hasSubmitted() {
      return this.myAnswer !== -1
    },
    oppSubmitted() {
      if (!this.game || !this.game.players) return false
      const opp = this.game.players.find(p => p !== this.openid)
      const ans = this.game.answers && this.game.answers[String(this.game.round)]
      return !!(ans && ans[opp] !== undefined)
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
        this.maybeJoin()
      } else if (r.code === 500) {
        uni.showToast({ title: r.message, icon: 'none' })
      }
    },
    onGameUpdate(g) {
      this.game = g
      this.maybeJoin()
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
      if (this.hasSubmitted) return
      const r = await callFunction('game', {
        action: 'submitAnswer',
        gameId: this.gameId,
        optionIndex: i
      })
      if (!r.ok) {
        uni.showToast({ title: r.message || '提交失败', icon: 'none' })
      }
      // 状态由同步（watch/轮询）刷新；此处不手动改，避免与权威状态冲突
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

<style>
.game { min-height: 100vh; background: #FFF7F8; }
.center { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 80vh; }
.big { font-size: 120rpx; margin-bottom: 24rpx; }
.tip { font-size: 30rpx; color: #666; }
.result { font-size: 40rpx; color: #FF6B81; font-weight: 700; margin-bottom: 12rpx; }
.btn {
  margin-top: 48rpx;
  font-size: 30rpx;
  color: #fff;
  background: #FF6B81;
  padding: 20rpx 64rpx;
  border-radius: 40rpx;
}
.btn.ghost { background: #ddd; color: #666; }
.playing { padding-top: 16rpx; }
.progress { display: flex; justify-content: space-between; padding: 20rpx 32rpx; }
.round { font-size: 28rpx; color: #333; font-weight: 600; }
.tacit { font-size: 28rpx; color: #2ecc71; }
.status { text-align: center; font-size: 26rpx; color: #999; padding: 16rpx 0 40rpx; }
.status.ok { color: #FF6B81; }
</style>
