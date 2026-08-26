# Plan: 恋爱成长型社交小程序 v1（关系成长 / Relationship-Growth）

> 本文件是 **Phase 2 · Plan**，基于 `../spec/SPEC.md`（v1.0 决策收口版）产出。
> 状态：**纯计划，零代码实现**。目标 = 让人类能读后说"对，就这么做"或"改 X"。
> 门控：本 Plan 经你签字后，才进入 Phase 3（Tasks 拆分）→ Phase 4（Implement）。

---

## 0. 计划范围与限制

- **覆盖**：Spec 能力地图的全部 9 个模块（F1–F9），v1 单身主链路。
- **不覆盖**：情侣经营、内购变现、你画我猜类高实时游戏、重度竞技（Spec §1 已划 Out of scope）。
- **技术基座假设（已决）**：微信云开发 CloudBase；**前端框架 = uni-app（Vue3 + Vite，编译 mp-weixin），已于 Plan 签字定案（用户决定，覆盖 Spec 默认原生）**。uni-app 编译产物调用 `wx.cloud` 接入 CloudBase。
- **实时假设（已决 T1）**：弱实时，v1 首款游戏回合制，云数据库 watch 或轻量 WS（秒级）。

---

## 1. 架构总览（Architecture）

```
┌──────────────────────────────────────────────────────────────┐
│  微信小程序前端（uni-app → 编译 mp-weixin）                                          │
│  pages: community / match / game / growth / chat              │
│  components: 关系进度条 / 游戏画布 / 帖子卡 / 二维码卡          │
│  utils: 埋点(F9) / 合规(F8) / API 封装 / 路由守卫              │
└───────────────┬──────────────────────────────────────────────┘
                │  wx.request → 云函数（云调用 + 鉴权 openid）
┌───────────────▼──────────────────────────────────────────────┐
│  微信云开发 CloudBase                                          │
│  ├─ 云函数（Node.js）        → 业务逻辑、内容安全、埋点聚合    │
│  ├─ 云数据库（文档型）       → users/pairs/games/posts/events…  │
│  ├─ 云存储                   → 头像、帖子图、联系二维码         │
│  └─ 云调用 cloud.openapi     → 微信内容安全 API(msgSecCheck)    │
└──────────────────────────────────────────────────────────────┘
```

**关键设计点**
- 身份 = 微信 `openid`，云函数中通过 `cloud.getWXContext().OPENID` 取得，绝不落前端/仓库。
- 所有 UGC 出站前过 `safety` 云函数（微信内容安全 API），**审核不过不发**。
- 双人游戏状态存 `games` 文档，前端用**云数据库 watch** 订阅变更（弱实时、免 WS 集群）。
- 前端用 **uni-app（Vue3）** 开发，编译到 mp-weixin 后运行，经 `wx.cloud` 调用 CloudBase 云函数/数据库（与微信原生一致）。

---

## 2. 模块分解与依赖（源自 Spec §0 能力地图）

| Module | 职责 | 依赖 | 落地产物 |
|--------|------|------|----------|
| F1-identity | 微信登录 + 轻量资料 | — | `users` 集合 + `auth` 云函数 |
| F2-community | 话题广场/信息流/发帖互动 | F1 | `posts`/`topics` + `community` 云函数 |
| F3-matching | 兴趣/属性规则撮合，送两人进游戏 | F1 | `matches` + `match` 云函数 |
| F4-game | 双人默契问答（回合制弱实时） | F3 | `games`/`gameQuestions` + `game` 云函数 |
| F5-growth | 关系成长值（只增不减）+ 5 阶段可视化 | F4 | `pairs` + `growth` 云函数 |
| F6-convert | 轻聊 → S4 解锁联系方式（二维码/复制微信号） | F5 | `messages` + `chat` 云函数 |
| F7-profile | 关系成长主页/成就 | F2,F4,F5 | `growth` 页 + 复用 `pairs` |
| F8-safety | 举报/拉黑/内容审核/隐私 | F1,F2,F4 | `reports`/`blocks` + `safety` 云函数 |
| F9-metrics | 北极星看板（配对率/留存/转化/阶段） | 全部 | `events` + `metrics` 云函数 + 看板 |

