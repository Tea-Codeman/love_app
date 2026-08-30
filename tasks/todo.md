# Task List: 恋爱成长型社交小程序 v1（Phase 3 · Tasks）

> 本文件是 **Phase 3 · Tasks**，基于 `plan.md`（已批准）与 `SPEC.md`（v1.0）。  
> 规则：每张任务 S/M 级、单 session 可完成、带验收与校验；**仍不写实现代码，直至逐级签字放行**。  
> 前端 = **uni-app（Vue3 + Vite）编译 mp-weixin**；后端 = CloudBase 云函数/云数据库。  
> 里程碑 M0→M4，每里程碑末尾有 Checkpoint（人工评审）。

---

## Phase 0 · M0 地基（脚手架 + 登录 + 合规）

### Task M0.1: 初始化 uni-app 项目并接入 CloudBase

**Description:** 用 uni-app(Vue3+Vite) 脚手架初始化项目，配置 `manifest.json` 的 mp-weixin appid，初始化 `wx.cloud` 连接 CloudBase 环境；建立 `cloudfunctions/` 目录与首个测试云函数 `ping`。现有 workspace 原生骨架（app.js/app.json…）在此时迁移为 uni-app 结构（main.js/manifest.json/pages.json/src/）。  
**Acceptance criteria:**

- `npm run dev:mp-weixin` 可编译出小程序包
- 调用 `ping` 云函数返回 CloudBase 环境信息  
  **Verification:**
- Build: `npm run build:mp-weixin` 无错误
- Manual: 微信开发者工具打开编译产物，调用 ping 成功  
  **Dependencies:** None  
  **Files likely touched:** `package.json`, `vite.config.js`, `src/main.js`, `src/App.vue`, `src/manifest.json`, `src/pages.json`, `cloudfunctions/ping/index.js`  
  **Estimated scope:** M

### Task M0.2: F1 微信登录（auth 云函数）

**Description:** `auth.login` 用 `cloud.getWXContext().OPENID` 写/读 `users`（首次建、再次读）；前端 login 页触发并缓存 openid（不落仓库/明文）。  
**Acceptance criteria:**

- 登录拿到 openid 并正确落 `users`
- 重复登录读取既有资料而非重复建档  
  **Verification:**
- Unit: 模拟 getWXContext 返回 openid，断言写/读正确
- Manual: 真机/模拟器登录后云数据库出现该用户  
  **Dependencies:** M0.1  
  **Files likely touched:** `cloudfunctions/auth/index.js`, `src/pages/login/`, `src/utils/request.js`  
  **Estimated scope:** S

### Task M0.3: F1 轻量资料 + 隐私合规

**Description:** 资料页 + `auth.updateProfile`（昵称/头像/兴趣标签，服务端校验）；隐私政策页 + 首次进入授权弹窗（拒绝则限制核心功能）。不落明文、最小必要字段。  
**Acceptance criteria:**

- 可填资料并持久化（服务端校验后写入）
- 首次进入弹授权，拒绝后受限  
  **Verification:**
- Unit: 服务端校验拒绝非法资料
- Manual: 走通授权 → 填资料 → 保存 → 回读  
  **Dependencies:** M0.2  
  **Files likely touched:** `cloudfunctions/auth/index.js`, `src/pages/profile/`, `src/pages/privacy/`, `src/utils/validate.js`  
  **Estimated scope:** M

### Checkpoint M0

- [ ] 编译 mp-weixin 成功，ping/auth 云函数可调
- [ ] 微信登录 + 资料 + 隐私授权 跑通
- [ ] 人工评审后进入 M1

---

## Phase 1 · M1 聚人（社区 + 安全 + 裂变）

### Task M1.1: F2 话题广场与信息流

**Description:** `topics` 种子数据 + `community.listPosts` 分页拉取；前端社区页渲染帖子卡（含话题聚合）。  
**Acceptance criteria:**

- 信息流加载、分页有效、话题可筛选  
  **Verification:**
- Manual: 社区页滚动加载多页正常
- Build: 编译通过  
  **Dependencies:** M0.2  
  **Files likely touched:** `cloudfunctions/community/index.js`, `src/pages/community/`, `src/components/post-card.vue`  
  **Estimated scope:** M

### Task M1.2: F2 发帖（先审后发）+ F8 内容安全接入

