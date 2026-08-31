# LoveApp 设计系统 · MASTER

> 恋爱成长型社交小程序（uni-app Vue3 + Vite → mp-weixin）的**全局视觉事实来源**。
> 由 `ui-ux-pro-max` 设计情报生成，并经本项目落地校准。页面级覆盖写到 `pages/<page>.md`（本版暂未拆分）。
> 原则：温暖、圆润、柔和、有"关系在生长"的情绪价值。所有尺寸均为 **rpx**（小程序基准 750rpx = 375pt）。

---

## 1. 设计意图（Design Intent）

| 维度 | 决策 |
|------|------|
| 风格 | Vibrant & Soft — 暖玫瑰 + 珊瑚渐变，圆润卡面、柔和分层阴影（claymorphism-lite） |
| 情绪 | 亲切、治愈、期待感；"关系成长"本身是可被看见的进度 |
| 差异化护城河（P4） | **关系成长 S0–S4 可视化** 是签名组件，必须惊艳、有仪式感 |
| 字体 | 展示体 Varela Round（圆体），正文体 Nunito Sans；中文回退 PingFang SC |
| 动效 | 150–300ms 缓动，入场轻微 stagger，点击 scale(.96)；尊重 `prefers-reduced-motion` |
| 无障碍 | 触控目标 ≥ 80rpx；小字用 brand-600（对比 ≥4.5:1）；焦点/按压态可见 |

---

## 2. 色彩 Tokens（CSS 变量，定义在 `App.vue` 全局 `page{}`）

```css
--brand-50:#FFF1F4; --brand-100:#FFE3E9; --brand-200:#FECDD6; --brand-300:#FBA3B2;
--brand-400:#F7728E; --brand-500:#F43F6A; /* Primary */ --brand-600:#E11D54; /* Primary-strong/文字 */
--brand-700:#BE123C;
--coral:#FF8A65;            /* 渐变伙伴色 */
--gold-400:#FBBF24; --gold-500:#F59E0B;  /* 里程碑/成就 */
--violet-500:#8B5CF6;       /* 联系方式解锁/特殊 */
--success:#16A34A; --danger:#EF4444;
--ink-900:#2B2330; --ink-700:#4A4250; --ink-500:#7A7280; --ink-400:#A89FA8;
--surface:#FFFFFF; --bg:#FFFAFB; --bg-soft:#FFF1F4; --border:#FBE1E7;
--grad-primary:linear-gradient(135deg,#FF8A65 0%,#F43F6A 55%,#E11D54 100%);
--grad-soft:linear-gradient(180deg,#FFF1F4 0%,#FFFAFB 100%);
--shadow-sm:0 2rpx 8rpx rgba(244,63,106,.06);
--shadow:0 8rpx 24rpx rgba(244,63,106,.10);
--shadow-lg:0 16rpx 40rpx rgba(244,63,106,.16);
--shadow-glow:0 8rpx 24rpx rgba(244,63,106,.35);
```
用法：组件 `<style>` 中直接 `color: var(--brand-600)`、`background: var(--grad-primary)`。

---

## 3. 排版 Type Scale

| Token | 尺寸 | 用途 |
|-------|------|------|
| 展示标题 | 44–48rpx / 700 | 页面大标题、Logo 名 |
| 区块标题 | 34–38rpx / 700 | Section 标题 |
| 卡片标题 | 30rpx / 600 | 昵称、题干 |
| 正文 | 28rpx / 400 | 默认正文（line-height 1.6） |
| 辅助 | 24rpx / 400 | 副标题、统计 |
| 标注 | 20–22rpx / 500 | 标签、阶段名、时间戳 |

字体栈：`--font-display:"Varela Round","PingFang SC",...`；`--font-body:"Nunito Sans","PingFang SC",...`。
可选 `wx.loadFontFace` 加载 Varela Round / Nunito（见 App.vue），失败回退系统圆体。

---

## 4. 间距 / 圆角 / 阴影

- 间距：`--s-1 8` `--s-2 12` `--s-3 16` `--s-4 20` `--s-5 24` `--s-6 32` `--s-8 40` `--s-10 48`（rpx）
- 圆角：`--r-sm 16` `--r 24` `--r-lg 32` `--r-pill 999`（rpx）
- 卡面：白底、`--r-lg`、1rpx `--border`、`--shadow`；按压态 `--shadow-lg`

---

## 5. 组件库（通用类，定义在 `App.vue` 全局）

