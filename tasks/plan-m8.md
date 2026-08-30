# M8 规划：上线就绪（冷启动准备）

> 本文档是 **M8 阶段执行规划**，基于 `HANDOFF.md`（M7 收官现状、待确认事项「账号主体/社交类目资质现状？内容安全云调用权限是否就绪？隐私政策文案进度？」）、`cloudfunctions/safety/index.js`（内容安全开关现状）、`src/pages/privacy/privacy.vue`（占位文案）、`tasks/plan-m7.md`（「明确不做」清单已把四项留 M8）。
> 状态：**已签字放行（2026-08-30 用户签字），按 M8.1→M8.4 落地**。**M8.1 为用户侧资质门禁（Agent 出指引+核验）；M8.3 强依赖 M8.1；M8.2 / M8.4 由 Agent 并行落地。** **🔻 2026-08-31 用户决策降级：M8.1 资质仍在申请中 → 维持个人账号「受限邀请原型验证」模式（不公开上架）；M8.3 同步降级维持 `USE_WX_SECURITY=false`（本地关键词兜底），待资质就绪再 flip。M8.2/M8.4 已落地不受影响。**
> M8 = v1 正式上架前的最后准备；收尾后即进入「收官 / 灰度上线」。**优化（O1/O4/O5）已落地（2026-08-31）：上架开关外置 server_config / 隐私版本强制重同意 / 上架 Playbook 文档；O2 已落地（imgSecCheck 同步内联，免回调/HTTP函数/控制台配置）/ O6 分享入口留未来资质就绪后补。**

## 1. 本轮目标

补齐四项上线就绪项，使小程序具备对外公开运营的最低合规与性能门槛：

- **M8.1 账号主体升级 + 社交类目资质**（用户侧微信后台操作，Agent 出指引 + 验收准入条件）
- **M8.2 隐私政策正式文案**（替换 `privacy.vue` 占位，覆盖合规必备字段）
- **M8.3 内容安全切换**（`USE_WX_SECURITY` 置 true，文本走微信官方 `msgSecCheck`）
- **M8.4 reports/events 复合索引**（CloudBase NoSQL 建索引，支撑管理员处置与看板聚合）

## 2. 任务卡

### Task M8.1: 账号主体升级 + 社交类目资质 🔻 降级·延后（用户申请资质中，维持个人账号原型验证）

**Description:**
- Agent 出微信公众平台操作指引清单：① 主体类型——个人主体无法调用 `cloud.openapi.security.*` 且社区/匹配属社交类目受限，需升级为企业/个体工商户并认证；② 类目——在「服务类目」加「社交 → 陌生人社交 / 婚恋交友」类目，提交资质（ICP 备案/《增值电信业务经营许可证》或平台要求的替代材料）；③ 内容安全——开通「内容安全」接口权限（文本检测 `msgSecCheck`）。
- 验收准入条件（用户达标后告知 Agent）：① 小程序已认证企业/个体主体；② 社交类目已审核通过；③ 后台能查到 `msgSecCheck` 接口调用额度/权限。
- Agent 侧核验：用 CloudBase 控制台或 MCP 读取环境 `appid`/主体信息（若可），并尝试一次 `msgSecCheck` 空跑确认无 `48001`（无权限）报错。

**Acceptance criteria:** 用户确认三项达标；Agent 侧 `msgSecCheck` 试跑返回正常权限（非 48001）。此任务为 **M8.3 的前置门禁**。
**Dependencies:** 无（用户侧先行）
**Files likely touched:** 文档（指引清单入 verification-log / HANDOFF）；无代码改动
**Estimated scope:** 用户侧为主，Agent 出指引 + 核验（S）

### Task M8.2: 隐私政策正式文案（S，Agent 起草）

**Description:**
- 重写 `src/pages/privacy/privacy.vue` 占位文案（现仅「欢迎使用「恋爱成长」。我们非常重视你的隐私…」一句话占位），覆盖微信小程序隐私协议合规必备项：
  - 收集的信息类型与目的：openid（登录标识）、昵称/头像/性别/年龄（资料展示）、微信号与二维码（S4 联系方式导出，仅关系达 S4 可见）、互动行为（成长值/阶段/匹配）、消息正文（聊天，服务端先审后发）、埋点事件（仅 ID/枚举/数值，不含 PII，见 `track.js` 隐私红线）。
  - 信息存储期限与地理位置（CloudBase 云开发，境内节点）。
  - 第三方共享：仅微信云开发基础设施与微信内容安全审核（M8.3 后文本送审）。
  - 用户权利：查阅/更正/删除个人资料、撤回隐私同意（清 `rg_privacy_agreed` 并重新弹门禁）、注销账号。
  - 未成年人保护声明、联系方式（运营方邮箱）、政策更新机制。
- 文案须与 `SPEC.md` 合规约定（先审后发 / 服务端校验 / 成长只增不减 / 隐私+授权弹窗+举报）对齐。
- 现有门禁链路（`App.vue` 未同意 `reLaunch` 到 privacy 页 + `storage.setPrivacyAgreed`）**不改**，仅替换页面正文。

**Acceptance criteria:** 正式文案覆盖上述字段；用户/法务确认（或用户拍板「Agent 起草版即可上线」）；`build:mp-weixin` 通过、隐私页渲染正常。
**Dependencies:** 无
**Files likely touched:** `src/pages/privacy/privacy.vue`（仅文案/结构）
**Estimated scope:** S

### Task M8.3: 内容安全切换 USE_WX_SECURITY=true 🔻 降级·维持 false（强依赖 M8.1 资质，延后至资质就绪）

