<template>
  <view class="home">
    <!-- 装饰：柔和光斑（纯 CSS，无位图，不随内容撑高） -->
    <view class="deco deco-a"></view>
    <view class="deco deco-b"></view>

    <!-- ===== 未登录：引导卡 ===== -->
    <view class="hero hero--guest anim-in" v-if="!openid">
      <image class="guest-logo" src="/static/logo.png" mode="aspectFit"></image>
      <text class="guest-title">恋爱成长</text>
      <text class="guest-sub">登录后，这里会变成你的专属名片</text>
      <button class="btn btn--block guest-btn" @click="goLogin">微信一键登录</button>
    </view>

    <!-- ===== 已登录：个人名片主页 ===== -->
    <block v-else>
      <!-- 1. 身份卡 -->
      <view class="hero anim-in">
        <view class="avatar-ring">
          <image class="avatar" :src="avatar" mode="aspectFill" @click="goProfile"></image>
        </view>
        <text class="nick">{{ nick }}</text>
        <view class="chips">
          <text class="meta-chip" v-for="(m, i) in metaChips" :key="i">{{ m }}</text>
        </view>
        <text class="bio" v-if="bio">{{ bio }}</text>
        <text class="bio bio--empty" v-else>写一句签名，让别人一眼记住你</text>

        <!-- 资料完整度：把「还差什么」变成可见进度，而不是一句灰字提示 -->
        <view class="comp" @click="goProfile">
          <view class="comp-head">
            <text class="comp-label">资料完整度</text>
            <text class="comp-pct">{{ completion }}%</text>
          </view>
          <view class="comp-track">
            <view class="comp-fill" :style="{ width: completion + '%' }"></view>
          </view>
          <text class="comp-tip">{{ compTip }}</text>
        </view>
      </view>

      <!-- 2. MBTI 角色卡（有测评分色彩主题，未测评则引导） -->
      <view class="section-title anim-in" :style="delay('.06s')">我的角色</view>
      <view class="card role anim-in" :style="roleStyle" @click="goMbti">
        <view class="role-top">
          <view class="role-id">
            <text class="role-name" :class="{ 'role-name--empty': !mbti }">{{ mbti ? role.name : '测测你的恋爱角色' }}</text>
            <text class="role-animal" v-if="mbti">{{ role.animal }}</text>
          </view>
          <view class="role-type" :style="typeStyle">{{ mbti || '未测评' }}</view>
        </view>
        <!-- 未测评时不渲染角色卡内容：getRole 会回退到首个预设，直接渲染等于凭空给用户安一个角色 -->
        <view class="role-tags" v-if="mbti">
          <text class="role-tag" v-for="(t, i) in roleTags" :key="i" :style="tagTint(i)">{{ t }}</text>
        </view>
        <text class="role-line">{{ mbti ? role.line : '12 道题，看看你在感情里是什么模样。' }}</text>
        <view class="role-foot">
          <text class="role-hint">{{ mbti ? '重新测一次' : '花 1 分钟测出你的恋爱角色' }}</text>
          <text class="role-arrow">›</text>
        </view>
      </view>

      <!-- 3. 兴趣标签云 -->
      <view class="section-title anim-in" :style="delay('.12s')">我的兴趣</view>
      <view class="card tags-card anim-in" :style="delay('.12s')" @click="goProfile">
        <view class="tag-cloud" v-if="tags.length">
          <text class="tag" v-for="(t, i) in tags" :key="i" :style="tagTint(i)">{{ t }}</text>
        </view>
        <view class="tag-empty" v-else>
          <image class="tag-empty-art" :src="icon('sparkle', '#FBA3B2')" mode="aspectFit"></image>
          <text class="tag-empty-text">还没有兴趣标签，去「我的」加几个，匹配会更准</text>
        </view>
      </view>

      <!-- 4. 资料明细（图标 + 数值，替代原先的纯文本列表） -->
      <view class="section-title anim-in" :style="delay('.18s')">我的资料</view>
      <view class="card info-card anim-in" :style="delay('.18s')">
        <view class="info-item" v-for="it in infoList" :key="it.key">
          <view class="info-icon-wrap" :style="{ background: it.tint }">
            <image class="info-icon" :src="icon(it.icon, it.color)" mode="aspectFit"></image>
          </view>
          <view class="info-text">
            <text class="info-label">{{ it.label }}</text>
            <text class="info-value" :class="{ 'is-empty': !it.filled }">{{ it.value }}</text>
          </view>
        </view>
      </view>
    </block>

    <tab-bar current=""></tab-bar>
  </view>
</template>

