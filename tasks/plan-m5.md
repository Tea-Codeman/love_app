# M5 规划：SC5 处置能力（F8 闭环）+ app_open 双计修复

> 本文档是 **M5 阶段执行规划**，基于 `spec/SPEC.md`（§8 SC5：24h 处置率 ≥95%）、`tasks/plan.md`（F8-safety）、`tasks/plan-m4.md`（决策 3：处置能力留 M5）、`HANDOFF.md`（2026-08-30 实测状态）。
> 状态：**已签字放行并全部落地**（2026-08-30。M5.1–M5.4 完成，safety/metrics 已部署 Status=Active，dashboard 冒烟 PASS。提交 `993e1c0`/`6a7c486`/`74e0cf0`/`022cdad`。遗留：`admins` 集合待建 + 管理员 openid 待插入；真机验收待做）。
> 冷启动准备（资质/类目/上线清单）整线延后——大头是用户侧外部依赖（账号主体 + 社交类目资质），本轮不碰。

---

## 0. 目标与出口（Definition of Done）

M5 补齐 M4 留下的最后一块观测缺口，让 **SC1–SC5 全部有数**：

- [ ] `reports` 有 status 流转（pending → handled/dismissed）+ `handledAt`，处置动作**幂等**且**仅管理员可调**
- [ ] `report_handled` 入埋点白名单，上报不携带 PII
- [ ] `metrics.dashboard` SC5 出真实读数（替代 `no_data`），Checkpoint M4 的 SC5「人工终审放行」项转为「有数」
- [ ] `app_open` 冷启动双计修复（onLaunch + 紧随 onShow 只报一次）
- [ ] 人工终审 → 逐任务落地

---

## 1. 现状盘点（2026-08-30 只读核实，不重议）

**F8/safety 已有**（M1.2/M1.4 建成，165 行）：
- `report`：举报入队 `reports` 集合（status=pending, createdAt），**已上报 `report_created`**（props 仅 targetType，无 PII）
- `block / unblock / listBlocks`：拉黑闭环完整，服务端过滤（防绕过）
- `checkText / checkImage`：本地关键词兜底；`USE_WX_SECURITY=false`，切官方 API 待资质就绪（业务代码无需改）

**缺的只有处置闭环**：
- 无 `handleReport` 动作 → `reports` 永远停在 pending，无 `handledAt`
- `report_handled` 未入白名单（现上报会虚增 SC5 分母——safety 内已有注释警告）
- `metrics.dashboard` SC5 硬编码 `no_data`

---

## 2. 已拍板决策（2026-08-30）

### 决策 1：处置交互 → **`safety.handleReport` + 管理员 openid 白名单**
- 服务端校验调用者身份，非管理员返回 403（白名单在服务端，不是前端隐藏入口，不算安全债）
- **白名单载体（实施时二选一，推荐 a）**：
  - a) `admins` 集合（openid + createdAt）——增删管理员**无需重部署**，原型期最灵活
  - b) 云函数环境变量 `SAFETY_ADMINS`——改名单要重部署
- 处置参数：`{ reportId, decision: 'handled' | 'dismissed', note? }`；`note` 截断 200 字，**不入埋点**（自由文本可能含 PII）
- **幂等**：report 已非 pending 时返回 `alreadyHandled`，不重复写、不重复上报

### 决策 2：SC5 计算源 → **`reports` 集合（权威源），`report_handled` 事件仅作观测流**
- dashboard 读 `reports`：`24h 处置率 = handledAt-createdAt ≤24h 的 handled 数 ÷ 全部 handled 数`，另附 `pendingCount`
- 理由：status/handledAt 在 reports 上是单一权威事实；从 events 算会有重复处置/幂等坑。与 SC1–SC4 用 events 的口径差异将在 dashboard `_note` 里写明
- `report_handled` 上报 props：`{ targetType, decision }`（user 维度，无 pairId）

### 决策 3：处置动作的最小边界 → **只标记 + 留痕，不做自动处置**
- 本期不做：自动下架内容、封号、通知举报人。原型期误伤成本高，自动处置（如下架 target 内容）留后续有真实数据后再议
- SC5 口径不受影响：24h 内「有人看过并标记」即算处置

### 决策 4：app_open 双计修复 → **onLaunch 打冷启动标记，紧随的 onShow 跳过一次**
- 模块级 flag：`onLaunch` 报后置 true；`onShow` 见 true 则清零并跳过本次上报；之后每次切前台正常报
- 纯前端改动，不涉及云函数；修复后冷启动 events 里不再出现毫秒级成对的 app_open

---

## 3. 任务分解

| # | 任务 | 落点 | 要点 |
|---|---|---|---|
| M5.1 | `safety.handleReport` | `cloudfunctions/safety/index.js` | 管理员校验（admins 集合）→ 幂等标记 status/handledAt/handledBy/decision/note → 上报 `report_handled` |
| M5.2 | 白名单加 `report_handled` | `metrics-core.js` + `sync:core` | 只加事件名，不改校验逻辑；同步到所有副本 |
| M5.3 | dashboard SC5 消费 | `cloudfunctions/metrics/index.js` | 读 `reports` 集合算 24h 处置率 + pendingCount；替换 no_data 分支；`_note` 更新口径说明 |
| M5.4 | app_open 双计修复 | `src/App.vue` | 决策 4 的 flag 方案，~6 行 |
| M5.5 | 文档 + 原子提交 | HANDOFF / todo / verification-log | feat（safety+metrics+App.vue）/ docs 分提；部署 safety、metrics 并按异步惯例轮询 Active + CodeInfo 核验 |

**依赖顺序**：M5.2 → M5.1（白名单先行）；M5.3 依赖 M5.1 的数据形态；M5.4 独立可并行。

---

## 4. 验收标准

1. **SC5 闭环（真机 + 控制台）**：普通用户举报一条 → 管理员身份调 `handleReport` → `reports.status` 变更 + `handledAt` 落库 → `metrics.dashboard` SC5 出读数；非管理员调用返回 403；重复 handle 返回 alreadyHandled
2. **双计修复**：冷启动小程序，`events` 中不再出现同一用户毫秒级成对的 `app_open`；切后台→回前台仍正常各报一条
3. **编译/部署**：`build:mp-weixin` DONE；safety、metrics 部署后 `Status=Active` 且 CodeInfo 含新动作（异步部署惯例：轮询后才算落地）

---

## 5. 明确不做（本轮）

- 冷启动准备整线（资质/类目/隐私复查/上线清单）——用户侧外部依赖未就绪，整线延后
- 自动处置（下架/封号/通知）
- UTC 时区修复（streak dayOf）、存量老对回填、删 `src/utils/invite.js`——沿用此前「暂缓」决策