| 类 | 作用 |
|----|------|
| `.app-bg` | 页面根：暖色渐变背景 + 安全区 padding |
| `.card` | 标准卡面 |
| `.btn` / `.btn--primary` | 胶囊主按钮（渐变、按压 scale） |
| `.btn--ghost` | 次级按钮（描边/浅底） |
| `.chip` | 标签胶囊（brand-50 底 + brand-600 字） |
| `.section-title` | 区块标题（带左侧品牌短竖条） |
| `.empty` | 空状态（插画 + 文案，非纯灰字） |
| `.safe-bottom` | 底部安全区 padding |

---

## 6. 签名组件：关系成长条（growth-bar）

5 阶段 **S0 陌生 → S1 有点意思 → S2 聊得来的朋友 → S3 有好感 → S4 信任·可加微信**。
- 横向轨道，5 个里程碑节点**均匀排布**在 0/25/50/75/100%。
  ⚠️ 不要按真实阈值（12/40/90/150）折算成 8/27/60/100% 定位：标签是 `flex:1` 均分的
  （中心在 10/30/50/70/90%），两者最大偏差 23 个百分点，且 S0/S1 标签会重叠。
- 填充值用**分段线性映射**：先定位当前阶段区间，再在区间内插值到相邻两节点之间。
  保证「成长值达标」的瞬间填充正好抵达该阶段节点；直算 `value/150` 会出现
  「已到 S2 但填充条还没走到 S2 节点」的语义错位。
- 已抵达节点：实心品牌渐变 + 柔光；当前节点：脉冲呼吸动画。
- 未抵达节点：空心描边。
- 上方显示当前阶段名（品牌色）+ 成长值；下方"再得 X 解锁「下一阶段」"。
- 进度填充用 `--grad-primary`，`transition: width .4s`。
- 值=0 时不渲染（避免给未互动候选塞空条）。

---

## 7. 底部导航（tab-bar，4 键）

社区 · **一起玩(中央突出 CTA)** · 关系 · 我的。
-  removed "匹配" 侧Tab：它与中央"一起玩"都指向匹配破冰同一入口，保留 CTA 更聚焦。
- 中央"一起玩" CTA 指向 `/pages/match/match`（匹配破冰/游戏发起页），而非 `/pages/game/game`
  （后者是具体对局房间，必须带 `gameId` 参数，不能作为导航入口）。
- 固定底部，白底 + 顶部发丝线 + `--shadow-lg`（上投）。
- 选中态：品牌渐变图标 + 品牌字；中央 CTA 为渐变圆形上浮按钮，高亮时放大并增强阴影。
- 用 `uni.reLaunch` 切换（无 tabBar 注册时），深层页（详情/聊天/游戏房）不挂导航条。

---

## 8. 动效 Motion

| 场景 | 参数 |
|------|------|
| 卡片入场 | fadeUp 300ms，`stagger .06s`，ease back.out |
| 按钮按压 | `transform: scale(.96)` 120ms |
| 阶段节点激活 | pulse 1.6s infinite（呼吸） |
| 进度条 | width `.4s ease` |
| 弹窗 | scale .28s back.out + 遮罩淡入 |
| 卡片入场 stagger | WXSS 不支持 `nth-child`，延迟只能走内联 `:style="{ animationDelay }"` |

⚠️ **不要在样式层写 reduced-motion 降级**：WXSS 不支持 `*` 通配符选择器
（写了会让 `app.wxss` 整体编译失败、全局样式全丢），且 media query 在 WebView
渲染层不生效、Skyline 仅支持 DarkMode —— 该特性无论如何都拿不到。
若将来要做，改为 JS 读系统设置后给根节点加 class 统一关闭动画。

---

## 9. 反模式（Avoid）

- ❌ emoji 充当功能图标（文案 emoji 如 💌 仅作情感点缀）
- ❌ 灰色纯文字空状态（需插画/图形 + 引导）
- ❌ 小字用 brand-500（对比不足）→ 小字用 brand-600
- ❌ 直角硬边、重投影（保持圆润 + 柔和分层）
- ❌ 一次性平铺所有信息（渐进披露：S1 才显聊天，S4 才显联系）
- ❌ 横向滚动溢出、固定 px 容器宽度

---

## 10. 落地映射

| 文件 | 改动 |
|------|------|
| `src/uni.scss` | 追加品牌 SCSS 变量层（保留 uni- 默认以兼容插件） |
| `src/App.vue` | 全局 CSS 变量 + 通用类 + 字体加载 + 关键帧 |
| `src/components/growth-bar.vue` | 签名 5 阶段可视化 |
| `src/components/post-card.vue` | 新卡面 |
| `src/components/tab-bar.vue` | 新增底部导航 |
| `src/pages/**` | 仅重写 `<style>`（同类名换新视觉），`<script>` 逻辑不变 |
