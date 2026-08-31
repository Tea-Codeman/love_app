<template>
  <view class="report">
    <view class="target">举报对象：{{ targetType === 'user' ? '用户' : '帖子' }}</view>
    <view class="field">
      <text class="label">原因</text>
      <textarea class="reason" v-model="reason" maxlength="200" placeholder="请描述举报原因（选填）"></textarea>
    </view>
    <button class="submit" :loading="submitting" @click="onSubmit">提交举报</button>
    <button class="block-btn" v-if="canBlock" @click="onBlock">拉黑该用户</button>
    <text class="tip" v-if="msg">{{ msg }}</text>
  </view>
</template>

<script>
import { callFunction } from '../../utils/request'

export default {
  data() {
    return {
      targetType: 'post',
      targetId: '',
      reason: '',
      canBlock: false,
      submitting: false,
      msg: ''
    }
  },
  onLoad(options) {
    this.targetType = options.targetType || 'post'
    this.targetId = options.targetId || ''
    // 仅当用户类目标（targetId 为对方 openid）才显示拉黑
    this.canBlock = this.targetType === 'user'
  },
  methods: {
    async onSubmit() {
      this.msg = ''
      if (!this.targetId) { this.msg = '缺少举报目标'; return }
      this.submitting = true
      const r = await callFunction('safety', {
        action: 'report',
        targetType: this.targetType,
        targetId: this.targetId,
        reason: this.reason
      })
      this.submitting = false
      if (!r.ok) { this.msg = r.message || '举报失败'; return }
      uni.showToast({ title: '举报已提交', icon: 'success' })
      setTimeout(() => uni.navigateBack(), 600)
    },
    async onBlock() {
      const r = await callFunction('safety', { action: 'block', targetId: this.targetId })
      if (!r.ok) { this.msg = r.message || '拉黑失败'; return }
      uni.showToast({ title: '已拉黑', icon: 'success' })
    }
  }
}
</script>

<style>
.report { padding: 32rpx; background: var(--bg, #FFFAFB); min-height: 100vh; }
.target { font-size: 26rpx; color: #888; margin-bottom: 24rpx; }
.field { display: flex; }
.label { width: 100rpx; font-size: 28rpx; color: #555; }
.reason { flex: 1; height: 200rpx; background: #fff; border-radius: 12rpx; padding: 20rpx; font-size: 28rpx; }
.submit { margin-top: 40rpx; height: 88rpx; line-height: 88rpx; background: var(--brand-500, #F43F6A); color: #fff; border-radius: 44rpx; font-size: 32rpx; }
.block-btn { margin-top: 24rpx; height: 88rpx; line-height: 88rpx; background: #fff; color: #e74c3c; border: 2rpx solid #e74c3c; border-radius: 44rpx; font-size: 32rpx; }
.tip { display: block; text-align: center; margin-top: 20rpx; font-size: 24rpx; color: #e74c3c; }
</style>