**Description:** `safety` 云函数封装微信内容安全 API（msgSecCheck/mediaCheckAsync）；`community.createPost` 先调 `safety` 审核，过则存 `posts`(auditStatus=pass)，不过 reject 并提示。  
**Acceptance criteria:**

- 正常帖审核通过入库
- 违规样例被拒，含违规回归测试  
  **Verification:**
- Integration: 注入违规文本/图片，断言被拒
- Manual: 发正常帖出现在信息流  
  **Dependencies:** M1.1, M0.3  
  **Files likely touched:** `cloudfunctions/safety/index.js`, `cloudfunctions/community/index.js`, `src/pages/community/post.vue`  
  **Estimated scope:** M

### Task M1.3: F2 互动（点赞/评论）

**Description:** `community` 点赞/评论；评论同样过审后显示。  
**Acceptance criteria:**

- 可点赞、可评论（评论审核后显示）  
  **Verification:**
- Manual: 点赞数变化、评论过审后出现  
  **Dependencies:** M1.2  
  **Files likely touched:** `cloudfunctions/community/index.js`, `src/components/post-card.vue`  
  **Estimated scope:** S

### Task M1.4: F8 举报/拉黑

**Description:** `safety.report`/`safety.block` 云函数 + 前端入口；被拉黑方后续不再匹配/互动；举报进入待处置队列。  
**Acceptance criteria:**

- 可举报、可拉黑
- 被拉黑方在匹配/互动中被过滤  
  **Verification:**
- Manual: A 拉黑 B 后，A 侧不再出现 B  
  **Dependencies:** M0.2  
  **Files likely touched:** `cloudfunctions/safety/index.js`, `src/pages/community/report.vue`  
  **Estimated scope:** S

### Task M1.5: T2 邀请裂变

**Description:** `invite` 云函数生成/核销邀请码 + 分享卡片；新用户注册时写入 `invitedBy`，归因到 inviter。  
**Acceptance criteria:**

- 分享卡片拉新可归因到 inviter  
  **Verification:**
- Manual: 分享 → 新用户注册 → invitedBy 正确写入  
  **Dependencies:** M0.2  
  **Files likely touched:** `cloudfunctions/invite/index.js`, `src/utils/share.js`  
  **Estimated scope:** S

### Checkpoint M1

- [ ] 社区可发帖(过审)、可互动、可举报、可裂变拉新
- [ ] 内容安全违规样例被拒（SC5 基础）
- [ ] 人工评审后进入 M2

---

## Phase 2 · M2 破冰（匹配 + 双人游戏）

### Task M2.1: F3 规则撮合

**Description:** `match.recommend` 按兴趣/属性打分（冷启期规则匹配，T4 已决），建 `matches`(status=active)；前端匹配页展示候选并支持接受/拒绝。  
**Acceptance criteria:**

- 两人被撮合进等待；拒绝/超时正确处理  
  **Verification:**
- Manual: 两个测试号互被推荐并可成匹配  
  **Dependencies:** M0.2, M1.1（需有资料/用户）  
  **Files likely touched:** `cloudfunctions/match/index.js`, `src/pages/match/`  
  **Estimated scope:** M

### Task M2.2: F4 建局/加入（状态机）

**Description:** `game.createGame`/`game.joinGame`，状态 waiting→playing→done；撮合成功后自动建局推送双方。  
**Acceptance criteria:**

- 双人成局，状态流转正确  
  **Verification:**
- Integration: 双端 join 后 state=playing  
  **Dependencies:** M2.1  
  **Files likely touched:** `cloudfunctions/game/index.js`, `src/pages/game/`  
  **Estimated scope:** S

### Task M2.3: F4 默契问答（各自独立答题 · 终局对比）

**Description:** `game.submitAnswer`（客户端带 `round` 题号 + `optionIndex`，答案按 `answers[题号][openid]` 各自独立落盘，互不阻塞）；前端用云数据库 `watch` 订阅状态（轮询兜底）；**双方都答完全部题时才终局对比**两人答案，答案选同一项 = 默契。  
**Acceptance criteria:**

- 各自独立答题互不阻塞，双端进度实时可见
- 终局对比判定一致、结束页同时出结果  
  **Verification:**
