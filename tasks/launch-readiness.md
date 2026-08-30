# 收官 / 灰度上线就绪说明（受限邀请原型）

> 本文档是 v1 进入「受限邀请原型验证」的交付与就绪说明，配套 `tasks/plan-launch.md`（LA.1–LA.4）。
> 决策依据：HANDOFF 第 30 条（2026-08-31 M8.1 降级）——资质申请中，v1 走「个人账号受限邀请原型」不公开上架；M8.3 同步降级维持 `USE_WX_SECURITY=false`。

## 0. 结论速览

v1 已具备「受限邀请原型验证」上线就绪条件：

| 项 | 状态 | 证据 |
|---|---|---|
| 云函数部署 | ✅ 7 函数 Active | env `love-app-server-d2fhg32320d65c12`；态 = M7.1 部署（ModTime 2026-08-30 23:01:15），M8 未改云函数源码 |
| 前端构建 | ✅ DONE | `npm run build:mp-weixin` EXIT=0，`src/utils` 完好 |
| 隐私正式文案 | ✅ 已上线 | M8.2 重写 `privacy.vue`（七节合规字段），门禁链路不变 |
| 复合索引 | ✅ ready | M8.4 建 reports `status_createdAt` + events `eventName_day`/`pairId_day` |
| 内容安全 | 🔻 降级 false | 云端 `safety` 第 23 行 `USE_WX_SECURITY=false`（下载代码 grep 实证），走本地关键词兜底 |
| 账号资质 | 🔻 延后 | 个人账号 · 不公开上架；受限邀请 = 预览二维码小圈子分发（配对走 match，不经分享；`?inviter=` 分享裂变冻结至 M8.1 达标） |

## 1. 交付说明（M0–M8 已完成项）

- **M0–M4**：核心主链路（社区 / 游戏破冰 / 关系升温 / 加微信导流）+ 推荐 + 双边邀请 + 埋点。
- **M5**：管理员处置 SC5（handleReport + 管理员白名单 + app_open 双计修复）；阈值回灌评估 #2 维持 12/40/90/150。
- **M6**：管理员处置 UI 闭环（isAdmin 服务端鉴权 + reports 处置页 + 幂等禁用）；真机验收 PASS。
- **M7**：技术债清算——时区/streak +8 修复（growth-core `shanghaiDate`，sync 分发 + 部署 7 函数，云端代码实证）、删孤儿 `invite.js`、老对不回填决策。
- **M8**：上线就绪——M8.2 隐私正式文案 ✅、M8.4 复合索引 ✅、M8.1 资质指引 ✅（降级延后）、M8.3 内容安全 🔻 降级维持 false。

## 2. 受限邀请上线就绪清单

- [x] **Deploy**：7 云函数 `Status=Active`（growth/game/chat/match/safety/auth/metrics）。
- [x] **Build**：`build:mp-weixin` DONE，DevTools 加载 `dist/build/mp-weixin` 可运行。
- [x] **Privacy**：隐私页正式文案 + 授权门禁（未同意 `reLaunch` 到 privacy 页）齐备。
- [x] **Index**：reports/events 复合索引 ready，支撑管理员处置与看板聚合。
- [x] **受限准入**：个人账号**不公开上架** + 预览二维码小圈子分发（配对走 `match.recommend`/`accept`，不经微信分享）；`?inviter=` 分享裂变因个人账号禁转发 + 前端 `invite.js` 已删而冻结，待 M8.1 资质就绪恢复（`App.vue:39-40` + `auth.js:11-19` 归因代码仍在，仅入口缺）。
- [x] **Content safety**：降级 `false` 本地兜底（已知限制，非阻塞原型）。

## 3. 已知限制（延后项）

- **M8.1 资质**：个人账号，社交类目 / 内容安全云调用权限未开通；公众上架延后。
- **M8.3 内容安全**：`USE_WX_SECURITY=false` 本地关键词兜底；图像 `mediaCheckAsync` 异步回调全仓无调用点（缺口，待图像上传功能启用再补）。
- **阈值未回灌**：维持 12/40/90/150，待自然用户 ≥10 对 + 跨天数据再校准。
- **图像审核**：原型期 `checkImage` 本地恒 `pass:true`（见 `safety/index.js:254`），非真审。

## 4. 用户手动步骤（解锁公开上架）

1. 微信公众平台升级主体为**企业 / 个体工商户**并完成认证。
2. 服务类目加**社交 → 陌生人社交 / 婚恋交友**，提交资质（ICP 备案 / 增值电信业务经营许可证或平台替代材料）。
3. 开通**内容安全**接口权限（`msgSecCheck`）。
4. 告知 Agent「**M8.1 达标**」→ Agent 执行 M8.3：flip `USE_WX_SECURITY=true` + 部署 `safety` + 违规/正常文本真审验收（无 `48001`）。
5. 提交小程序审核，公开上架。

> 若暂无法升级主体：维持降级模式（本地兜底 + 受限邀请），v1 可继续受限邀请原型验证，不阻塞。

## 5. 阈值回灌条件

自然用户 ≥10 对 + 有跨天互动数据后，按 `threshold-calibration.md` 备忘方法回灌阈值（重点看游戏:聊天权重配比；app_open 双计已修）。

## 6. 收官核验记录（LA.1 / LA.2）

- **LA.1 终态部署核验**：`build:mp-weixin` EXIT=0；下载云端 `safety` 代码包归一化 grep `USE_WX_SECURITY` → 第 23 行 `const USE_WX_SECURITY = false`（249/254 行走本地兜底分支），实证降级态为线上真实态；7 云函数 = M7.1 部署态（M8 未改云函数源码，仅前端隐私文案 + DB 索引）。
- **LA.2 主链路 + 受限邀请 gate**：主链路 社区→游戏破冰→关系升温→加微信导流 接线完整（M0–M7 真机验收 PASS）；受限准入 = 不公开上架 + 预览二维码小圈子分发（配对走 `match.recommend`/`accept`，不经分享）；`?inviter=` 分享裂变因个人账号禁转发 + 前端 `invite.js` 已删而冻结，待 M8.1 达标恢复（归因代码 `App.vue:39-40` + `auth.js:11-19` 仍在）。

---

**下一步**：用户受限邀请实测（手动，Agent 不出真机）→ 资质就绪后补 M8.1/M8.3 公开上架 → 阈值回灌。
