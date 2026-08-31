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
.quiz {
  background: #fff; border: 1rpx solid var(--border, #FBE1E7);
  border-radius: var(--r-lg, 32rpx); padding: 36rpx 32rpx; margin: 20rpx 24rpx;
  box-shadow: var(--shadow, 0 8rpx 24rpx rgba(244,63,106,.10));
}
.prompt { font-size: 36rpx; color: var(--ink-900, #2B2330); font-weight: 700; display: block; margin-bottom: 28rpx; line-height: 1.45; font-family: var(--font-display); }
.options { display: flex; flex-direction: column; }
.option {
  font-size: 30rpx; color: var(--ink-700, #4A4250);
  background: var(--brand-50, #FFF1F4);
  border: 2rpx solid var(--brand-100, #FFE3E9);
  border-radius: var(--r, 24rpx);
  padding: 26rpx 28rpx;
  margin-bottom: 18rpx;
  transition: all .18s ease;
}
.option:active { transform: scale(.98); }
.option.chosen {
  background: var(--grad-primary, linear-gradient(135deg, #FF8A65, #F43F6A));
  color: #fff; border-color: transparent; font-weight: 600;
  box-shadow: var(--shadow-glow, 0 8rpx 24rpx rgba(244,63,106,.3));
}
</style>