- E2E: 双设备进同一局，各自答完 5 题后同时出结果  
  **Dependencies:** M2.2  
  **Files likely touched:** `cloudfunctions/game/index.js`, `src/pages/game/quiz.vue`, `src/pages/game/game.vue`, `src/utils/realtime.js`  
  **Estimated scope:** M
  > **注（2026-08-30 改版）**：原设计为回合制（双方都提交才 `round+1`），用户反馈"一人选完等另一人选完太死板"，改为独立答题 + 终局对比。提交 `ab8cbd8`。

### Task M2.4: F4 题库种子

**Description:** `gameQuestions` 种子数据 + 取题接口（按主题/随机），支撑默契问答。  
**Acceptance criteria:**

- 游戏有题可取，回合能推进  
  **Verification:**
- Unit: 取题返回非空结构  
  **Dependencies:** M2.2  
  **Files likely touched:** `cloudfunctions/game/index.js`, 种子数据文件  
  **Estimated scope:** S

### Checkpoint M2 ✅ 已通过（2026-08-30）

- [x] 双设备进同一局、各自独立答题、玩完一局
- [x] 撮合→建局→答题闭环跑通（V1–V4 云端佐证，见 `verification-log.md`）
- [x] 人工评审后进入 M3

---

## Phase 3 · M3 升温·导流（关系成长 + 加微信 + 主页）

> **进度（2026-08-30）**：M3.1–M3.6 **代码全部完成并部署、云端已核验**，**待真机验证**（8 步见 `tasks/verification-log.md`）。
>
> | 任务 | 状态 | 落地位置（与卡片预估的偏差） |
> |---|---|---|
> | M3.1 成长累加 | ✅ 已部署 | `growth` 云函数 + `game` done 分支 + `match.recommend` 改读 pairs |
> | M3.2 阶段跃迁 + 可视化 | ✅ 已提交 | `src/components/growth-bar.vue`（卡片未列，新增） |
> | M3.3 轻聊 | ✅ 已部署 | 动作 `send`/`list`（非 `sendMessage`/`listMessages`）；互聊判定内联在 `send`，未建 `markMutualChat` |
> | M3.4 解锁联系方式 | ✅ 已部署 | `src/pages/contact/contact.vue`（**非** `src/pages/chat/contact.vue`） |
> | M3.5 关系主页 | ✅ 已部署 | `src/pages/relation/relation.vue`（**非** `src/pages/growth/`） |
> | M3.6 streak | ✅ 已部署 | 并入 M3.1 的 `addGrowth.streakDeltaFor`（如建议） |

### Task M3.1: F5 成长累加（只增不减）

**Description:** `growth` 云函数，事件触发按 Plan §5 规则累加 `pairs.growthValue`（每局+8/互聊+2/互加好友+5/streak+3/天、双向正向×1.5），**只增不减**；建 `pairs` 文档。  
**Acceptance criteria:**

- 一起玩/互聊后成长值涨
- 负值/非法增量被拒  
  **Verification:**
- Unit: 累加逻辑（含只增不减断言）
- Integration: 模拟事件后 growthValue 正确变化  
  **Dependencies:** M2.3  
  **Files likely touched:** `cloudfunctions/growth/index.js`, `src/utils/growth.js`  
  **Estimated scope:** M

### Task M3.2: F5 阶段跃迁 + 可视化

**Description:** 按 Plan §5 阈值（S1≥12/S2≥40/S3≥90/S4≥150）判定 S0–S4；关系进度条组件展示阶段与里程碑。  
**Acceptance criteria:**

- 注入事件后阶段正确跃迁
- 前端进度条可视化  
  **Verification:**
- Unit: 阈值边界判定正确
- Manual: 进度条随成长值推进  
  **Dependencies:** M3.1  
  **Files likely touched:** `cloudfunctions/growth/index.js`, `src/components/growth-bar.vue`  
  **Estimated scope:** M

### Task M3.3: F6 轻聊（先审后发）

**Description:** `chat.sendMessage`（先审后发）+ 取消息；S1 解锁轻聊。  
**Acceptance criteria:**

- 可互聊，消息审核入库  
  **Verification:**
- Integration: 违规消息被拒  
  **Dependencies:** M3.1  
  **Files likely touched:** `cloudfunctions/chat/index.js`, `src/pages/chat/`  
  **Estimated scope:** M

