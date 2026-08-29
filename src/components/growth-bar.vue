<template>
  <!-- 关系成长进度条（M3.2）
       只做展示：阶段由 growthValue 读时派生（src/utils/growth.js），
       与服务端 pairs 阈值 12/40/90/150 一致，不读 pairs.stage 缓存，避免漂移。
       未产生成长值（0）时不渲染，避免给「还没玩过」的候选塞一条空进度条。 -->
  <view class="growth-bar" v-if="value > 0">
    <view class="gb-head">
      <text class="gb-stage">{{ info.label }}</text>
      <text class="gb-value">成长 {{ value }}</text>
    </view>
    <view class="gb-track">
      <view class="gb-fill" :style="{ width: pct + '%' }"></view>
    </view>
    <text class="gb-next" v-if="remain > 0">再得 {{ remain }} 成长值解锁「{{ nextLabel }}」</text>
    <text class="gb-next max" v-else>已到最高阶段 · 可解锁联系方式</text>
  </view>
</template>

<script>
import { stageOf, stageInfo, stageProgress, toNextStage, STAGE_THRESHOLDS } from '../utils/growth'

export default {
  name: 'growth-bar',
  props: {
    // 成长值（来自 pairs.growthValue）
    growthValue: { type: [Number, String], default: 0 }
  },
  computed: {
    value() {
      return Number(this.growthValue) || 0
    },
    stage() {
      return stageOf(this.value)
    },
    info() {
      return stageInfo(this.stage)
    },
    pct() {
      return stageProgress(this.value)
    },
    remain() {
      return toNextStage(this.value)
    },
    nextLabel() {
      const idx = STAGE_THRESHOLDS.findIndex(t => t.stage === this.stage)
      const next = STAGE_THRESHOLDS[idx - 1]
      return next ? next.label : ''
    }
  }
}
</script>

<style>
.growth-bar { margin-top: 8rpx; }
.gb-head { display: flex; align-items: baseline; justify-content: space-between; }
.gb-stage { font-size: 20rpx; color: #FF6B81; font-weight: 600; }
.gb-value { font-size: 20rpx; color: #bbb; }
.gb-track {
  height: 8rpx;
  background: #f2f2f2;
  border-radius: 8rpx;
  overflow: hidden;
  margin-top: 6rpx;
}
.gb-fill {
  height: 100%;
  background: linear-gradient(90deg, #FFB199, #FF6B81);
  border-radius: 8rpx;
  transition: width 0.3s ease;
}
.gb-next { font-size: 18rpx; color: #aaa; margin-top: 4rpx; display: block; }
.gb-next.max { color: #FF6B81; }
</style>
