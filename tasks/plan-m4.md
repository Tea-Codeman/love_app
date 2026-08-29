# M4 规划：验证（埋点 F9 + 北极星看板 + 阈值校准）

> 本文档是 **M4 阶段执行规划**，基于 `spec/SPEC.md`（§3 能力地图 F9、§8 成功标准 SC1–SC5）、`tasks/plan.md`（§4 数据模型、§5 成长模型、§6 风险）、`tasks/todo.md`（M4 卡）与 `HANDOFF.md`（2026-08-30 实测状态）。
> 状态：**已定稿**（2026-08-30 三项范围决策已拍板）。不写实现代码，直至逐级签字放行。
> **开工前置：M3 真机验证通过**（决策 2）——在此之前不动 M3 已部署的代码。
> 前置：M0/M1 已完成、M2 已收尾、**M3 代码已全部完成并部署（v0.3.0，待真机验证）**。

---

## 0. 目标与出口（Definition of Done）

M4 让 v1「有没有真的帮到人」这件事**可被观测、可被校准**——否则 SC1–SC5 永远只是纸面假设。

**出口校验（todo.md Checkpoint M4）：**

- [ ] 能观测 **SC1–SC4**（看板有数、口径可复算）；**SC5 本次为数据缺口**（无处置能力，需人工终审放行）
- [ ] 最小闭环「社区 → 游戏 → 升温 → 导流」跑通，**SC4 可归因**
- [ ] 关系成长阈值校准结论已记录（12/40/90/150 → 校准值或「样本不足、沿用初值」）
- [ ] 人工终审 → 进入 Phase 4 Implement（逐任务落地）

---

## 1. 已确认的架构决策（直接采用，不重议）

1. **埋点以服务端入桩为主**。SC1–SC5 是产品决策依据，绝不能依赖客户端自觉上报（漏报/伪造/版本不一致都会让结论失真）。凡是有云函数的动作（`match.accept`、`game` 结束、`chat.send/contact`、`safety.report`）**一律在云函数内上报**；前端只补 `app_open` 这类纯客户端事件。
2. **`events` 为事件流（每发生一条），`metrics` 云函数负责写入校验 + 看板聚合**（plan.md §4 已定）。
3. **成长值只增不减、阶段读时派生**（M3 已落地，不重议）。M4 只做「读数据 → 回灌阈值」。
4. **阈值 12/40/90/150 是初值**，用 F9 早期数据回灌校准（Spec §8、plan.md §5）。**样本量不足时明确不校准**，避免小样本过拟合。
5. **埋点绝不能阻断业务**：所有上报包 `try/catch` + 失败静默（打日志），任何埋点故障都不允许让「一起玩 / 发消息」失败。
6. **隐私红线**：`props` 只放 **ID / 枚举 / 数值**，**禁止**放消息内容、微信号、昵称、头像等任何 PII。事件表不含正文。

---

## 2. 前置依赖

- [x] **集合 `events` / `metrics` 已建且为空**（M3.0 一并建的，2026-08-30 实测）✅
- [ ] **M3 真机验证通过**（见 §3 决策 2：入桩会改动已部署代码，时机需拍板）

**`events` 字段**（在 plan.md §4 基础上扩充 2 个字段，便于聚合与按对统计）：

| 字段 | 类型 | 说明 |
|---|---|---|
| `eventName` | string | 事件名，服务端白名单校验（见 §4 清单） |
| `userId` | string | 触发者 openid（云函数从 `getWXContext()` 取，**不信任前端传值**） |
| `pairId` | string | 关系维度事件填 `pairs._id`；用户维度事件留空 |
| `props` | object | 仅 ID / 枚举 / 数值；单条 ≤1KB |
| `ts` | number | 发生时间戳 |
| `day` | string | `YYYY-MM-DD`，冗余字段，按天聚合免计算（留存/DAU 直接 groupBy） |

---

## 3. 范围决策（✅ 已拍板 2026-08-30）

### 决策 1：看板形态 → **A · 云函数返回 JSON**
`metrics.dashboard` 返回聚合 JSON，用 MCP / 控制台 / 本地脚本查看。**不建小程序内看板页**，因此**不引入管理员鉴权**（白名单只是"隐藏入口"而非真鉴权，不值得为它背上安全债）。
→ §5 M4.2 只需实现 `metrics.dashboard`，无前端页面。