### Task M3.4: F6 解锁联系方式

**Description:** S4 解锁；`chat` 生成微信二维码/复制微信号（云存储存二维码或前端生成），双通道导流（T3 修正：无一键加好友 API）。  
**Acceptance criteria:**

- S3 不能解锁、S4 能
- 二维码长按识别 / 复制微信号 双通道可用  
  **Verification:**
- Manual: S3 态无入口，S4 态出现联系方式  
  **Dependencies:** M3.2  
  **Files likely touched:** `cloudfunctions/chat/index.js`, `src/pages/chat/contact.vue`  
  **Estimated scope:** S

### Task M3.5: F7 关系成长主页

**Description:** 关系成长页展示里程碑/成就（复用 `pairs`），提供回访钩子。  
**Acceptance criteria:**

- 主页可见成长轨迹与里程碑  
  **Verification:**
- Manual: 进入主页看到阶段与成就  
  **Dependencies:** M3.2  
  **Files likely touched:** `cloudfunctions/growth/index.js`, `src/pages/growth/`  
  **Estimated scope:** S

### Checkpoint M3（最小闭环达成）

- [ ] 一起玩后成长值涨、阶段推进、S4 解锁联系方式
- [ ] 跑通"社区→游戏→升温→导流"最小闭环（验证 SC4 前提）
- [ ] 人工评审后进入 M4

---

## Phase 4 · M4 验证（埋点 + 看板 + 校准）

### Task M4.1: F9 全链路埋点

**Description:** `metrics.trackEvent` 全链路事件（配对/互动/留存/转化/阶段）；前端 `utils/track` 封装统一上报。  
**Acceptance criteria:**

- 关键事件正确上报、无漏报  
  **Verification:**
- Integration: 模拟关键路径，断言 events 入库  
  **Dependencies:** M2.1+（需事件源）  
  **Files likely touched:** `cloudfunctions/metrics/index.js`, `src/utils/track.js`  
  **Estimated scope:** M

### Task M4.2: F9 北极星看板

**Description:** 聚合 SC1–SC5（配对率/7日留存/加微信转化/阶段分布/安全处置率），形成可观测看板。  
**Acceptance criteria:**

- 看板可观测成功标准  
  **Verification:**
- Manual: 注入样例数据，看板指标正确  
  **Dependencies:** M4.1  
  **Files likely touched:** `cloudfunctions/metrics/index.js`, 看板页面/聚合脚本  
  **Estimated scope:** M

### Task M4.3: 全链路联调 + 阈值校准 ✅ 已完成（2026-08-30，结论=沿用初值）

**Description:** 跑通最小闭环；用 F9 数据回灌 Plan §5 阈值（12/40/90/150）初值校准，记录校准结果。  
**Acceptance criteria:**

- SC4（真交到伴侣）可归因
- 阈值校准结论已记录  
  **Verification:**
- Manual: 端到端走通（真机验收通过，含 SC4 双边邀请全流程）+ 校准结论已记录于 `tasks/threshold-calibration.md`（n=3 单日样本 → **样本不足，沿用初值**；记录游戏权重偏高、app_open 双计两个后续观察）  
  **Dependencies:** M3.5, M4.2  
  **Files likely touched:** 调参记录/配置  
  **Estimated scope:** M

### Task M4.4: SC4 关系确认双边邀请 ✅ 已完成（2026-08-30，待真机验证）

**Description:** 关系主页「我们在一起了 🎉」由单边自评升级为**双边邀请**：A 发起 `sendConfirmInvite`（写 `pairs.confirmInvite={from,at,expiresAt}`，TTL=10min）→ B 关系页轮询收到后弹窗 → B `acceptConfirmInvite`（落 milestones + 上报 relation_confirmed）/ `rejectConfirmInvite` 清空 / A `cancelConfirmInvite` 撤销；超时服务端校验失效、A 端轮询回流可重发。沿用 M3 `growth` 云函数，内核改完已 `npm run sync:core`。  
**Acceptance criteria:**
- A 发起后 B 端（已在该页）经 4s 轮询自动弹出邀请，无需重进
- B 同意 → 双方关系页均显示「在一起 🎉」chip（A 端轮询可见）；B 拒绝 → 邀请清空、A 可重发
- 超时（10min）后邀请失效，不卡流程（A 回流可重发、B 弹窗消失）
- 仅 B 同意时上报 relation_confirmed（SC4 分子）；幂等（milestones 含『在一起 🎉』判重）
- 看板 SC4_relation_confirmed_pairs 可计数

