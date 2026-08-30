# M6 规划：管理员处置闭环（收 M5 尾）

> 本文档是 **M6 阶段执行规划**，基于 `spec/SPEC.md`（§8 SC5：24h 处置率 ≥95%）、`tasks/plan-m5.md`（M5 留 handleReport 无 UI）、`HANDOFF.md`（2026-08-30 实测状态）。
> 状态：**范围已拍板（2026-08-30：用户选 A 收 M5 尾 + community 提交 true），待签字放行动码**。
> 本里程碑目标 = 把 M5 的「举报处置能力」从「仅 MCP 可调」补成「管理员真机可用闭环」。
> 冷启动准备（资质/类目/隐私复查/索引）整线延后——大头是用户侧外部依赖，留 **M7**。技术债（时区/streak、死代码、老对回填）也留 **M7**。

---

## 0. 目标与出口（Definition of Done）

M6 让 SC5 的处置路径**真机闭环**，闭合 M5 遗留的 403/幂等真机补验：

- [ ] 管理员能在小程序内看到 pending 举报列表并对单条处置（handled/dismissed），闭合 M5 遗留的 403/幂等真机补验
- [ ] 非管理员无法进入处置界面（前端守卫 + 服务端 403 双重）
- [ ] `FEATURES.community` 开关现状已正式提交（true）并同步 HANDOFF
- [ ] 人工终审 → 逐任务落地

---

## 1. 现状盘点（2026-08-30 只读核实，不重议）

**M5 已交付（验收 PASS）**：
- `safety.handleReport`：admins 集合校验 403 / 幂等 alreadyHandled / note 截 200 不入埋点（部署 Active）
- `report_handled` 入白名单（sync 7 副本）
- `metrics.dashboard` SC5 消费 reports 集合（24h 处置率 + pendingCount）
- `App.vue` 冷启动双计修复
- `admins` 集合已建（1 管理员 openid `oUsf1xRnPxcjWLiSG3XFR-6LrPFY`）

**缺口（M6 要补）**：
- ❌ **无管理员 UI**：handleReport 现只能 MCP 调，403/幂等路径未走真实登录态（M5 验收结论明确遗留进 M6）
- ❌ **`reports` 集合有 2 条 pending**（验收已处置 1 条为 handled，另 2 条真机举报仍 pending），可作真机验收样本
- ❌ **`config.js` `FEATURES.community=true` 未提交**（用户真机测社区所改，HANDOFF 仍写 `false`）

**本轮明确不做（留 M7）**：账号主体/类目资质、隐私正式文案、内容安全切换、复合索引、时区/streak 修复、删死代码、老对回填——均属上线就绪或技术债，不在 A 档。

---

## 2. 已拍板决策（2026-08-30）

### 决策 1：M6 范围 = **A（收 M5 尾）** ✅ 已选
- 做：管理员处置 UI 闭环（M6.1–M6.3）+ 提交 `config.js` 开关现状（community=true）。
- 不做：上线就绪（隐私文案/内容安全切换/上线清单/索引）留 **M7**；技术债（时区/streak、死代码、老对回填）也留 **M7**。

### 决策 2：管理员身份前端判定 = **a（safety.isAdmin 云函数动作）** ✅ 采用
- 新增 `safety.isAdmin`：查 `admins` 集合 by OPENID → `{isAdmin}`；非登录 401。
- `admins` 集合保持服务端私有，客户端不直读（安全最小化）。

### 决策 3：`config.js` community = **提交 true** ✅ 已选
- 正式提交 `true`（社区入口作为原型验证一部分保留，个人账号 DevTools 可跑）；HANDOFF 同步更新开关现状为 true。

---

## 3. 任务分解

| # | 任务 | 落点 | 要点 |
|---|---|---|---|
| M6.1 | `safety.isAdmin` 动作 | `cloudfunctions/safety/index.js` | 查 admins 集合 by OPENID → `{isAdmin}`；非登录 401；纯读不改；入口 `action:'isAdmin'` |
| M6.2 | 前端管理员判定 + 路由守卫 | `src/utils/admin.js` + `src/pages/settings/settings.vue` | `isCurrentUserAdmin()` 封装（调 isAdmin，会话内缓存）；settings 页「管理后台」入口仅 isAdmin 可见 |
| M6.3 | 管理员处置页 | `src/pages/admin/reports.vue` + `src/pages.json` | pending 列表（targetType/举报人/时间）+ 处置/驳回按钮 → 调 `handleReport`；已处置 tab 可查；重复处置禁用 + alreadyHandled 提示；进入即 isAdmin 守卫 |
| M6.4 | config.js 开关提交 + 文档同步 | `src/utils/config.js` + `HANDOFF.md` | 提交 community=true（用户已改）；HANDOFF「社区搁置」现状更新为 true |

**依赖顺序**：M6.1（isAdmin 服务端）→ M6.2（前端判定）→ M6.3（处置页依赖前两者）；M6.4 独立可并行。

---

## 4. 验收标准

1. **管理员真机闭环**：管理员账号进入「管理后台」→ 看到 pending 列表 → 处置 1 条 → `reports.status` 变更 + `handledAt` 落库 → `metrics.dashboard` SC5 出 `rate`（闭合 M5 遗留）
2. **非管理员守卫**：普通账号 settings 页无「管理后台」入口；直接深链 admin 页 → `isAdmin` 守卫拦截（toast + 返回）
3. **幂等补验**：同一条重复点处置 → 返回 `alreadyHandled` + 按钮禁用；MCP/真机双向印证 403
4. **编译/部署**：`build:mp-weixin` DONE；safety 部署后 `Status=Active` 且 CodeInfo 含 `isAdmin`

---

## 5. 明确不做（本轮）

- 自动处置（下架内容/封号/通知举报人）——沿用 M5 决策 3，只标记留痕
- 小程序内北极星看板页 / 管理员鉴权体系——沿用 M4 决策 2（dashboard 仍走云函数 JSON）
- 账号主体升级 / 社交类目资质申请本身——用户侧微信后台操作，Agent 只出指引（M7）
- 真实阈值回灌——等自然用户 ≥10 对 + 跨天数据（见 `threshold-calibration.md`）
- 时区/streak 修复、删 `invite.js`、老对回填——技术债，留 M7 统一决策
