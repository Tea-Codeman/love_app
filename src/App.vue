<script>
import { initCloud } from './utils/cloud'
import { getOpenid, getPrivacyAgreed, setPendingInviter } from './utils/storage'
import { track, flushTrack } from './utils/track'
import { startInviteWatch, stopInviteWatch, inviteRemain } from './utils/confirmInvite'

// 检测到 B 收到新邀请：原生弹窗通知（任意页面盖顶，绕过「必须停在关系页」的限制）
function handleNewInvite(inv) {
  const pages = getCurrentPages()
  const top = pages[pages.length - 1]
  // 已在关系页：页内自定义富弹窗会自己显示，不再叠原生弹窗
  if (top && top.route === 'pages/relation/relation') return
  const name = (inv.peer && inv.peer.nickname) || 'TA'
  uni.showModal({
    title: '💌 在一起确认邀请',
    content: name + ' 想和你确认在一起\n邀请有效期 ' + inviteRemain(inv) + '，超时将自动失效',
    confirmText: '去处理',
    cancelText: '稍后',
    success: (res) => {
      if (res.confirm) uni.navigateTo({ url: '/pages/relation/relation' })
    }
  })
}

// M5.4（plan-m5.md 决策 4）：app_open 冷启动双计修复。
// 小程序冷启动会依次触发 onLaunch + onShow，此前各报一次 app_open（毫秒级成对）。
// 方案：onLaunch 报后置标记，紧随的首次 onShow 跳过一次上报；之后每次切前台正常报。
let coldLaunching = false

export default {
  onLaunch: function (options) {
    console.log('[app] onLaunch')
    initCloud()
    // 加载品牌圆体字体（失败静默回退系统圆体，不影响功能）
    this.loadBrandFonts()
    // M4.1：`app_open` —— 未来 DAU/启动分析的数据源。
    // 注意：现行 dashboard 的 SC1–SC5 均不消费 app_open（SC2 为 pair 维度 D7 互动留存，见 metrics/index.js）。
    track('app_open')
    coldLaunching = true   // 冷启动标记：下一次 onShow 是 launch 配对事件，跳过上报
    // 邀请裂变（T2）：从分享链接进入时记录邀请人，登录时归因
    if (options && options.query && options.query.inviter) {
      setPendingInviter(options.query.inviter)
    }
    // 隐私门禁：未同意则先走隐私政策（M0.3）
    if (!getPrivacyAgreed()) {
      uni.reLaunch({ url: '/pages/privacy/privacy' })
      return
    }
    // 未登录则走登录（M0.2）
    if (!getOpenid()) {
      uni.reLaunch({ url: '/pages/login/login' })
    }
  },
  onShow: function () {
    console.log('[app] onShow')
    if (coldLaunching) {
      coldLaunching = false   // 冷启动配对的 onShow，跳过本次上报（M5.4）
    } else {
      track('app_open')       // 切前台正常上报（与 onLaunch 合计为启动口径）
    }
    // M4.4 全局邀请投递：登录态下启动应用级轮询，B 在任意页面都能收到 A 的确认邀请
    startInviteWatch(handleNewInvite)
  },
  onHide: function () {
    console.log('[app] onHide')
    // 切后台立即发送攒批队列，避免定时器被挂起导致丢数据
    flushTrack()
    // 后台停轮询，避免无谓请求；切前台 onShow 会重启
    stopInviteWatch()
  },
  methods: {
    // 加载 Varela Round（展示体）+ Nunito Sans（正文体）。
    // 微信小程序需通过 loadFontFace 从网络字体拉取；CDN 不可达时静默失败，
    // 自动回退到 PingFang SC 等系统圆体，不影响任何功能。
    loadBrandFonts() {
      const fonts = [
        { family: 'Varela Round', url: 'https://cdn.jsdelivr.net/gh/google/fonts/ofl/varelaround/VarelaRound-Regular.ttf' },
        { family: 'Nunito Sans', url: 'https://cdn.jsdelivr.net/gh/google/fonts/ofl/nunitosans/NunitoSans%5Bwght%5D.ttf' }
      ]
      // #ifndef MP-WEIXIN
      return
      // #endif
      fonts.forEach(f => {
        try {
          uni.loadFontFace({
            family: f.family,
            source: 'url("' + f.url + '")',
            success: () => console.log('[font] loaded', f.family),
            fail: () => {/* 静默回退 */}
          })
        } catch (e) { /* 忽略 */ }
      })
    }
  }
}
</script>