### 决策 2：埋点入桩时机 → **A · 等 M3 真机验证通过后**
M4.1 会改动 `game` / `chat` / `match` / `safety` 四个刚部署完、尚未真机验证的云函数。
**先跑完 M3 真机验证（8 步）再插桩**，保证验证基线干净、缺陷可归因。M4.1 开工前置条件即"M3 Checkpoint 通过"。

### 决策 3：缺口补齐 → **B · 只补 SC4 自评**
- **做**：关系主页「我们在一起了 🎉」自评入口 → 写 `pair.milestones` + 上报 `relation_confirmed`（M4.4）。
- **不做**：`safety.handleReport` 处置能力。**SC5 在 M4 阶段为「数据缺口」**——`reports` 无处置动作与处置时间，算不出 24h 处置率。Checkpoint M4 的 SC5 一项需人工终审放行，处置能力留到 M5。

---

## 4. 事件清单（F9 · 服务端白名单）

**13 个事件，每个都明确"为什么要它"**——没有消费方的事件一律不上。

| # | eventName | 触发点（云函数/前端） | 维度 | 关键 props | 服务于 |
|---|---|---|---|---|---|
| 1 | `app_open` | 前端 `onLaunch` | user | — | DAU / SC2 留存分母 |
| 2 | `profile_completed` | 前端资料保存成功 | user | — | 漏斗（资料完整度） |
| 3 | `mbti_completed` | `auth.updateProfile`（mbti 写入） | user | `mbti` | 漏斗 / 撮合质量 |
| 4 | `recommend_view` | 前端推荐页首屏（每次进页 1 条） | user | `count` | 曝光→配对转化 |
| 5 | `match_accept` | `match.accept` 成功 | pair | `score` | **配对分母**（SC1–SC3 都用） |
| 6 | `game_join` | `game.joinGame` | pair | — | 漏斗（邀请→加入流失点） |
| 7 | `game_done` | `game` 终局（done 分支） | pair | `tacitCount`, `rounds` | 成长主引擎 / 漏斗 |
| 8 | `pair_stage_changed` | `growth.addGrowth`（阶段前后比对） | pair | `from`, `to`, `growthValue` | **SC1 阶段分布** |
| 9 | `chat_unlocked` | `chat.send` 首次通过 S1 门禁 | pair | `growthValue` | 漏斗（S1 转化） |
| 10 | `message_sent` | `chat.send` 落库后 | pair | `auditPassed`(bool) | 互动量 / 内容安全观测 |
| 11 | `contact_unlocked` | `chat.contact` 成功返回 | pair | `growthValue` | **SC3 加微信转化** |
| 12 | `relation_confirmed` | 关系主页自评入口（决策 3） | pair | — | **SC4 北极星** |
| 13 | `report_created` / `report_handled` | `safety.report` / 处置动作 | user | `targetType`, `reason` / `durationMs` | **SC5**（处置能力见决策 3） |

**不上报**：消息正文、微信号、昵称、头像——任何 PII 都不进 `events`。

---

## 5. 任务拆分（M4.0 – M4.5）

### M4.0 前置

- [x] 确认 `events` / `metrics` 集合存在（M3.0 已建 ✅）
- [ ] **M3 真机验证通过**（决策 2 已定：在此之前不动 M3 已部署代码）——这是 M4.1 的开工闸门

### M4.1 F9 全链路埋点

- 新建 `cloudfunctions/metrics/index.js`：
  - `track`（单条）/ `trackBatch`（批量，前端攒批）：**服务端校验** `eventName` 白名单、`props` 大小与类型、`userId` 取 `getWXContext().OPENID`（**绝不信任前端传的 userId**）、单用户单事件限流。
  - 写入失败**静默**（打日志），绝不抛给业务方。
- 新建 `src/utils/track.js`：统一上报封装（攒批 10 条 / 10s、失败静默、页面 `onShow` 自动 `app_open`）。
- **入桩点**（按 §4 清单逐条落到具体云函数/前端文件）。
- **验收**：Integration —— 跑一遍主链路（登录→资料→匹配→一起玩→答题→聊天→联系方式），断言 13 个事件全部入库、无 PII、白名单外的事件名被拒。

### M4.2 F9 北极星看板

