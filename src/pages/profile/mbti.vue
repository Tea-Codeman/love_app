<template>
  <view class="mbti">
    <!-- 答题中 -->
    <view v-if="!done" class="quiz">
      <view class="q-progress">第 {{ idx + 1 }} / {{ total }} 题</view>
      <view class="q-dim">{{ dimLabel }}</view>
      <view class="q-text">{{ q.q }}</view>
      <button class="opt" v-for="(t, k) in q.a" :key="k" @click="onAnswer(q.v[k])">{{ t }}</button>
      <!-- 答题中实时预览：形象随进度逐渐清晰 -->
      <view class="preview">
        <text class="pv-type" :style="{ opacity: previewOpacity }">{{ previewType }}</text>
        <text class="pv-tip">正在成型的你 · 已答 {{ idx }} / {{ total }}</text>
      </view>
    </view>

    <!-- 结果角色卡 -->
    <view v-else class="result">
      <view class="role-card" :style="{ borderColor: role.color }">
        <view class="role-badge" :style="{ background: role.color }">{{ role.type }}</view>
        <text class="role-name">{{ role.name }} · {{ role.animal }}</text>
        <view class="role-tags">
          <text class="tag" v-for="(t, i) in tagList" :key="i">{{ t }}</text>
        </view>
        <text class="role-line">“{{ role.line }}”</text>
        <text class="role-hint">这就是你在同频里的形象</text>
      </view>
      <button class="save-btn" :loading="saving" @click="onSave">保存并返回</button>
      <text class="retest" @click="onRetest">重新测一次</text>
      <text class="tip" v-if="msg">{{ msg }}</text>
    </view>
  </view>
</template>

<script>
import { MBTI_TEST, calcMbti, getRole } from '../../utils/mbti'
import { callFunction } from '../../utils/request'
import { getUser, setUser } from '../../utils/storage'

const DIM_LABEL = {
  EI: '能量来源 · 外向 E / 内向 I',
  SN: '信息获取 · 实感 S / 直觉 N',
  TF: '决策方式 · 思考 T / 情感 F',
  JP: '生活节奏 · 判断 J / 感知 P'
}

export default {
  data() {
    return {
      idx: 0,
      answers: [],
      type: '',
      role: getRole('INFP'),
      saving: false,
      msg: ''
    }
  },
  computed: {
    total() { return MBTI_TEST.length },
    q() { return MBTI_TEST[this.idx] },
    dimLabel() { return DIM_LABEL[this.q.dim] || '' },
    done() { return !!this.type },
    // 已答部分推出的临时类型，随进度逐渐清晰
    previewType() { return calcMbti(this.answers) },
    previewOpacity() { return (0.45 + 0.55 * (this.idx / this.total)).toFixed(2) },
    tagList() { return (this.role.tags || '').split('·').filter(Boolean) }
  },
  methods: {
    onAnswer(v) {
      this.answers.push(v)
      if (this.idx + 1 >= this.total) {
        this.type = calcMbti(this.answers)
        this.role = getRole(this.type)
      } else {
        this.idx++
      }
    },
    async onSave() {
      this.msg = ''
      this.saving = true
      const res = await callFunction('auth', { action: 'updateProfile', profile: { mbti: this.type } })
      this.saving = false
      if (!res.ok) { this.msg = res.message || '保存失败'; return }
      if (res.data && res.data.user) setUser(res.data.user)
      uni.showToast({ title: 'MBTI 已保存', icon: 'success' })
      setTimeout(() => uni.navigateBack(), 600)
    },
    onRetest() {
      this.idx = 0
      this.answers = []
      this.type = ''
      this.msg = ''
    }
  }
}
</script>

<style>
.mbti { padding: 40rpx 32rpx; background: #FFF7F8; min-height: 100vh; }
.q-progress { font-size: 24rpx; color: #999; text-align: center; }
.q-dim { margin-top: 12rpx; font-size: 24rpx; color: #b07a86; text-align: center; }
.q-text { margin: 60rpx 0 48rpx; font-size: 40rpx; font-weight: 700; color: #333; text-align: center; line-height: 1.5; }
.opt { display: block; width: 100%; margin-bottom: 28rpx; padding: 36rpx 28rpx; background: #fff; color: #333;
       font-size: 30rpx; border: 2rpx solid #f0e3e6; border-radius: 20rpx; line-height: 1.5; }
.opt::after { border: none; }
.preview { margin-top: 80rpx; text-align: center; }
.pv-type { display: block; font-size: 48rpx; font-weight: 700; color: #FF6B81; letter-spacing: 4rpx; }
.pv-tip { display: block; margin-top: 10rpx; font-size: 22rpx; color: #aaa; }

.role-card { margin-top: 40rpx; padding: 48rpx 36rpx; background: #fff; border: 4rpx solid #FF6B81; border-radius: 28rpx; text-align: center; }
.role-badge { display: inline-block; padding: 10rpx 32rpx; color: #fff; font-size: 44rpx; font-weight: 700;
              letter-spacing: 4rpx; border-radius: 40rpx; }
.role-name { display: block; margin-top: 24rpx; font-size: 32rpx; color: #333; }
.role-tags { display: flex; justify-content: center; margin-top: 24rpx; }
.tag { margin: 0 10rpx; padding: 6rpx 22rpx; font-size: 24rpx; color: #b07a86; background: #FFF0F2; border-radius: 24rpx; }
.role-line { display: block; margin-top: 32rpx; font-size: 28rpx; color: #666; line-height: 1.6; }
.role-hint { display: block; margin-top: 20rpx; font-size: 22rpx; color: #bbb; }

.save-btn { margin-top: 48rpx; height: 88rpx; line-height: 88rpx; background: #FF6B81; color: #fff;
            border-radius: 44rpx; font-size: 32rpx; }
.retest { display: block; margin-top: 28rpx; text-align: center; font-size: 26rpx; color: #999; }
.tip { display: block; margin-top: 20rpx; text-align: center; font-size: 24rpx; color: #e74c3c; }
</style>