<style>
/* ===== LoveApp 全局基础层（所有页面继承） ===== */
page {
  /* 色彩令牌 */
  --brand-50:#FFF1F4; --brand-100:#FFE3E9; --brand-200:#FECDD6; --brand-300:#FBA3B2;
  --brand-400:#F7728E; --brand-500:#F43F6A; --brand-600:#E11D54; --brand-700:#BE123C;
  --coral:#FF8A65; --gold-400:#FBBF24; --gold-500:#F59E0B; --violet-500:#8B5CF6;
  --success:#16A34A; --danger:#EF4444;
  --ink-900:#2B2330; --ink-700:#4A4250; --ink-500:#7A7280; --ink-400:#A89FA8;
  --surface:#FFFFFF; --bg:#FFFAFB; --bg-soft:#FFF1F4; --border:#FBE1E7;
  --grad-primary:linear-gradient(135deg,#FF8A65 0%,#F43F6A 55%,#E11D54 100%);
  --grad-soft:linear-gradient(180deg,#FFF1F4 0%,#FFFAFB 100%);
  --shadow-sm:0 2rpx 8rpx rgba(244,63,106,.06);
  --shadow:0 8rpx 24rpx rgba(244,63,106,.10);
  --shadow-lg:0 16rpx 40rpx rgba(244,63,106,.16);
  --shadow-glow:0 8rpx 24rpx rgba(244,63,106,.35);
  /* 间距 / 圆角 */
  --s-1:8rpx; --s-2:12rpx; --s-3:16rpx; --s-4:20rpx; --s-5:24rpx; --s-6:32rpx; --s-8:40rpx; --s-10:48rpx;
  --r-sm:16rpx; --r:24rpx; --r-lg:32rpx; --r-pill:999rpx;
  /* 字体 */
  --font-display:"Varela Round","PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif;
  --font-body:"Nunito Sans","PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif;

  /* 默认字体 / 背景 */
  font-family: var(--font-body);
  font-size: 28rpx;
  color: var(--ink-900);
  line-height: 1.6;
  background: var(--bg);
  -webkit-font-smoothing: antialiased;
}

view, text, button, input, textarea, scroll-view { box-sizing: border-box; }

/* 页面根：暖色背景 + 安全区 */
.app-bg {
  min-height: 100vh;
  background: var(--grad-soft);
  padding-bottom: env(safe-area-inset-bottom);
}
.safe-bottom { padding-bottom: calc(env(safe-area-inset-bottom) + 120rpx); }

/* 标准卡面 */
.card {
  background: var(--surface);
  border: 1rpx solid var(--border);
  border-radius: var(--r-lg);
  box-shadow: var(--shadow);
}

/* 按钮（胶囊、渐变、按压反馈） */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 30rpx;
  font-weight: 600;
  color: #fff;
  background: var(--grad-primary);
  padding: 0 48rpx;
  height: 88rpx;
  line-height: 88rpx;
  border-radius: var(--r-pill);
  box-shadow: var(--shadow-glow);
  transition: transform .12s ease, box-shadow .2s ease, opacity .2s ease;
}
.btn:active { transform: scale(.96); opacity: .94; }
.btn--ghost {
  background: #fff;
  color: var(--brand-600);
  border: 2rpx solid var(--brand-200);
  box-shadow: var(--shadow-sm);
}
.btn--block { width: 100%; }

/* 标签胶囊 */
.chip {
  display: inline-flex;
  align-items: center;
  font-size: 22rpx;
  color: var(--brand-600);
  background: var(--brand-50);
  border: 1rpx solid var(--brand-100);
  padding: 6rpx 18rpx;
  border-radius: var(--r-pill);
  line-height: 1.4;
}

/* 区块标题（左侧品牌短竖条） */
.section-title {
  display: flex;
  align-items: center;
  font-size: 32rpx;
  font-weight: 700;
  color: var(--ink-900);
  margin: 28rpx 32rpx 12rpx;
}
.section-title::before {
  content: '';
  width: 8rpx;
  height: 30rpx;
  border-radius: 8rpx;
  background: var(--grad-primary);
  margin-right: 14rpx;
}

/* 空状态（插画 + 文案） */
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80rpx 60rpx;
  text-align: center;
}
.empty .empty-art {
  width: 200rpx; height: 200rpx;
  margin-bottom: 24rpx;
  opacity: .9;
}
.empty .empty-text { font-size: 26rpx; color: var(--ink-400); }

/* 关键帧 */
@keyframes fadeUp { from { opacity:0; transform: translateY(16rpx); } to { opacity:1; transform:none; } }
@keyframes popIn { from { opacity:0; transform: scale(.92); } to { opacity:1; transform:none; } }
@keyframes pulseRing {
  0% { box-shadow: 0 0 0 0 rgba(244,63,106,.45); }
  70% { box-shadow: 0 0 0 16rpx rgba(244,63,106,0); }
  100% { box-shadow: 0 0 0 0 rgba(244,63,106,0); }
}
@keyframes floatY { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-10rpx); } }

/* 入场动画工具类 */
.anim-in { animation: fadeUp .3s ease both; }

/* 减少动效（prefers-reduced-motion）降级不在样式层实现，原因有二：
   1. WXSS 不支持 `*` 通配符选择器，写 `* { animation: none }` 会导致 app.wxss 整体编译失败；
   2. 小程序 media query 在 WebView 渲染层不生效，Skyline 也仅支持 DarkMode，
      该特性无论如何都拿不到，写了也是死代码。
   若未来需要，应改为 JS 侧读取系统设置后给根节点加 class 来统一关闭动画。 */
</style>