**构建顺序**：`F1 → (F2 ‖ F3) → F4 → F5 → F6 → F7`，`F8 / F9` 全程穿插。

---

## 3. 实现顺序与里程碑（Milestones）

| 里程碑 | 内容 | 出口校验（Definition of Done） |
|--------|------|-------------------------------|
| **M0 地基** | **uni-app 脚手架（Vue3+Vite，manifest 指向 mp-weixin）+ CloudBase 初始化** + F1 登录/资料 + 隐私合规 | 能编译 mp-weixin、微信登录、写入 `users`、读取 openid |
| **M1 聚人** | F2 社区 + F8 内容审核基础 + T2 分享裂变 | 能发帖（过审）、信息流可见、分享卡片可拉新 |
| **M2 破冰** | F3 规则匹配 + F4 默契问答（弱实时同步） | 两人能被撮合、进游戏、回合同步、玩完 |
| **M3 升温·导流** | F5 关系成长主线 + F6 轻聊+加微信导流 + F7 主页 | 一起玩后成长值涨、阶段推进、S4 解锁联系方式 |
| **M4 验证** | F9 埋点 + 北极星看板 + 全链路联调 | 能观测 SC1–SC5，跑通"社区→游戏→升温→导流"闭环 |

**并行建议**：M1 的 F2 与 M2 的 F3 在 F1 后可部分并行；F8/F9 每里程碑末尾穿插。

---

## 4. 数据模型（CloudBase 集合草案）

> 字段为 v1 初版，属参数调优（Spec §10 已决议范围，无需再问）。

- **users**（F1）：`openid(PK)`, `nickname`, `avatarUrl`, `gender`, `age`, `city`, `interestTags[]`, `bio`, `createdAt`, `invitedBy`
- **topics**（F2）：`topicId(PK)`, `name`, `description`, `postCount`
- **posts**（F2）：`postId(PK)`, `userId`, `topicId`, `content`, `images[]`, `likes[]`, `commentCount`, `auditStatus`(pass/review/reject), `createdAt`
- **matches**（F3）：`matchId(PK)`, `userA`, `userB`, `score`, `status`(pending/active/done), `createdAt`
- **games**（F4）：`gameId(PK)`, `type`(quiz), `round`, `state`(waiting/playing/done), `players[2]`, `questions[]`, `answers{openid:[]}`, `winner`, `createdAt`
- **gameQuestions**（F4）：`qId(PK)`, `prompt`, `options[2-4]`, `correctPairHint`（用于"默契"判定）
- **pairs**（F5）：`pairId(PK)`, `userA`, `userB`, `growthValue`, `stage`(S0–S4), `firstGameDone`, `gameCount`, `mutualFriendAdded`, `lastInteractionAt`, `milestones[]`, `createdAt`
- **messages**（F6）：`msgId(PK)`, `pairId`, `senderId`, `content`, `type`(text/img/contact), `auditStatus`, `createdAt`
- **reports**（F8）：`reportId(PK)`, `reporterId`, `targetId`, `targetType`(user/post/msg), `reason`, `status`, `createdAt`
- **blocks**（F8）：`blockId(PK)`, `blockerId`, `blockedId`, `createdAt`
- **events**（F9）：`eventId(PK)`, `userId`, `eventName`, `props`, `ts`
- **invites**（T2）：`inviteId(PK)`, `inviterId`, `code`, `invitedUserId`, `createdAt`

---

## 5. 关系成长模型（P1 初值，待 F9 校准）

**累加规则**（作用于 `pairs.growthValue`，只增不减）：

| 事件 | 增量 Δ | 说明 |
|------|--------|------|
| 共同完成一场游戏 | +8 | 破冰主引擎 |
| 一轮有效互聊（双方都回） | +2 | F6 轻聊 |
| 互加游戏好友 | +5 | S2 前置 |
| 连续天数互动（streak） | +3/天，周上限 +15 | 鼓励持续 |
| 双方对局正向互评 | 当次增益 ×1.5 | 双向正向反馈 |

**5 阶段阈值（初版）**：

