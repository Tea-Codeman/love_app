<template>
  <view class="quiz">
    <text class="prompt">{{ question.prompt }}</text>
    <view class="options">
      <view
        class="option"
        v-for="(opt, i) in question.options"
        :key="i"
        :class="{ chosen: chosen === i }"
        @click="onPick(i)"
      >{{ opt }}</view>
    </view>
  </view>
</template>

<script>
// 题目卡：避免用原生事件名（如 tap/click）发 $emit，必须声明 emits（M1 双触发教训）
export default {
  name: 'quiz',
  emits: ['answer'],
  props: {
    question: { type: Object, required: true },
    chosen: { type: Number, default: -1 }
  },
  methods: {
    onPick(i) {
      this.$emit('answer', i)
    }
  }
}
</script>

<style>
.quiz { background: #fff; border-radius: 20rpx; padding: 32rpx; margin: 20rpx 24rpx; box-shadow: 0 4rpx 16rpx rgba(255, 107, 129, 0.08); }
.prompt { font-size: 34rpx; color: #333; font-weight: 600; display: block; margin-bottom: 24rpx; line-height: 1.4; }
.options { display: flex; flex-direction: column; }
.option {
  font-size: 30rpx;
  color: #444;
  background: #faf3f4;
  border: 2rpx solid #f3e2e5;
  border-radius: 16rpx;
  padding: 24rpx 28rpx;
  margin-bottom: 18rpx;
}
.option.chosen { background: #FF6B81; color: #fff; border-color: #FF6B81; }
</style>