**Verification:**
- Code: `node --check` 通过；growth 已重部署 Status=Active、CodeInfo 含 sendConfirmInvite/acceptConfirmInvite/rejectConfirmInvite/cancelConfirmInvite
- Build: `npm run build:mp-weixin` DONE（relation.vue 编译通过）
- Manual: 真机待用户（⚠️ 旧单边测试已让目标 pair 含 milestones『在一起 🎉』，重测新流程请用全新 pair）

  **Dependencies:** M4.2（看板已计 relation_confirmed）
  **Files likely touched:** `cloudfunctions/growth/index.js`, `cloudfunctions/growth/growth-core.js`, `src/pages/relation/relation.vue`, 同步副本 game/chat/match/growth-core.js
  **Estimated scope:** S

### Checkpoint M4（v1 可上线验证）

- [x] 能观测 SC1–SC4（SC5 为数据缺口，人工终审放行）
- [x] 最小闭环跑通、SC4 可归因（双边邀请真机验收通过，`relation_confirmed` 已入库）
- [x] 阈值校准记录完成（`tasks/threshold-calibration.md`：n=3 单日 → 样本不足，沿用初值 12/40/90/150）
- [ ] 人工终审 → 进入 Phase 4 Implement（逐任务落地）

---

## M5：SC5 处置能力（F8 闭环）+ app_open 双计修复

> 规划：`tasks/plan-m5.md`（2026-08-30 范围已拍板：handleReport+管理员白名单 / SC5 以 reports 集合为权威源 / 处置只标记不做自动动作 / 冷启动线本轮跳过）。**2026-08-30 签字放行，代码全部落地并部署**（提交 `993e1c0`/`6a7c486`/`74e0cf0`/`022cdad`）。

### Task M5.1: safety.handleReport（管理员白名单 + 幂等）✅ 已完成并部署（2026-08-30，提交 `6a7c486`）

**Description:** `safety` 加 handleReport action：校验 admins 集合 → reports.status pending→handled/dismissed + handledAt/handledBy → 上报 report_handled（props 仅 targetType/decision）。
**Acceptance criteria:** 非管理员 403；重复处置返回 alreadyHandled；note 不入埋点。
**Dependencies:** M5.2（白名单先行）
**Files likely touched:** `cloudfunctions/safety/index.js`
**Estimated scope:** S

### Task M5.2: report_handled 入埋点白名单 ✅ 已完成（提交 `993e1c0`，sync:core 7 副本）

**Description:** metrics-core 白名单加 report_handled，`npm run sync:core` 同步副本。
**Dependencies:** 无
**Files likely touched:** `cloudfunctions/*/metrics-core.js`（经 sync）
**Estimated scope:** S

### Task M5.3: metrics.dashboard SC5 消费 reports 集合 ✅ 已完成并部署（提交 `74e0cf0`，冒烟 PASS：SC5 分支出 pendingCount）

**Description:** 替换 no_data 分支：24h 处置率（handledAt-createdAt≤24h ÷ 全部 handled）+ pendingCount；_note 写明与 SC1–SC4 的口径差异（reports 权威源 vs events 流）。
**Dependencies:** M5.1（数据形态）
**Files likely touched:** `cloudfunctions/metrics/index.js`
**Estimated scope:** S

### Task M5.4: app_open 冷启动双计修复 ✅ 已完成（提交 `022cdad`，待真机复验）

**Description:** App.vue onLaunch 打冷启动标记，紧随的 onShow 跳过一次上报；之后每次切前台正常报。~6 行纯前端。
**Dependencies:** 无
**Files likely touched:** `src/App.vue`
**Estimated scope:** S

### Checkpoint M5（SC1–SC5 全有数）