<script>
import { getOpenid, getUser } from '../../utils/storage'
import { refreshUser } from '../../utils/auth'
import { getRole } from '../../utils/mbti'
import { svgIcon } from '../../utils/icons'
import tabBar from '../../components/tab-bar.vue'

// 标签云配色：淡底 + 深字（对比度均 ≥4.5:1，不靠颜色单独传递信息，文字本身可读）
const TINTS = [
  { bg: 'rgba(244,63,106,.10)', fg: '#E11D54' },
  { bg: 'rgba(139,92,246,.10)', fg: '#7C3AED' },
  { bg: 'rgba(245,158,11,.14)', fg: '#B45309' },
  { bg: 'rgba(16,185,129,.10)', fg: '#047857' }
]

// #RRGGBB → rgba()，用于把角色主题色当淡底/描边用（不依赖 8 位十六进制与 CSS 变量注入）
function rgba(hex, a) {
  const h = String(hex || '').replace('#', '')
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h
  const n = parseInt(full, 16)
  if (isNaN(n)) return 'rgba(244,63,106,' + a + ')'
  return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')'
}

export default {
  components: { tabBar },
  data() {
    return {
      openid: '',
      user: null,
      refreshing: false
    }
  },
  computed: {
    p() { return this.user || {} },
    nick() { return this.p.nickname || '还没起名字' },
    avatar() { return this.p.avatarUrl || '/static/logo.png' },
    bio() { return this.p.bio || '' },
    tags() { return this.p.interestTags || [] },
    mbti() { return this.p.mbti || '' },
    role() { return getRole(this.mbti) },
    roleTags() { return String(this.role.tags || '').split('·').filter(Boolean) },
    genderText() { return ['保密', '男', '女'][this.p.gender || 0] || '' },
    metaChips() {
      const out = []
      if (this.genderText && (this.p.gender || 0) > 0) out.push(this.genderText)
      if (this.p.age) out.push(this.p.age + ' 岁')
      if (this.p.city) out.push(this.p.city)
      return out
    },
    // 完整度：8 项核心资料，缺失项直接点名，比一句「去完善」更有行动指引
    missing() {
      const p = this.p
      const m = []
      if (!p.avatarUrl) m.push('头像')
      if (!p.nickname) m.push('昵称')
      if (!(p.gender > 0)) m.push('性别')
      if (!p.age) m.push('年龄')
      if (!p.city) m.push('城市')
      if (!(this.tags.length)) m.push('兴趣')
      if (!this.mbti) m.push('MBTI')
      if (!this.bio) m.push('签名')
      return m
    },
    completion() { return Math.round(((8 - this.missing.length) / 8) * 100) },
    compTip() {
      if (!this.missing.length) return '资料已完整，你会更容易被看见'
      return '还差 ' + this.missing.length + ' 项：' + this.missing.slice(0, 3).join('、') + (this.missing.length > 3 ? ' 等' : '')
    },
    infoList() {
      return [
        { key: 'city', icon: 'city', label: '城市', value: this.p.city || '未填写', filled: !!this.p.city, color: '#E11D54', tint: 'rgba(244,63,106,.10)' },
        { key: 'age', icon: 'age', label: '年龄', value: this.p.age ? this.p.age + ' 岁' : '未填写', filled: !!this.p.age, color: '#7C3AED', tint: 'rgba(139,92,246,.10)' },
        { key: 'gender', icon: 'gender', label: '性别', value: this.genderText && (this.p.gender || 0) > 0 ? this.genderText : '未填写', filled: (this.p.gender || 0) > 0, color: '#B45309', tint: 'rgba(245,158,11,.12)' },
        { key: 'wechat', icon: 'wechat', label: '微信号', value: this.p.wechatId || '未填写', filled: !!this.p.wechatId, color: '#047857', tint: 'rgba(16,185,129,.10)' }
      ]
    },
    roleStyle() {
      // 未测评时不要借用 getRole 的回退色（那是 INTJ 的主题色，会误导）
      const c = this.mbti ? this.role.color : '#F43F6A'
      return {
        background: 'linear-gradient(135deg,' + rgba(c, .14) + ',' + rgba(c, .04) + ')',
        borderColor: rgba(c, .28),
        animationDelay: '.06s'
      }
    },
    typeStyle() {
      return { background: this.mbti ? this.role.color : 'rgba(168,159,168,.18)', color: this.mbti ? '#fff' : '#7A7280' }
    }
  },
  onShow() {
    this.openid = getOpenid()
    this.user = getUser()
    this.syncProfile()
  },
  methods: {
    icon(name, color) { return svgIcon(name, color) },
    // 入场 stagger 延迟：WXSS 不支持 nth-child，也没法用 media query，只能走内联样式
    delay(ms) { return { animationDelay: ms } },
    tagTint(i) {
      const t = TINTS[i % TINTS.length]
      return { background: t.bg, color: t.fg }
    },
    // 先用本地缓存渲染，再用服务端数据校正；失败静默，保留缓存不打断页面
    async syncProfile() {
      if (!this.openid || this.refreshing) return
      this.refreshing = true
      try {
        const u = await refreshUser()
        if (u) this.user = u
      } catch (e) {
        // 网络异常不提示：本地缓存已渲染，主页不该弹错误
      } finally {
        this.refreshing = false
      }
    },
    goProfile() {
      uni.navigateTo({ url: '/pages/profile/profile' })
    },
    goMbti() {
      uni.navigateTo({ url: '/pages/profile/mbti' })
    },
    goLogin() {
      uni.reLaunch({ url: '/pages/login/login' })
    }
  }
}
</script>

