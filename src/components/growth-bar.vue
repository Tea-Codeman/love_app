<template>
  <!-- 关系成长进度（M3.2）
       只做展示：阶段由 growthValue 读时派生（src/utils/growth.js），
       与服务端 pairs 阈值 12/40/90/150 一致，不读 pairs.stage 缓存，避免漂移。
       未产生成长值（0）时不渲染，避免给「还没玩过」的候选塞一条空进度条。
       视觉：5 阶段旅程轨道（S0→S4），节点按阈值定位，当前节点呼吸脉冲。 -->
  <view class="growth-bar anim-in" v-if="value > 0">
    <view class="gb-head">
      <view class="gb-stage">
        <text class="gb-stage-dot"></text>
        <text class="gb-stage-label">{{ info.label }}</text>
      </view>
      <text class="gb-value">成长 {{ value }}</text>
    </view>

    <view class="gb-track">
      <view class="gb-fill" :style="{ width: fillPct + '%' }"></view>
      <view
        v-for="(n, i) in nodes"
        :key="n.stage"
        class="gb-node"
        :class="{ done: i <= curIdx, current: i === curIdx }"
        :style="{ left: n.pos + '%' }"
      >
        <text class="gb-node-dot"></text>
      </view>
    </view>

    <!-- 标签绝对定位到节点位置；首尾不居中，避免溢出容器 -->
    <view class="gb-labels">
      <text
        v-for="(n, i) in nodes"
        :key="n.stage"
        class="gb-label"
        :class="{ active: i <= curIdx, 'is-first': i === 0, 'is-last': i === nodes.length - 1 }"
        :style="{ left: n.pos + '%' }"
      >{{ n.label }}</text>
    </view>

    <text class="gb-next" :class="{ max: remain === 0 }">
      <template v-if="remain > 0">再得 {{ remain }} 成长值解锁「{{ nextLabel }}」</template>
      <template v-else>已到最高阶段 · 可解锁联系方式</template>
    </text>
  </view>
</template>

<script>
import { stageOf, stageInfo, toNextStage, STAGE_THRESHOLDS } from '../utils/growth'

// 阶段顺序（S0→S4）
const ORDER = ['S0', 'S1', 'S2', 'S3', 'S4']

// 节点在轨道上的百分比位置：均匀排布。
// 不按真实阈值（0/12/40/90/150 → 0/8/27/60/100%）定位，是因为 S0 与 S1 仅差 8%，
// 两个 4 字标签（约 72rpx）会挤在一起重叠，且标签与节点对不齐。
const NODE_POS = [0, 25, 50, 75, 100]
// 各阶段阈值（升序，与 NODE_POS 一一对应）
const SEG_MIN = ORDER.map(s => (STAGE_THRESHOLDS.find(t => t.stage === s) || {}).min || 0)

// 成长值 → 轨道百分比（按阶段区间分段线性插值）
// 均匀排布后若仍按 value/150 直算，会出现「已到 S2 但填充条还没走到 S2 节点」的语义错位；
// 分段插值保证：成长值刚好达到某阶段阈值时，填充条正好抵达该阶段节点。
function valueToPos(v) {
  const last = SEG_MIN.length - 1
  for (let i = last; i >= 0; i--) {
    if (v >= SEG_MIN[i]) {
      if (i === last) return NODE_POS[i]
      const span = SEG_MIN[i + 1] - SEG_MIN[i]
      const ratio = span > 0 ? (v - SEG_MIN[i]) / span : 1
      return NODE_POS[i] + ratio * (NODE_POS[i + 1] - NODE_POS[i])
    }
  }
  return 0
}

const NODES = ORDER.map((stage, i) => {
  const t = STAGE_THRESHOLDS.find(x => x.stage === stage)
  return { stage, label: t ? t.label : stage, pos: NODE_POS[i] }
})

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
    remain() {
      return toNextStage(this.value)
    },
    nextLabel() {
      const idx = STAGE_THRESHOLDS.findIndex(t => t.stage === this.stage)
      const next = STAGE_THRESHOLDS[idx - 1]
      return next ? next.label : ''
    },
    nodes() {
      return NODES
    },
    curIdx() {
      return Math.max(0, ORDER.indexOf(this.stage))
    },
    fillPct() {
      return Math.max(0, Math.min(100, Math.round(valueToPos(this.value))))
    }
  }
}
</script>

<style>
.growth-bar { margin-top: 14rpx; padding: 0 16rpx; }
.gb-head { display: flex; align-items: center; justify-content: space-between; }
.gb-stage { display: flex; align-items: center; }
.gb-stage-dot {
  width: 16rpx; height: 16rpx; border-radius: 50%;
  background: var(--grad-primary, linear-gradient(135deg,#FF8A65,#F43F6A));
  margin-right: 10rpx;
  box-shadow: 0 0 0 6rpx rgba(244,63,106,.12);
}
.gb-stage-label { font-size: 24rpx; color: var(--brand-600,#E11D54); font-weight: 700; }
.gb-value { font-size: 20rpx; color: var(--ink-400,#A89FA8); }

.gb-track {
  position: relative;
  height: 14rpx;
  background: var(--brand-100,#FFE3E9);
  border-radius: 14rpx;
  margin: 26rpx 0 8rpx;
}
.gb-fill {
  position: absolute; left: 0; top: 0; height: 100%;
  background: var(--grad-primary, linear-gradient(135deg,#FF8A65,#F43F6A));
  border-radius: 14rpx;
  transition: width .4s ease;
}
.gb-node {
  position: absolute; top: 50%; transform: translate(-50%, -50%);
  width: 28rpx; height: 28rpx; border-radius: 50%;
  background: #fff; border: 3rpx solid var(--brand-200,#FECDD6);
  display: flex; align-items: center; justify-content: center;
}
.gb-node-dot { width: 12rpx; height: 12rpx; border-radius: 50%; background: transparent; }
.gb-node.done { border-color: var(--brand-500,#F43F6A); }
.gb-node.done .gb-node-dot { background: var(--grad-primary, linear-gradient(135deg,#FF8A65,#F43F6A)); }
.gb-node.current {
  border-color: var(--brand-500,#F43F6A);
  animation: pulseRing 1.6s infinite;
}
.gb-node.current .gb-node-dot { background: var(--grad-primary, linear-gradient(135deg,#FF8A65,#F43F6A)); }

/* 标签容器与轨道同宽（都占 growth-bar 内容盒），保证 left:X% 与节点 left:X% 对齐 */
.gb-labels { position: relative; height: 34rpx; margin-top: 10rpx; }
.gb-label {
  position: absolute; top: 0;
  white-space: nowrap;
  font-size: 18rpx; color: var(--ink-400,#A89FA8);
  transform: translateX(-50%);
}
/* 首尾标签贴边对齐，否则会有一半溢出容器 */
.gb-label.is-first { transform: translateX(0); }
.gb-label.is-last { transform: translateX(-100%); }
.gb-label.active { color: var(--brand-600,#E11D54); font-weight: 600; }

.gb-next { font-size: 20rpx; color: var(--ink-500,#7A7280); margin-top: 10rpx; display: block; }
.gb-next.max { color: var(--brand-600,#E11D54); font-weight: 600; }
</style>