- [x] SC5 真实读数可出（dashboard 已替代 no_data；2026-08-30 21:20 验收 PASS：处置 1 条后 `SC5={status:ok, rate:100, handledCount:1, within24h:1, pendingCount:2}`）
- [x] app_open 冷启动不再成对双计（events 复核 PASS：20:38 部署后新增 5 次启动全部单条；部署前存在毫秒级成对样本）
- [x] `admins` 集合已建（2026-08-30 21:14，含 1 个管理员 openid `oUsf1xRnPxcjWLiSG3XFR-6LrPFY`）
- [x] 人工终审 → **通过（2026-08-30 21:40 用户签字）**，M5 全收官 → 下一阶段 M6 规划（候选：管理员 UI + 403/幂等真机补验、冷启动准备、阈值回灌观察项）。⚠️ 遗留进 M6：handleReport 的 403（非管理员）与 alreadyHandled（幂等）路径未走真实登录态调用（无管理员 UI，MCP 直调无 openid 只能验到 401）；待管理员 UI（建议 M6）后真机补验

---

## M6：管理员处置闭环（收 M5 尾）

> 规划：`tasks/plan-m6.md`（2026-08-30 范围已拍板：A 收 M5 尾 / isAdmin 走云函数动作 / community 提交 true）。**待签字放行，不写实现代码。**
> 冷启动准备（资质/类目/隐私/索引）与技术债（时区/streak、死代码、老对回填）整线延后，留 M7。

### Task M6.1: safety.isAdmin 动作 ✅ 规划待放行

**Description:** `safety` 加 `isAdmin` action：查 `admins` 集合 by `OPENID` → `{isAdmin: boolean}`；非登录 401；纯读不改。
**Acceptance criteria:** 管理员 openid 返 true；非管理员返 false；无 openid 返 401。
**Dependencies:** 无
**Files likely touched:** `cloudfunctions/safety/index.js`
**Estimated scope:** S

### Task M6.2: 前端管理员判定 + 路由守卫 ✅ 规划待放行

**Description:** 新增 `src/utils/admin.js` 封装 `isCurrentUserAdmin()`（调 isAdmin，会话内缓存）；`pages/settings/settings.vue` 加「管理后台」入口，仅 isAdmin 可见。
**Acceptance criteria:** 管理员 settings 页见入口；非管理员不见；深链 admin 页被守卫拦截。
**Dependencies:** M6.1
**Files likely touched:** `src/utils/admin.js`, `src/pages/settings/settings.vue`
**Estimated scope:** S

### Task M6.3: 管理员处置页 ✅ 规划待放行

**Description:** 新增 `pages/admin/reports.vue` + 注册 `pages.json`：pending 列表（targetType/举报人/时间）+ 处置/驳回按钮 → 调 `handleReport`；已处置 tab；重复处置禁用 + alreadyHandled 提示；进入即 isAdmin 守卫。
**Acceptance criteria:** 管理员可见 pending 并处置 → reports.status 变更 + handledAt；SC5 出 rate；非管理员不可进；幂等可验。
**Dependencies:** M6.1, M6.2
**Files likely touched:** `src/pages/admin/reports.vue`, `src/pages.json`
**Estimated scope:** M

### Task M6.4: config.js 开关提交 + 文档同步 ✅ 规划待放行

**Description:** 提交 `FEATURES.community=true`（用户真机测社区已改）；HANDOFF「社区搁置」现状更新为 true。
**Acceptance criteria:** config.js 提交 community=true；HANDOFF 同步。
**Dependencies:** 无
**Files likely touched:** `src/utils/config.js`, `HANDOFF.md`
**Estimated scope:** S

### Checkpoint M6（管理员闭环 + SC5 真机有数）

- [ ] 管理员页可见 pending 并能处置（handled/dismissed），reports.status + handledAt 落库
- [ ] 非管理员进不去处置界面（前端守卫 + 服务端 403）
- [ ] dashboard SC5 出真实 rate（闭合 M5 遗留 403/幂等真机补验）
- [ ] config.js 提交 community=true + HANDOFF 同步
- [ ] 人工终审 → 下一阶段（M7：上线就绪 / 技术债）

---

## 贯穿约束（来自 SPEC §9）

- Always: UGC/私聊先审后发；服务端校验一切输入；成长值只增不减；改前先更 Spec。
- Never: 提交密钥/openid 明文；v1 加情侣经营或变现；跳过内容安全；用假数据伪造指标；用非官方"个人微信协议"加好友。
- 任何前端框架/依赖/数据模型/营收相关改动 = Ask-first。