- `metrics.dashboard`：按时间窗聚合返回 JSON（决策 1 选定形态后实现）。
- **指标口径（必须写死，否则数字不可复算）**：
  - **SC1**：`growthValue ≥ 40（S2）` 的 pair 数 ÷ 期间产生过 ≥1 次 `game_done` 的 pair 数，目标 ≥30%
  - **SC2**：配对日 +7 天当天有任意互动事件（`game_done` / `message_sent`）的 pair 数 ÷ 期间 `match_accept` 的 pair 数，目标 ≥25%
  - **SC3**：`contact_unlocked` 去重 pair 数 ÷ 期间 `match_accept` pair 数，目标 ≥15%
  - **SC4**：`relation_confirmed` 的 pair 数 + 人工回访记录（定性证据）
  - **SC5**：`report_handled` 中 `handledAt - createdAt ≤ 24h` 的比例，目标 ≥95%
  - 附带漏斗：`recommend_view → match_accept → game_join → game_done → chat_unlocked → contact_unlocked`
- **验收**：Manual —— 注入样例数据，手工复算一遍看板数字，口径一致。

### M4.3 全链路联调 + 阈值校准

- 双设备跑通最小闭环；用 F9 数据回灌阈值。
- **校准方法**（避免拍脑袋）：按成长值分桶，观察每桶的"关系质量代理指标"（是否互聊 ≥3 轮、是否解锁联系方式、D7 是否仍互动），找到指标跃迁明显的切点作为新阈值。
- 产出 `tasks/threshold-calibration.md`：样本量、分桶表、结论。**样本不足时明确写「沿用初值」**。
- **验收**：Manual 端到端走通 + 校准结论已记录。

### M4.4 SC4 关系确认自评（决策 3 已定：做）

- 关系主页加「我们在一起了 🎉」入口 → 写 `pair.milestones` + 上报 `relation_confirmed`。
- 实现走 **M3 已有的 `growth` 云函数新增 action**（`confirmRelation`），不新建函数：同一 `pair` 的写入口径集中在一处，避免 pairs 被多处改写。
- 幂等：同一 pair 只记一次（重复点击不重复写 milestones、不重复上报）。

### ~~M4.5 SC5 违规处置能力~~ —— 本次不做（决策 3）

- 需要 `safety.handleReport`（置 `status` + `handledAt`）+ 处置入口。**留到 M5**。
- 影响：M4 期间 **SC5 无法计算**，Checkpoint M4 该项需人工终审放行。已在 §0 出口校验与 §5 指标口径中标注。

---

## 6. 校验（Verification）

| 关注点 | 层级 | 说明 |
|---|---|---|
| 事件白名单 / props 校验 / 限流 | Unit | `metrics.track` 的入参边界 |
| 主链路 13 个事件全入库、无 PII | Integration | 跑一遍完整链路后查 `events` |
| 看板口径可复算 | Manual | 样例数据手工复算 |
| 埋点不阻断业务 | Integration | 把 `events` 写权限搞坏，业务链路仍应全通 |
| 阈值校准结论 | Manual | 分桶表 + 样本量 |

---

## 7. 风险与缓解

- **埋点污染业务**：全部 `try/catch` 静默 + 单向写；用「写坏 events 权限业务仍通」做验收。
- **前端漏报导致 SC 失真**：SC 相关事件**全部服务端入桩**（决策 1），前端只补 `app_open`。
- **小样本过拟合阈值**：样本量不足明确不校准，写进校准记录。
- **PII 入事件表**：`props` 白名单制（只收 ID/枚举/数值），评审时逐字段看。
- **M3 未验证就入桩**：见决策 2，倾向等验证通过再动。
- **看板鉴权**：若选 B/C，管理员白名单只是"隐藏入口"不是真鉴权，需在文档里写明限制。

---

## 8. 决策记录（✅ 已拍板 2026-08-30）

| # | 决策 | 选择 |
|---|------|------|
| 1 | 看板形态 | **云函数返回 JSON**（MCP / 控制台 / 脚本查看），不做小程序内看板页，**不引入管理员鉴权** |
| 2 | 入桩时机 | **等 M3 真机验证通过后**再插桩（保基线干净、缺陷可归因） |
| 3 | SC4 / SC5 缺口 | **只补 SC4 自评入口**；SC5 处置能力留到 M5，M4 期间标为数据缺口 |

> 规划已定稿。**下一步**：用户跑 M3 真机验证（8 步，见 `tasks/verification-log.md`）→ 通过后按 M4.1 → M4.4 逐级签字放行实现。
