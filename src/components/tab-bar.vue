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
// 底部导航（≤5）。非 tabBar 注册模式下用 reLaunch 切换顶层页；
// 深层页（详情/聊天/游戏房）不挂此组件。current 由所在页传入以高亮。
const TABS = [
  { key: 'community', label: '社区', url: '/pages/community/community' },
  { key: 'match', label: '匹配', url: '/pages/match/match' },
  { key: 'relation', label: '关系', url: '/pages/relation/relation' },
  { key: 'profile', label: '我的', url: '/pages/profile/profile' }
]

// 线性图标路径（24x24，stroke 颜色由 color 注入）
const PATHS = {
  community: "<path d='M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.5-.8L3 21l1.9-5.5A8.38 8.38 0 0 1 4 11.5 8.5 8.5 0 0 1 12.5 3 8.38 8.38 0 0 1 21 11.5z'/>",
  match: "<path d='M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z'/>",
  relation: "<path d='M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1'/><path d='M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1'/>",
  profile: "<path d='M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2'/><circle cx='12' cy='7' r='4'/>",
  game: "<rect x='3' y='3' width='18' height='18' rx='4'/><circle cx='8.5' cy='8.5' r='1.5'/><circle cx='15.5' cy='15.5' r='1.5'/><circle cx='15.5' cy='8.5' r='1.5'/><circle cx='8.5' cy='15.5' r='1.5'/>"
}

export default {
  name: 'tab-bar',
  props: {
    current: { type: String, default: '' }
  },
  data() {
    return { tabs: TABS }
  },
  methods: {
    // 生成可换色的 SVG data URI
    icon(key, color) {
      const svg =
        "<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 24 24' fill='none' stroke='" +
        color +
        "' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'>" +
        (PATHS[key] || '') +
        '</svg>'
      return 'data:image/svg+xml,' + encodeURIComponent(svg)
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
