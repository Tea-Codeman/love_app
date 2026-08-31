# 恋爱成长 · Relationship-Growth Social Mini-Program

> 微信小程序（**uni-app Vue3 + Vite → mp-weixin**），以「关系成长」为核心驱动，用 *轻社交社区 + 双人轻互动小游戏*，让单身用户从陌生 → 好感累积 → 信任，关系自然发生，最终导向真实伴侣关系。

**当前状态：`v0.3.1` · M4 收尾 · 受限邀请灰度就绪（LA.1–LA.4 全绿）**

⚠️ 当前为**受限邀请原型（restricted-invite prototype）**，未公开上架。配对仅经受限邀请准入，不开放公开注册 / 搜索。

---

## 为什么做

- **痛点**：探探"太看脸、太直接"；Soul"太飘、难破冰、容易聊死"。
- **方案**：先有共同话题与轻松互动（社区 + 轻游戏），关系自然发生；并把"看到一段关系在成长 / 有进度"本身做成情绪价值。
- **护城河**：微信内即用 + 关系成长可视化 + 微信内加好友闭环（二维码长按识别 / 复制微信号，非一键直达通讯录——微信无官方"一键加好友"API）。

v1 成功定义（北极星）：**真的有人通过它交到伴侣并成为留存用户**（详见 `spec/SPEC.md` §8）。

---

## 里程碑

| 里程碑 | 内容 | 状态 |
|--------|------|------|
| M0 | uni-app 迁移 + CloudBase 初始化 | ✅ |
| M1 / M2 | 身份(F1) + 社区(F2) + 匹配(F3) | ✅ |
| M3 | 升温·导流：关系成长(F5) + 轻聊(F6 先审后发) + 联系方式解锁 + 关系主页(F7) | ✅ `v0.3.0` |
| M3.1 | 性能优化 P0–P3（7 集合索引）+ 聊天分页修复 | ✅ `v0.3.1` |
| M4 | 互邀全流程(SC4)真机验收 | ✅ M4.4 通过；M4.3 阈值沿用初值 |
| M5+ | 关系成长深化（规划中） | 🔜 |
| M8.1 | 公开上架 | 🔻 降级为受限邀请原型（资质就绪前不公开）|
| M8.3 | 内容安全（微信安全 API）| 🔻 降级 `useWxSecurity=false`，本地关键词兜底 |

---

## 技术栈

| 层 | 方案 |
|----|------|
| 前端 | uni-app（Vue3 + Vite），编译 `mp-weixin` |
| 后端 | 微信云开发 CloudBase（云函数 + 云数据库 + 云调用）|
| 实时 | 弱实时：云数据库 watch / 云函数轮询（首款游戏回合制，秒级足够）|
| 存储 | 云数据库（文档型）+ 云存储（头像 / 图片）|
| 合规 | 微信内容安全 API（预留）+ 本地自审规则兜底 |
| 分析 | 自建埋点 + 微信后台数据（F9 北极星看板）|

---

## 架构

**前端（`src/pages`）**：`community` 社区 · `match` 匹配 · `game` 双人游戏 · `relation` 关系主页+成长 · `chat` 轻聊+加微信导流 · `profile` 我的

**云函数（`cloudfunctions/`，共 10 个，独立打包）**：

| 函数 | 职责 |
|------|------|
| `auth` | 微信登录、资料白名单 sanitize、在线状态 `setOnline`/`getStatus`、受限邀请码消费（写 `invitedBy`）|
| `match` | 兴趣/标签规则匹配 `recommend`（online + 未拉黑过滤）、`accept` 配对 |
| `growth` | 关系成长值累加（**只增不减**）、阶段 S0–S4 读时派生 |
| `game` | 双人默契问答 / 选择题配对，`joinGame` / `submitAnswer` |
| `chat` | 轻聊 `send`/`list`（先审后发、1.5s 增量轮询 + 翻历史分页）、`contact` 解锁联系方式 |
| `community` | 话题广场 / 发帖 / 评论 / 互动 |
| `safety` | 内容审核 `checkText`、拉黑 / 举报（`useWxSecurity` 开关外置 `server_config.launch`）|
| `metrics` | 北极星看板埋点聚合 |
| `invite` | 受限邀请（当前灰度准入路径；`?inviter=` 分享裂变路径冻结）|
| `ping` | 健康检查 |

