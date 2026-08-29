# M3 规划：升温·导流（关系成长 F5 + 轻聊导流 F6 + 关系主页 F7）

> 本文档是 **M3 阶段执行规划**，基于 `spec/SPEC.md`（v1.0）、`tasks/plan.md`（已批准）、`tasks/todo.md`（M3 卡）与 `HANDOFF.md`（2026-08-29 实测修正）。  
> 状态：**已定稿**（2026-08-29 三项范围决策已拍板）。M3.0 集合已建 ✅，**M3.1 实现中**（2026-08-30）。  
> 前置：M0/M1/M2 已完成并通过真机验证（含 MBTI 落库、拉黑闭环、契合度加成显示均正常）。

---

## 0. 目标与出口（Definition of Done）

M3 打通"一起玩 → 关系成长 → 解锁联系方式"的升温·导流闭环，是验证北极星 **SC4（真交到伴侣）** 的前提。

**出口校验：**

- [ ] 一起玩后 `pairs.growthValue` 递增、阶段按阈值（12/40/90/150）跃迁
- [ ] S4 能解锁联系方式（二维码长按识别 + 复制微信号双通道）
- [ ] 跑通「社区→游戏→升温→导流」最小闭环（SC4 前提）
- [ ] 人工评审后进入 M4

---

## 1. 已确认的架构决策（直接采用，不重议）

1. **`pairs` 为权威累计源**：每对用户一条（`pairKey = sorted(openidA, openidB)`）。`recommend` 改读 `pairs`（O(1)）；M2「聚合 done matches」仅作**首次回填**来源。不推翻 M2 代码，平移即可（用户已对齐）。
2. **成长值只增不减**：一律 `db.command.inc(正数)`，负值/0 拒绝。
3. **阈值沿用 12/40/90/150**（S1/S2/S3/S4），上线后 F9 校准。
4. **聊天先审后发**（复用 `safety` 本地兜底，企业资质就绪切 `USE_WX_SECURITY=true`）；**S1 解锁**轻聊。
5. **联系解锁仅 S4**：二维码长按识别 + 复制微信号双通道（官方**无**一键加好友 API，T3 修正）。
6. **阶段由 `growthValue` 派生（读时计算）**，`pairs.stage` 仅作缓存冗余，避免漂移。

---

## 2. 前置依赖（必须在写 M3 代码前完成）

- [x] 控制台**手动建集合**（代码不自动建，用户已否决）：`pairs`、`messages` 为 M3 必需；`events`、`metrics` 为 M4 用（建议本次一并建，避免回头）。
  - **【2026-08-30 实测】4 个集合均已建且为空** ✅（`readNoSqlDatabaseContent` 逐个探测通过）。**M3.0 已完成，M3.1 可开工。**
  - **`pairs`** 字段（来自 plan §4 + M3 扩充）：`pairId`, `userA`, `userB`, `growthValue`, `stage`, `firstGameDone`, `gameCount`, `tacitTotal`, `lastGameAt`, `lastInteractionAt`, `weekStreakAdded`, `lastStreakDay`, `milestones[]`, `createdAt`, `updatedAt`
  - **`messages`** 字段：`msgId`, `pairId`, `senderId`, `content`, `type`(text/img/contact), `auditStatus`(pass/review/reject), `createdAt`

---

## 3. 范围决策（✅ 已拍板 2026-08-29）

Plan §5 列了 5 类成长事件，其中两类依赖 M2 **尚未建** 的系统。已决策：**M3 v1 只做现成三项**，`+5` / `×1.5` 留到 M4 或作为可选，避免为成长值硬造两个新系统。

| 事件            | 增量            | M3 v1                       |
| ------------- | ------------- | --------------------------- |
| 共同完成一场游戏      | +8            | ✅ 做（game 结束写入 pairs）        |
| 一轮有效互聊（双方都回）  | +2            | ✅ 做（chat 双向检测）              |
| 连续天数互动 streak | +3/天（周上限 +15） | ✅ 做（基于 `lastInteractionAt`） |
| 互加游戏好友        | +5            | ❌ 不做（需「好友/伴侣」概念，M2 未建）      |
| 双方对局正向互评      | 当次 ×1.5       | ❌ 不做（需赛后互评系统，M2 未建）         |

**其他已拍板项：**

- **`wechatId`**：新增 `users.wechatId` 字段（资料页授权输入；`auth.sanitizeProfile` 白名单同步加，否则静默丢弃；仅 S4 展示给对方）。
- **集合建表**：本次一并建 `pairs` / `messages` / `events` / `metrics` 四个（代码不自动建，需控制台手动建）。

