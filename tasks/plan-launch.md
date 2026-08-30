# 收官/灰度上线（受限邀请原型）规划

> 基于 `HANDOFF.md`（M8.1 降级决策 2026-08-31：资质申请中，v1 走「受限邀请原型验证」不公开上架）+ `spec/SPEC.md`（T2 邀请裂变、§上线路径决策：个人账号先做原型验证，上架门槛延后）。
> 状态：**草稿，范围待拍板（M8.1 降级后启动「往后」阶段）**。**不写实现代码，直至签字放行。**

## 1. 本轮目标

在 M8.1 降级（个人账号 · 受限邀请原型 · 不公开上架）前提下，把已建成的 v1 推进到「可受限邀请实测」的终态：

- **LA.1 终态部署核验**：7 云函数 `Status=Active` + 前端 `build:mp-weixin` DONE；云端代码与 M7.1 核验态一致（M8 未改云函数源码，仅前端隐私文案 + DB 索引）；重点复核 `safety` 的 `USE_WX_SECURITY=false`（降级兜底）确为线上态。
- **LA.2 主链路冒烟 + 受限邀请 gate（只读）**：代码审查确认 社区→游戏破冰→关系升温→加微信导流 主链路接线完整；确认 T2 邀请裂变 gate（confirmInvite.js / 邀请码）作为「受限邀请」入口，新用户需邀请方可进入。
- **LA.3 收官文档（Agent 起草）**：`tasks/launch-readiness.md` = 交付说明（M0–M8 已完成项）+ 受限邀请上线就绪清单 + 已知限制（M8.1/M8.3 延后至资质就绪）+ 用户手动步骤（资质申请→flip M8.3→公开上架）+ 阈值回灌条件（自然用户 ≥10 对）。
- **LA.4 交接更新**：HANDOFF 新增「收官/灰度上线」状态段 + 接手指南补 LA 指引；`tasks/todo.md` 新增 LA 任务卡 + Checkpoint。

## 2. 任务卡

### Task LA.1: 终态部署核验（S）

**Description:**
- 确认 7 云函数 `Status=Active`（env `love-app-server-d2fhg32320d65c12`）：growth/game/chat/match/safety/auth/metrics。
- 前端 `npm run build:mp-weixin` DONE（EXIT=0），`src/utils` 完整性校验通过。
- 云端代码与 M7.1 核验态一致：M8 仅改前端 `privacy.vue`（文案）+ DB 索引，**未改云函数源码**；故云函数态 = M7.1 部署态（ModTime 2026-08-30 23:01:15，已 grep `shanghaiDate` 实证）。
- 🔻 重点复核 `safety`：下载云端 `safety` 代码包归一化 grep `USE_WX_SECURITY` → 确认线上为 `false`（降级兜底，未 flip）。

**Acceptance criteria:** 7 函数 Active；build EXIT=0；safety 线上 `USE_WX_SECURITY=false` 实证。
**Dependencies:** 无
**Files likely touched:** 文档（核验结论入 launch-readiness.md / verification-log）
**Estimated scope:** S

### Task LA.2: 主链路冒烟 + 受限邀请 gate（S，只读）

**Description:**
- 代码审查确认 v1 主链路 社区→游戏破冰→关系升温→加微信导流 接线完整（前端路由 + 云函数动作 + 数据模型）。
- 确认 T2 邀请裂变 gate 作为「受限邀请」入口：新用户需邀请码/分享卡片方可进入或配对（confirmInvite.js / ensurePendingInviter / storage 键）；记录该 gate 即「受限邀请」机制，无需新增代码。
- 不重加 `onShareAppMessage`/邀请入口（HANDOFF 已否决）；不擅自改 invite 机制。

**Acceptance criteria:** 主链路调用点齐备；受限邀请 gate 存在且为唯一准入路径；结论入文档。
**Dependencies:** 无
**Files likely touched:** 只读（grep/Read），无源码改动
**Estimated scope:** S

### Task LA.3: 收官文档（S，Agent 起草）

**Description:**
- 写 `tasks/launch-readiness.md`：① 交付说明（M0–M8 已完成项逐条）；② 受限邀请上线就绪清单（Deploy/Build/隐私/索引/邀请 gate 全绿）；③ 已知限制（M8.1 资质延后、M8.3 内容安全降级 `false`、图像审核异步回调缺口、阈值未回灌）；④ 用户手动步骤（资质申请→M8.1 达标→flip M8.3→公开上架）；⑤ 阈值回灌条件（自然用户 ≥10 对，见 `threshold-calibration.md`）。
- 与 HANDOFF/verification-log 互为引用。

**Acceptance criteria:** 文档覆盖上述 5 节；用户/法务确认发布口径。
**Dependencies:** LA.1, LA.2
**Files likely touched:** `tasks/launch-readiness.md`（新建）
**Estimated scope:** S

### Task LA.4: 交接更新（S）

**Description:**
- HANDOFF：新增「收官/灰度上线（受限邀请原型）」状态段（进度位置/极简版/接手指南「从哪一步继续」补 LA 指引）。
- `tasks/todo.md`：新增 LA.1–LA.4 任务卡 + Checkpoint LA（终态核验/主链路/收官文档/人工终审）。

**Acceptance criteria:** HANDOFF 与 todo 状态同步；新 Agent 接手能从 LA 段续作。
**Dependencies:** LA.1–LA.3
**Files likely touched:** `HANDOFF.md`, `tasks/todo.md`
**Estimated scope:** S

### Checkpoint LA（收官/灰度上线 · 受限邀请原型）

- [ ] 7 云函数 Active + 前端 build DONE + safety 线上 `USE_WX_SECURITY=false` 实证（LA.1）
- [ ] 主链路接线完整 + 受限邀请 gate 确认（LA.2）
- [ ] 收官文档 `launch-readiness.md` 发布（LA.3）
- [ ] 交接更新 HANDOFF/todo（LA.4）
- [ ] 人工终审 → 用户受限邀请实测 → 资质就绪后补 M8.1/M8.3 公开上架

## 3. 本轮明确不做

- 不 flip M8.3（强依赖资质，降级维持 `false`）
- 不公开上架（个人账号受限邀请原型）
- 不加新功能 / 不重加 `onShareAppMessage` / 不擅自删 `invite.js`
- 不自动回灌阈值（待自然用户 ≥10 对）
- 图像审核异步回调（无调用点，延后至图像上传功能启用）

## 4. 关键设计

- **降级即合规路径**：M8.1 降级后，v1 以「受限邀请原型」运行，符合 HANDOFF §38 上线路径决策；公众上架门槛（企业主体+社交类目+内容安全）延后至资质就绪。
- **零云函数改动**：M8 未触动云函数，故 LA.1 核验 = 确认 M7.1 部署态仍有效 + safety 降级常量未变。
- **受限邀请 = T2 既有 gate**：复用 confirmInvite.js 邀请码机制，无需新代码即实现「受限」准入。

## 5. 验证方法

- LA.1：`getFunctionDetail` 7 函数 Status；build EXIT=0；下载 safety 代码 `grep USE_WX_SECURITY` 确认 `false`。
- LA.2：`grep` 主链路调用点 + confirmInvite 接线。
- LA.3/LA.4：文档 + HANDOFF/todo 更新复核。
