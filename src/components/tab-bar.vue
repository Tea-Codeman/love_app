<template>
  <view class="tab-bar">
    <view
      v-for="t in nav"
      :key="t.key"
      class="tab-item"
      :class="[{ active: isActive(t.key) }, { fab: t.fab }]"
      @tap="go(t)"
    >
      <image
        v-if="t.fab"
        class="fab-icon"
        :src="icon(t.key, '#fff')"
        mode="aspectFit"
      ></image>
      <image
        v-else
        class="tab-icon"
        :src="icon(t.key, isActive(t.key) ? '#E11D54' : '#A89FA8')"
        mode="aspectFit"
      ></image>
      <text class="tab-label" :class="{ active: isActive(t.key) }">{{ t.label }}</text>
    </view>
  </view>
</template>

<script>
import { svgIcon } from '../utils/icons'

// 底部导航（5 项，一起玩居中突出）。非 tabBar 注册模式下用 reLaunch 切换顶层页；
// 深层页（详情/聊天/游戏房）不挂此组件。current 由所在页传入以高亮。
// 顺序即视觉顺序：主页 · 社区 · 一起玩(居中) · 关系 · 我的。
// 「设置」已下放到「我的」页内（齿轮按钮进入），不再占导航位。
// 「一起玩」指向匹配破冰中枢页 /pages/match/match（在此页内才创建对局跳 game.vue），
// 故不再单独设「匹配」侧Tab，避免两处指向同一页造成的重复入口。
const NAV = [
  { key: 'home', label: '主页', url: '/pages/index/index' },
  { key: 'community', label: '社区', url: '/pages/community/community' },
  { key: 'game', label: '一起玩', url: '/pages/match/match', fab: true },
  { key: 'relation', label: '关系', url: '/pages/relation/relation' },
  { key: 'profile', label: '我的', url: '/pages/profile/profile' }
]

export default {
  name: 'tab-bar',
  props: {
    current: { type: String, default: '' }
  },
  data() {
    return { nav: NAV }
  },
  methods: {
    icon(key, color) {
      return svgIcon(key, color)
    },
    isActive(key) {
      // match.vue 把 current 设为 'game'，与「一起玩」key 对齐
      return this.current === key
    },
    go(t) {
      if (!t) return
      uni.reLaunch({ url: t.url })
    }
  }
}
</script>

<style scoped>
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
.tab-label.active { color: #E11D54; font-weight: 600; }

/* 居中突出的「一起玩」CTA：圆形渐变图标按钮 + 文字在圆下方 */
.tab-item.fab {
  flex: 0 0 110rpx;
  height: auto;
  position: relative;
  top: -16rpx;
  justify-content: flex-start;
}
.tab-item.fab:active { transform: scale(.94); }
.tab-item.fab .fab-icon {
  width: 88rpx; height: 88rpx;
  padding: 16rpx;
  box-sizing: border-box;
  border-radius: 50%;
  background: var(--grad-primary, linear-gradient(135deg,#FF8A65,#F43F6A));
  border: 5rpx solid #fff;
  box-shadow: 0 10rpx 26rpx rgba(244,63,106,.45);
}
.tab-item.fab .tab-label {
  color: #E11D54;
  font-weight: 600;
  margin-top: 4rpx;
}
</style>