---

## 4. 任务拆分（M3.0 – M3.6）

### M3.0 前置：建集合

- 控制台建 `pairs` / `messages`（+ 选建 `events` / `metrics`）。
- **验收**：`readNoSqlDatabaseStructure` 能列出这 4 个集合。

### M3.1 F5 成长累加 + pairs 权威源

- `growth` 云函数：`ensurePair`（按 pairKey 取/建）、`addGrowth`（inc 正数、只增不减）、`getPair`（读时派生 stage）。
- **`game.submitAnswer` 在 `state→done` 时**原子 upsert `pairs`：`growthValue +8`、`tacitTotal += lastTacit`、`gameCount +1`、`firstGameDone=true`、`lastGameAt=now`。（M2 现有"翻 matches→done + 落盘 lastTacit/lastRounds"保留不动）
- **`match.recommend` 改读 `pairs`（O(1)）**：默契度取自 `pairs.tacitTotal`；首访 `pairs` 缺失时回算 M2 聚合 done matches 并写入，之后走 O(1)。
- **验收**：Unit 累加/只增不减断言；Integration 模拟 game done → pairs 正确更新；recommend 读 pairs 字段正确。
- 涉及：`cloudfunctions/growth/index.js`（新建）、`cloudfunctions/game/index.js`、`cloudfunctions/match/index.js`、`src/utils/growth.js`。
- **实现状态（2026-08-30）✅ 已部署**：`growth`（getPair / listPairs / addGrowth）+ `game` done 分支原子累加 + `match.recommend` 改读 pairs（首访回填）。云端实测：`addGrowth 8` → 含 streak 共 11；`delta=-5` 被拒（只增不减）；`growth` 与 `match` 线上代码均已核验。

### M3.2 F5 阶段跃迁 + 可视化


- 阶段映射（读时）：`growthValue` ≥150→S4，≥90→S3，≥40→S2，≥12→S1，否则 S0。
- `growth-bar` 组件：展示阶段、进度、里程碑（首局/默契达人/连续 N 天等）。候选卡与关系主页复用。
- **验收**：Unit 阈值边界判定（12/40/90/150 临界值）；Manual 进度条随成长值推进。
- 涉及：`cloudfunctions/growth/index.js`、`src/components/growth-bar.vue`。
- **实现状态（2026-08-30）✅ 已提交（待真机构建验证）**：`growth-bar` 组件（阶段标签 + 进度条 + 距下阶段差值）+ 匹配候选卡接入；成长值为 0 时不渲染。阶段一律读时派生，不读 `pairs.stage` 缓存。

### M3.3 F6 轻聊（先审后发）

- `chat` 云函数：`sendMessage`（先审后发，复用 `safety`）、`listMessages`、`markMutualChat`（检测到双方都发过消息 → `growth +2`）。
- `messages` 集合 + `chat` 页：S1 解锁，复用 `src/utils/realtime.js`（watch 优先、轮询兜底，M2 已验证）。
- **验收**：Integration 违规消息被拒；双向互聊后 pairs +2。
- 涉及：`cloudfunctions/chat/index.js`（新建）、`src/pages/chat/`、`src/utils/realtime.js`。
- **实现状态（2026-08-30）✅ 已部署**：
  - 动作命名为 `send` / `list`（**偏离草稿**的 `sendMessage` / `listMessages`）；互聊判定内联在 `send` 内（「本条是回复对方上一条」即结算 +2，天然幂等），**未建 `markMutualChat`**——独立动作会多一次往返且需额外状态。
  - 审核复用 `safety.checkText`、成长值复用 `growth.addGrowth`（均走云函数调用），避免违规词表/阈值两份漂移；审核故障时 **fail-closed**（拒发）。
  - 聊天页用 **3s 轮询**，未用 `realtime.js`：`messages` 由服务端写入，客户端直读会被数据库安全规则拦截（与匹配大厅同一约束）。

### M3.4 F6 解锁联系方式（含 wechatId 落库）

