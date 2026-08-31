<template>
  <view class="tab-bar">
    <!-- 中央突出 CTA：一起玩（破冰游戏入口） -->
    <view class="tab-fab" :class="{ active: current === 'match' || current === 'game' }" @tap="go('match')">
      <image class="fab-icon" :src="icon('game', '#fff')" mode="aspectFit"></image>
      <text class="fab-text">一起玩</text>
    </view>

    <view
      v-for="t in tabs"
      :key="t.key"
      class="tab-item"
      :class="{ active: current === t.key }"
      @tap="go(t.key)"
    >
      <image class="tab-icon" :src="icon(t.key, current === t.key ? '#F43F6A' : '#A89FA8')" mode="aspectFit"></image>
      <text class="tab-label" :class="{ active: current === t.key }">{{ t.label }}</text>
    </view>
  </view>
</template>

<script>
import { svgIcon } from '../utils/icons'

// 底部导航（≤5）。非 tabBar 注册模式下用 reLaunch 切换顶层页；
// 深层页（详情/聊天/游戏房）不挂此组件。current 由所在页传入以高亮。
const TABS = [
  { key: 'community', label: '社区', url: '/pages/community/community' },
  { key: 'match', label: '匹配', url: '/pages/match/match' },
  { key: 'relation', label: '关系', url: '/pages/relation/relation' },
  { key: 'profile', label: '我的', url: '/pages/profile/profile' }
]

export default {
  name: 'tab-bar',
  props: {
    current: { type: String, default: '' }
  },
  data() {
    return { tabs: TABS }
  },
  methods: {
    icon(key, color) {
      return svgIcon(key, color)
    },
    go(key) {
      const t = key === 'match'
        ? { key, url: '/pages/match/match' }
        : this.tabs.find(x => x.key === key)
      if (!t) return
      uni.reLaunch({ url: t.url })
    }
  }
}
</script>

<style>
.tab-bar {
  position: fixed;
  left: 0; right: 0; bottom: 0;
  z-index: 50;
  display: flex;
  align-items: flex-end;
  justify-content: space-around;
  height: 110rpx;
  padding-bottom: env(safe-area-inset-bottom);
  background: #fff;
  border-top: 1rpx solid var(--border, #FBE1E7);
  box-shadow: 0 -8rpx 30rpx rgba(244,63,106,.10);
}
.tab-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100rpx;
  transition: transform .12s ease;
}
.tab-item:active { transform: scale(.94); }
.tab-icon { width: 44rpx; height: 44rpx; margin-bottom: 4rpx; }
.tab-label { font-size: 20rpx; color: #A89FA8; }
.tab-label.active { color: #F43F6A; font-weight: 600; }

.tab-fab {
  position: relative;
  top: -28rpx;
  width: 116rpx; height: 116rpx;
  border-radius: 50%;
  background: var(--grad-primary, linear-gradient(135deg,#FF8A65,#F43F6A));
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  box-shadow: 0 10rpx 28rpx rgba(244,63,106,.45);
  border: 6rpx solid #fff;
  transition: transform .12s ease;
}
.tab-fab:active { transform: scale(.94); }
.fab-icon { width: 44rpx; height: 44rpx; }
.fab-text { font-size: 20rpx; color: #fff; font-weight: 600; margin-top: 2rpx; }
</style>
