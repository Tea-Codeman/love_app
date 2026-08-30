# M7 规划：技术债清算

> 本文档是 **M7 阶段执行规划**，基于 `tasks/plan-m6.md`（「留 M7」清单）、`HANDOFF.md`（2026-08-30 M6 收官现状）、`cloudfunctions/growth/growth-core.js` 与 `scripts/sync-core.mjs` 实测。
> 状态：**草稿，范围已拍板 = A 技术债清算（2026-08-30 用户选定）**。**不写实现代码，直至签字放行。**
> 冷启动准备（账号主体/社交类目资质、隐私正式文案、内容安全切换、复合索引）整线延后——属上线就绪项，不在 A 档（留 M8 或后续）。

## 1. 本轮目标

清算三笔技术债，全部 Agent 可执行、无用户侧外部依赖：

- **M7.1 时区/streak 修复**：`growth-core.js` 的 `dayOf()` / `isoWeekOf()` 当前用本地时间（云函数默认 UTC，实为 UTC 日期），与「按天去重」语义不符——北京 08:00 错位切分，streak 会被错算。统一改成 Asia/Shanghai（UTC+8）。
- **M7.2 `invite.js` 核查处置**：精确查 import 图，确认孤儿则删除（初查仅自身注释命中，8 个引用文件均为 `confirmInvite`/`setPendingInviter` 等其它模块）。
- **M7.3 老对回填决策**：n=3 测试对、0 自然用户，时区修复只影响未来写入；产出回填决策（默认：不回填，新写入走 CST），如需回填附一次性脚本草稿。

## 2. 任务卡

### Task M7.1: 时区/streak 修复（核心，S→M）

**Description:**
- 改 `cloudfunctions/growth/growth-core.js`（**唯一源头**，sync 会分发）：新增内部 `shanghaiTs(ts)`（`new Date((Number(ts)||Date.now()) + 8*3600*1000)`）；`dayOf()` 与 `isoWeekOf()` 改用 `shanghaiTs` + `getUTC*` 取字段。
- `cloudfunctions/metrics/metrics-core.js` 的 `dayOfCST`（当前名 CST 实为 UTC，未加 +8）同步补 `+8`，使其与 growth 同口径。metrics 函数本体不在 sync 清单，需同改其 `cloudfunctions/metrics/metrics-core.js` 副本。
- 跑 `npm run sync:core`（分发 growth-core → game/chat/match 三副本；metrics-core → growth/game/chat/match/safety/auth 六副本）。
- 部署：growth, game, chat, match, safety, auth, metrics（确保 streak 与 dashboard 同口径）。

**Acceptance criteria:**
- 构造北京 23:30 与次日 01:00 两个 ts → `dayOf` 不同；北京 07:00 与 09:00 → `dayOf` 相同（同一北京日）。
- `isoWeekOf` 周一为周界、北京时区正确。
- sync 后 4 份 growth-core 与 7 份 metrics-core 的 dayOf 口径一致（grep 校验）。
- `node --check` 全过；部署后 Status=Active。

**Dependencies:** 无
**Files likely touched:** `cloudfunctions/growth/growth-core.js`（源）、`cloudfunctions/metrics/metrics-core.js`、`scripts/sync-core.mjs`（不改，仅调用）、`cloudfunctions/{game,chat,match,safety,auth,metrics}/metrics-core.js` 与 `{game,chat,match}/growth-core.js`（sync 产物）
**Estimated scope:** M（跨 7 函数部署，但单点改动小）

### Task M7.2: invite.js 核查处置（S）

**Description:**
- 精确查 `src/utils/invite.js` 的 import/require 图（已初查：`from '.../invite'` / `require(...invite)` / `utils/invite` 仅命中其自身注释头；App.vue/storage/auth/game/community/match/relation/confirmInvite 均为其它 invite 相关模块，非引用本文件）。
- 确认无引用 → 删除 `src/utils/invite.js`；确认有引用 → 保留并在 todo 记「invite.js 仍被 X 引用，留用」。
- 删除后 `npm run build:mp-weixin` 验证无打包报错（无悬空 import）。

**Acceptance criteria:** invite.js 去留有理有据；若有删除，构建通过且无运行时 `module not found`。
**Dependencies:** 无
**Files likely touched:** `src/utils/invite.js`（可能删）、`src/**`（仅核查，不改）
**Estimated scope:** S

### Task M7.3: 老对回填决策（S，文档为主）

**Description:**
- 评估：pairs 集合 n=3 全测试对、0 自然用户；时区修复只影响「未来写入的 dayOf/lastStreakDay」，历史存量无区分度。
- 默认决策：**不回填**（成本>收益，留待自然用户积累后重评）。
- 若用户要回填：附一次性脚本草稿（读 pairs → 重算 dayOf/isoWeek 字段），但本任务不自动执行。

**Acceptance criteria:** `tasks/plan-m7.md` 或 verification-log 记录决策与理由；如需脚本则附草稿。
**Dependencies:** M7.1
**Files likely touched:** 文档（verification-log / todo）
**Estimated scope:** S

### Checkpoint M7（技术债清算收尾）

- [ ] streak 按北京日正确去重（时区修复实证）
- [ ] invite.js 去留已决（删 or 留有据）
- [ ] 老对回填决策已出（默认不回填，记录理由）
- [ ] 7 个云函数部署 Active + 前端构建通过
- [ ] 人工终审 → 下一阶段（M8：上线就绪 / 或收官）

## 3. 本轮明确不做（留 M8 / 后续）

- 账号主体升级 / 社交类目资质申请（用户侧微信后台操作，Agent 只出指引）
- 隐私正式文案（当前为原型占位，正式上架前需法务/产品定稿）
- 内容安全切换准备（imgSec 等接入，依赖资质）
- reports/events 复合索引（量大时性能优化，当前数据量小）
- 阈值回灌重算（维持 12/40/90/150，待自然用户 ≥10 对再回灌，见 threshold-calibration.md）

## 4. 关键设计

- **时区修复单一源头**：`growth-core.js` 以 `cloudfunctions/growth/growth-core.js` 为 canonical，`sync:core` 兜底分发，不手工改 4 份。
- **+8 偏移用 `new Date(ts+8h)` + `getUTC*`**：避免在云函数环境依赖本地时区设置（环境默认 UTC，`getDate()` 即 UTC 日期，不可信）。
- **metrics 与 growth 同口径**：dashboard 的「天」窗口（SC2 D7）与 streak「天」必须一致，否则指标错位。
- **不动 streak 数值语义**：只改「天」的切分边界，+3/天、周上限 +15 的增量规则不变。

## 5. 验证方法

- M7.1：node 小脚本构造 4 个边界 ts（北京 07:00 / 09:00 / 23:30 / 次日 01:00）→ 断言 dayOf 分组正确；grep 4 份 growth-core + 7 份 metrics-core 确认 dayOf 口径一致。
- M7.2：删前 grep 全仓 `invite.js` import；删后 build 验证。
- M7.3：决策入文档，不跑数据脚本（除非用户要）。