- **新增 `users.wechatId`**（`auth.sanitizeProfile` 严格白名单必须同步加，否则静默丢弃；资料页增加授权输入项）。
- S4 解锁页：展示微信二维码（云存储存图或前端生成）+ 复制微信号双通道；S3 及以前无入口。
- **验收**：Manual S3 态无入口、S4 态出现联系方式；二维码长按可识别、复制可用。
- 涉及：`cloudfunctions/auth/index.js`、`cloudfunctions/chat/index.js`、`src/pages/profile/`、`src/pages/chat/contact.vue`（新建）。
- **实现状态（2026-08-30）✅ 已部署**：
  - 页面实际落在 **`src/pages/contact/contact.vue`**（**偏离草稿**的 `src/pages/chat/contact.vue`），与 `chat` 页平级，路由更清晰。
  - `auth.sanitizeProfile` 白名单已加 `wechatId`（6–20 位、字母开头）+ `wechatQrUrl`（限 http(s)）；`src/utils/validate.js` 同步加校验，避免服务端「静默丢弃」让用户误以为保存成功。
  - 二维码走 **`users.wechatQrUrl`**（用户自填图片链接，长按识别）；**未接云存储上传**——原型期先跑通双通道，上传留待 M4。
  - 微信号只有 `chat.contact` 一个出口返回，其余接口一律不带。

### M3.5 F7 关系成长主页

- 关系成长页：复用 `pairs` 展示成长轨迹、阶段、里程碑/成就，提供回访钩子。
- **验收**：Manual 进入主页看到阶段与成就。
- 涉及：`cloudfunctions/growth/index.js`、`src/pages/growth/`（新建）。
- **实现状态（2026-08-30）✅ 已部署**：页面实际落在 **`src/pages/relation/relation.vue`**（**偏离草稿**的 `src/pages/growth/`，避免与 `growth` 云函数同名混淆）。`growth.listPairs` 服务端批量 join `users` 补齐对方资料（20/批），返回 `peerId` + `peer{}`，查不到降级「未知用户」；已实测通过。

### M3.6 连续天数 streak（建议并入 M3.1）

- 每次互动跨天（`lastStreakDay` 不同）`growthValue +3`，`weekStreakAdded` 周上限 +15（每周一清零）。基于 `lastInteractionAt`。
- 涉及：`cloudfunctions/growth/index.js`。
- **实现状态（2026-08-30）✅ 已随 M3.1 落地**：`streakDeltaFor()` 内联在 `addGrowth` 中（同一天只给一次、换 ISO 周清零、周上限 15）。实测 `addGrowth 8` → base 8 + streak 3 = 11。

---

## 5. 校验（Verification）

| 关注点                  | 层级          | 说明              |
| -------------------- | ----------- | --------------- |
| 成长累加 / 只增不减 / 阈值边界   | Unit        | 核心逻辑先测          |
| game done → pairs 更新 | Integration | 模拟事件断言 pairs 变化 |
| chat 双向 → +2         | Integration | 双向消息触发增量        |
| S4 解锁联系方式            | Manual      | 真机双设备闭环         |
| 最小闭环                 | E2E         | 一起玩→成长→阶段→导流    |

---

## 6. 风险与缓解

- **聊天实时性**：沿用 watch + 轮询兜底（M2 已验证），秒级足够。
- **wechatId 隐私**：明确告知用户仅在 S4 展示给对方；资料页单独授权输入，不强制。
- **pairs 回填一致性**：recommend 读 pairs 前确保 game 已写；首访回填用 M2 聚合，幂等。
- **不膨胀 M3**：`+5`（互加好友）、`×1.5`（互评）依赖未建系统，M3 v1 不做（见 §3）。

---

## 7. 决策记录（已拍板 2026-08-29）

| # | 决策            | 选择                                                          |
| - | ------------- | ----------------------------------------------------------- |
| 1 | M3 v1 成长事件范围  | 仅现成三项（+8 / +2 / streak+3）；不做 +5、×1.5                        |
| 2 | `wechatId` 来源 | 新增 `users.wechatId` 字段（资料页授权输入 + `auth.sanitizeProfile` 同步） |
| 3 | 集合建表          | 本次一并建 `pairs` / `messages` / `events` / `metrics`           |

> **进度（2026-08-30）**：M3.0 ✅ 集合已建 ｜ M3.1–M3.6 ✅ 代码全部完成并部署（云端已核验）｜ **待真机验证**（需先 `npm run dev:mp-weixin` 重新构建 `dist/dev`）→ 人工评审后进入 M4。
>
> 已部署/改动的云函数：`growth`（新建）、`chat`（新建）、`game`、`match`、`auth`。新增前端：`src/utils/growth.js`、`src/components/growth-bar.vue`、`src/pages/chat/`、`src/pages/contact/`、`src/pages/relation/`。