---

## 关系成长模型

两人共享**一条**成长值，**只增不减**。5 阶段由成长值**读时派生**（阈值 `12 / 40 / 90 / 150`）：

| 阶段 | 名称 | 阈值 | 解锁 |
|------|------|------|------|
| S0 | 陌生 | 0 | — |
| S1 | 有点意思 | ≥12 | 轻聊 |
| S2 | 聊得来的朋友 | ≥40 | — |
| S3 | 有好感 | ≥90 | — |
| S4 | 信任·可加微信 | ≥150 | 联系方式（二维码长按识别 / 复制微信号）|

累加规则：每场游戏 `+8`、有效互聊 `+2`（仅回复对方上一条时结算，幂等）、连续天数 streak `+3/天`（ISO 周上限 `+15`）。冷关系靠"最近互动"排序自然沉淀，**不衰减**。

---

## 目录结构

```
.
├── src/
│   ├── pages/        # community / match / game / relation / chat / profile
│   ├── components/   # growth-bar、post-card、tab-bar 等签名组件
│   └── utils/        # growth 派生、icons（base64 SVG）、埋点
├── cloudfunctions/   # 10 个云函数（独立打包）
├── scripts/          # sync-core.mjs（公共内核 growth-core / metrics-core 同步）
├── spec/SPEC.md      # 需求规格（事实来源）
├── tasks/            # plan-*.md / launch-readiness.md 等
├── project.config.json
├── package.json
└── HANDOFF.md · CHANGELOG.md · BUG.md
```

---

## 快速开始

前置：Node（已用 22.x）、微信开发者工具、CloudBase 环境 `love-app-server-d2fhg32320d65c12`。

```bash
# 安装依赖
npm install

# 同步公共内核到各云函数 consumer
npm run sync:core

# 本地开发预览（编译到 dist/dev，开发者工具加载 dist/dev/mp-weixin）
npm run dev:mp-weixin

# 生产构建（编译到 dist/build）
npm run build:mp-weixin
```

> 云函数需经 CloudBase 控制台 / CLI **独立部署**：每个函数目录独立打包，公共内核经 `sync:core` 复制。`build:mp-weixin` 仅跑 Vite，**不校验云函数运行时错误**，云端代码须以 `getFunctionDetail` 或归一化 diff 核实。

---

## 已知限制 & 路线图

- **受限邀请准入**：当前不公开上架，配对走受限邀请 gate（`auth.login` 消费 `inviteCode` 写 `invitedBy` / `confirmInvite.js` 全局投递）。`?inviter=` 分享裂变路径冻结。
- **内容安全降级**：M8.3 暂以本地关键词兜底（`useWxSecurity=false`）；资质 / 服务就绪后回灌微信安全 API。
- **联系方式**：二维码走用户自填 `wechatQrUrl`，未接云存储上传。
- **路线图**：M5 关系成长深化 → M8.1 公开上架 → M8.3 内容安全回灌 → 用 F9 早期数据回灌校准 SC1–SC5 与阶段阈值。

---

## 文档索引

- `spec/SPEC.md` — 需求规格（能力地图 / 决策记录）
- `CHANGELOG.md` — 版本与里程碑变更（与 git tag 一一对应）
- `HANDOFF.md` — 交接与 Checkpoint
- `tasks/launch-readiness.md` — 收官 / 灰度上线就绪说明（LA.1–LA.4 实证）

---

## 仓库

`git@github.com:Tea-Codeman/love_app.git` · `main` 分支（trunk-based，commit 即存档点）

## License

私有项目。当前为受限邀请灰度原型，未公开许可。