**Description:**
- 改 `cloudfunctions/safety/index.js:23` `const USE_WX_SECURITY = false` → `true`；`checkText` 分支（249 行）即切到 `wxCheckText`（`cloud.openapi.security.msgSecCheck`）。
- 验收 `msgSecCheck` 真实判定：构造一条违规文本（涉黄/赌博类）+ 一条正常文本，经 `community`/`chat` 触发 `safety.checkText` → 断言违规被拒（不过审不落库）、正常放行。
- 🔴 **前置门禁 = M8.1**：个人/未认证主体调 `msgSecCheck` 报 `48001`；必须由 M8.1 主体+内容安全权限就绪后才执行。
- 🟡 **图像审核（O2 ✅ 已落地，2026-08-31）**：原 M8.3 规划「不接 `mediaCheckAsync` 异步回调」（需配内容安全消息推送+回调云函数）。现改为 `wxCheckImage` 走 `cloud.openapi.security.imgSecCheck`（**同步内联判定**，免异步回调/HTTP函数/控制台配置），基础设施就绪；全仓暂无图像上传调用点，启用图像上传功能（帖子图/头像审核）即生效，翻 O1 开关即真审。O2 详情见 verification-log「M8 优化 O1/O4/O5」章。
- 部署 `safety` → `Status=Active`，`getFunctionDetail` 核验 `CodeInfo` 含 `USE_WX_SECURITY = true`。

**Acceptance criteria:** `USE_WX_SECURITY=true` 部署落地；违规文本真机/云函数触发 `checkText` 被拒、正常文本放行；无 `48001`。图像审核（O2）已用同步 imgSecCheck 落地基础设施（免异步回调），无调用点待图像上传功能启用即生效。
**Dependencies:** M8.1
**Files likely touched:** `cloudfunctions/safety/index.js`（1 行 + 注释）、`cloudfunctions/safety/package.json`（确认 `wx-server-sdk` 版本支持 `openapi.security`，当前 `~2.6.3` 应已支持）
**Estimated scope:** M

### Task M8.4: reports/events 复合索引（S）

**Description:**
- CloudBase NoSQL 为两个高频查询集合建复合索引：
  - `reports`：`status`（handleReport 查 pending / dashboard 统计 pendingCount）、`reporterId`、`targetId`、`createdAt`。建议索引：`status`（单字段，管理员列表按状态过滤）+ `createdAt`（时间排序）。
  - `events`：`eventName` + `ts`（dashboard 按 eventName 分组聚合 + 按天 `day` 聚合）、`pairId`、`day`。建议索引：`eventName` + `day`、`pairId` + `day`。
- 建索引走 CloudBase 控制台或 `tcb` CLI（`index` 命令）/ CloudBase MCP（若提供索引管理）。当前数据量小（events ~47 条、reports ~1 条），建索引属性能与可扩展性预备，不阻塞功能。
- 验收：建索引后在控制台确认索引状态 `ready`；对 `reports(status)` / `events(eventName,day)` 查询确认走索引（无全表扫告警）。

**Acceptance criteria:** reports/events 关键查询字段已建复合索引且状态 ready；查询计划确认命中索引。
**Dependencies:** 无
**Files likely touched:** 文档（索引清单入 verification-log）；控制台/CLI 操作，无源码改动
**Estimated scope:** S

### Checkpoint M8（上线就绪收尾 · 降级模式）

- [ ] 账号主体升级 + 社交类目资质达标（M8.1：🔻 降级·用户申请中，延后；v1 走受限邀请原型验证，不公开上架）
- [x] 隐私政策正式文案上线（M8.2，覆盖合规字段，build 通过）
- [ ] 内容安全切真审（M8.3：🔻 降级·维持 USE_WX_SECURITY=false 本地兜底，待 M8.1 资质就绪再 flip）
- [x] reports/events 复合索引 ready（M8.4，CloudBase MCP 已建 + listIndexes 复核）
- [ ] 人工终审 → 下一阶段（收官 / 灰度上线 · 受限邀请原型）

## 3. 本轮明确不做（留收官后 / 后续）

- 阈值回灌重算（维持 12/40/90/150，待自然用户 ≥10 对再回灌，见 threshold-calibration.md）
- 图像审核：O2 已用同步 imgSecCheck 落地基础设施（免异步回调），无调用点待图像上传功能启用即生效（无需再补回调云函数）
- 老对时区回填（M7.3 已决不回填）
- 灰度/增长（邀请裂变、运营活动）属 v1 后范围
- 营收（内购/情侣经营）明确 Out of scope

## 4. 关键设计

- **门禁依赖**：M8.3 强依赖 M8.1 主体+内容安全权限；M8.1 不达标则 M8.3 不可执行（会 48001）。故 M8 建议顺序：M8.1（用户）→ M8.3；M8.2 / M8.4 可与 M8.1 并行。
- **开关零改动业务**：`USE_WX_SECURITY` 设计即「切换即生效」，业务代码（community/chat 调 `checkText`）无需改；仅 `safety/index.js` 1 行常量。
- **隐私门禁复用**：门禁链路已存在（M0.3），M8.2 只换文案不动路由/存储。
- **索引预备不阻塞**：数据量小，建索引为可扩展性预备，失败不影响现有功能。

## 5. 验证方法

- M8.1：用户后台截图/确认三项达标；Agent 侧 `msgSecCheck` 空跑确认非 `48001`。
- M8.2：隐私页真机渲染 + 字段清单核对（收集项/目的/第三方/权利/更新机制）。
- M8.3：违规/正常文本各一次经 `safety.checkText` → 断言拒发/放行；`getFunctionDetail` 核验 `CodeInfo` 含 `USE_WX_SECURITY = true`。
- M8.4：控制台索引状态 `ready` + 查询计划命中索引。