| 阶段 | 触发条件（AND） | 成长值门限（建议） |
|------|----------------|-------------------|
| S0 陌生 | 初始 | 0 |
| S1 有点意思 | 完成首场游戏 + 互回 | ≥ 12 |
| S2 聊得来的朋友 | 游戏≥3 场 + 互加好友 | ≥ 40 |
| S3 有好感 | 跨 ≥3 天正向互动 | ≥ 90 |
| S4 信任·可加微信 | 满足 S3 且成长值达标 | ≥ 150 |

> 阶段由"事件标志 + 成长值"共同判定；阈值（12/40/90/150）为初值，上线后用 F9 数据回灌校准（Spec §8 SC1–SC5）。

---

## 6. 云函数划分（CloudBase）

| 云函数 | 模块 | 职责 |
|--------|------|------|
| `auth` | F1 | 登录、取/改资料 |
| `community` | F2 | 列帖、发帖（先审后发）、点赞、评论、话题列表 |
| `match` | F3 | 规则撮合（兴趣/属性打分）、建匹配 |
| `game` | F4 | 建局、加入、提交答案、推进回合、状态订阅（watch） |
| `growth` | F5/F7 | 事件触发累加成长值、阶段跃迁、取关系主页 |
| `chat` | F6 | 发消息（先审后发）、取消息、S4 解锁联系方式（生成二维码/复制微信号） |
| `safety` | F8 | 举报、拉黑、内容安全异步回调处置 |
| `metrics` | F9 | 埋点上报、看板聚合 |
| `invite` | T2 | 生成/核销分享邀请码 |

---

## 7. 风险与缓解（Risks）

| 风险 | 等级 | 缓解 |
|------|------|------|
| 冷启动空城（T2） | 高 | 社区先行 + 分享裂变；M1 先聚内容再开匹配 |
| 弱实时同步丢/乱序（T1） | 中 | 回合制 + 云数据库 watch；客户端乐观 UI + 服务端权威状态 |
| 内容安全漏审（T3） | 高 | 先审后发 + 异步兜底 + 举报快速处置（SC5 ≥95%） |
| 关系成长阈值失真（P1） | 中 | 初值上线 + F9 回灌；A/B 调参 |
| 微信加好友闭环摩擦（T3 修正） | 中 | S4 才解锁；二维码长按识别 + 复制微信号双通道 |
| 隐私合规（T3） | 高 | 隐私政策 + 授权弹窗 + 不落明文 + 最小必要字段 |
| uni-app 与 CloudBase 集成（新框架） | 中 | M0 先用最小样例打通 `wx.cloud` 调用闭环，再铺开；云函数框架无关可复用 |

---

## 8. 校验检查点（Verification Checkpoints）

- **M0 出口**：`auth` 登录返回 openid；`users` 写入成功（手动 + 单测）。
- **M1 出口**：发帖经 `safety` 审核；违规样例被拒（集成测，含违规回归）。
- **M2 出口**：双设备进同一局、回合状态一致（端到端）。
- **M3 出口**：一起玩后 `pairs.growthValue` 递增、阶段按 §5 跃迁；S4 能解锁联系方式（单元 + 集成）。
- **M4 出口**：F9 能观测 SC1–SC5；跑通最小闭环（社区→游戏→升温→导流）。

> 全链路以"**先打通最小闭环验证 SC4（真交到伴侣）**"为最高优先级，不在 M4 才联调。

---

## 9. 签字记录（Plan 层开放项已决议，2026-08-26）

1. **前端框架 → uni-app（Vue3 + Vite，编译 mp-weixin）**：用户决定覆盖 Spec 默认原生；现有 workspace 原生骨架于 M0 迁移。
2. **阈值初值 → 批准**：§5 的 12/40/90/150 作为首版上线值，上线后用 F9 数据回灌校准。
3. **里程碑节奏 → 批准**：M0–M4 作为 v1 交付节奏，每里程碑可独立评审。

> ✅ 本 Plan **已批准**，进入 **Phase 3（Tasks 拆分）**。Tasks 拆分见 `tasks/todo.md`。仍不写任何实现代码，直至你逐级签字放行。