<style>
.home {
  position: relative;
  overflow: hidden;
  min-height: 100vh;
  background: var(--grad-soft, linear-gradient(180deg, #FFF1F4, #FFFAFB));
  padding: 24rpx 0 200rpx;
  box-sizing: border-box;
}

/* ---------- 装饰光斑 ---------- */
.deco { position: absolute; border-radius: 50%; }
.deco-a {
  top: -140rpx; right: -100rpx;
  width: 380rpx; height: 380rpx;
  background: linear-gradient(135deg, rgba(255, 138, 101, .26), rgba(244, 63, 106, .14));
}
.deco-b {
  top: 220rpx; left: -140rpx;
  width: 300rpx; height: 300rpx;
  background: linear-gradient(135deg, rgba(244, 63, 106, .16), rgba(255, 138, 101, .08));
}

/* ---------- 身份卡 ---------- */
.hero {
  position: relative;
  margin: 24rpx 32rpx 8rpx;
  padding: 48rpx 32rpx 32rpx;
  background: var(--surface, #FFFFFF);
  border: 1rpx solid var(--border, #FBE1E7);
  border-radius: 40rpx;
  box-shadow: var(--shadow-lg, 0 16rpx 40rpx rgba(244, 63, 106, .16));
  display: flex;
  flex-direction: column;
  align-items: center;
}
.avatar-ring {
  width: 156rpx; height: 156rpx;
  border-radius: 50%;
  background: var(--grad-primary, linear-gradient(135deg, #FF8A65, #F43F6A));
  display: flex; align-items: center; justify-content: center;
  box-shadow: var(--shadow-glow, 0 8rpx 24rpx rgba(244, 63, 106, .35));
  transition: transform .12s ease;
}
.avatar-ring:active { transform: scale(.96); }
.avatar {
  width: 144rpx; height: 144rpx;
  border-radius: 50%;
  border: 5rpx solid #fff;
  background: var(--brand-50, #FFF1F4);
}
.nick {
  margin-top: 20rpx;
  font-size: 40rpx; font-weight: 700;
  color: var(--ink-900, #2B2330);
  font-family: var(--font-display);
  line-height: 1.3;
}
.chips {
  display: flex; flex-wrap: wrap; justify-content: center;
  margin-top: 14rpx;
}
.meta-chip {
  font-size: 22rpx; color: var(--brand-600, #E11D54);
  background: var(--brand-50, #FFF1F4);
  border: 1rpx solid var(--brand-100, #FFE3E9);
  padding: 4rpx 18rpx; border-radius: 999rpx;
  margin: 0 8rpx 8rpx 0;
  line-height: 1.5;
}
.bio {
  margin: 12rpx 16rpx 0;
  font-size: 26rpx; color: var(--ink-500, #7A7280);
  text-align: center; line-height: 1.6;
}
.bio--empty { color: var(--ink-400, #A89FA8); }

/* ---------- 资料完整度 ---------- */
.comp {
  width: 100%;
  margin-top: 32rpx;
  padding: 20rpx 24rpx 18rpx;
  background: var(--brand-50, #FFF1F4);
  border-radius: var(--r, 24rpx);
  transition: transform .12s ease;
}
.comp:active { transform: scale(.98); }
.comp-head { display: flex; align-items: center; justify-content: space-between; }
.comp-label { font-size: 24rpx; color: var(--ink-700, #4A4250); font-weight: 600; }
.comp-pct { font-size: 26rpx; font-weight: 700; color: var(--brand-600, #E11D54); }
.comp-track {
  margin-top: 12rpx;
  height: 12rpx; border-radius: 999rpx;
  background: rgba(244, 63, 106, .14);
  overflow: hidden;
}
.comp-fill {
  height: 100%; border-radius: 999rpx;
  background: var(--grad-primary, linear-gradient(135deg, #FF8A65, #F43F6A));
  transition: width .4s ease;
}
.comp-tip { display: block; margin-top: 12rpx; font-size: 22rpx; color: var(--ink-500, #7A7280); line-height: 1.5; }

/* ---------- MBTI 角色卡 ---------- */
.role { margin: 0 32rpx; padding: 28rpx 28rpx 24rpx; }
.role-top { display: flex; align-items: center; justify-content: space-between; }
.role-id { display: flex; flex-direction: column; }
.role-name { font-size: 38rpx; font-weight: 700; color: var(--ink-900, #2B2330); font-family: var(--font-display); }
.role-name--empty { font-size: 32rpx; }
.role-animal { font-size: 22rpx; color: var(--ink-400, #A89FA8); margin-top: 2rpx; }
.role-type {
  font-size: 24rpx; font-weight: 700; color: #fff;
  padding: 8rpx 22rpx; border-radius: 999rpx;
  letter-spacing: 1rpx;
}
.role-tags { display: flex; flex-wrap: wrap; margin-top: 18rpx; }
.role-tag {
  font-size: 22rpx; font-weight: 600;
  padding: 6rpx 18rpx; border-radius: 999rpx;
  margin: 0 12rpx 10rpx 0;
  line-height: 1.5;
}
.role-line {
  display: block;
  margin-top: 6rpx;
  font-size: 27rpx; color: var(--ink-700, #4A4250); line-height: 1.7;
}
.role-foot {
  display: flex; align-items: center; justify-content: space-between;
  margin-top: 20rpx; padding-top: 18rpx;
  border-top: 1rpx solid var(--border, #FBE1E7);
}
.role-hint { font-size: 24rpx; color: var(--brand-600, #E11D54); font-weight: 600; }
.role-arrow { font-size: 32rpx; color: var(--ink-400, #A89FA8); }

/* ---------- 兴趣标签云 ---------- */
.tags-card { margin: 0 32rpx; padding: 26rpx 24rpx; }
.tag-cloud { display: flex; flex-wrap: wrap; }
.tag {
  font-size: 25rpx; font-weight: 600;
  padding: 10rpx 24rpx; border-radius: 999rpx;
  margin: 0 14rpx 14rpx 0;
  line-height: 1.5;
}
.tag-empty { display: flex; flex-direction: column; align-items: center; padding: 28rpx 20rpx 20rpx; }
.tag-empty-art { width: 76rpx; height: 76rpx; margin-bottom: 14rpx; }
.tag-empty-text { font-size: 25rpx; color: var(--ink-400, #A89FA8); text-align: center; line-height: 1.6; }

/* ---------- 资料明细 ---------- */
.info-card {
  margin: 0 32rpx;
  padding: 12rpx 8rpx;
  display: flex; flex-wrap: wrap;
}
.info-item {
  width: 50%;
  display: flex; align-items: center;
  padding: 22rpx 16rpx;
  box-sizing: border-box;
}
.info-icon-wrap {
  width: 72rpx; height: 72rpx;
  border-radius: 22rpx;
  display: flex; align-items: center; justify-content: center;
  margin-right: 18rpx;
  flex-shrink: 0;
}
.info-icon { width: 36rpx; height: 36rpx; }
.info-text { display: flex; flex-direction: column; flex: 1; overflow: hidden; }
.info-label { font-size: 22rpx; color: var(--ink-400, #A89FA8); line-height: 1.4; }
.info-value {
  font-size: 28rpx; font-weight: 600; color: var(--ink-900, #2B2330);
  line-height: 1.4;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.info-value.is-empty { color: var(--ink-400, #A89FA8); font-weight: 400; }

/* ---------- 未登录 ---------- */
.hero--guest { padding-bottom: 40rpx; }
.guest-logo {
  width: 160rpx; height: 160rpx; border-radius: 40rpx;
  box-shadow: var(--shadow, 0 8rpx 24rpx rgba(244, 63, 106, .10));
  margin-bottom: 24rpx;
}
.guest-title {
  font-size: 44rpx; font-weight: 700;
  color: var(--brand-600, #E11D54);
  font-family: var(--font-display);
}
.guest-sub { margin-top: 10rpx; font-size: 26rpx; color: var(--ink-500, #7A7280); text-align: center; }
.guest-btn { margin-top: 36rpx; }
.guest-btn::after { border: none; }
</style>
