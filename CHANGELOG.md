# 变更记录

> 本项目是微信小程序（无外部消费方），版本号用于**标记里程碑、作为回滚锚点**，与 git tag 一一对应。
> 版本映射：**MINOR 号 = 里程碑号**（`v0.3.0` = M3）。M0 初始化时随脚手架写入 `0.1.0`，M1/M2 未打标，故号段未被占用。

## [0.3.1] - 2026-08-31 · M3 验收补丁（性能优化 P0–P3 + 聊天修复）

### Improved
- **性能优化（P0 索引 + P1/P2/P3）**：社区详情/信息流、匹配大厅 recommend、聊天 list 三大慢点从全表扫描变为索引命中。
  - **P0 索引**：comments / posts / messages / games / matches / pairs / users 共 7 集合复合索引已在 CloudBase 控制台建立，`readNoSqlDatabaseStructure.listIndexes` 复核全绿（matches 补 `uA`+`uB` 双索引闭合 userB 分支硬缺口）。
  - **P1 聊天**：增量轮询 + 轮询间隔 3000ms→1500ms（`chat.list` 加 `since` 游标，无 `since` 退回全量兼容首屏）。
  - **P2 recommend**：`match.recommend` 去 `_.neq(OPENID)` 全扫，改用 `users.createdAt` 游标分页走索引，内存补回排除自己。
  - **P3**：`game` 削 `joinGame`/`submitAnswer` 冗余回读；`community` 评论首屏 `limit(100)`→`limit(30)` + `listComments` 加载更多。
- **DevTools 计时埋点**：`callFunction` 加运行时开关（`wx.setStorageSync('__perf_on', true)` 开启，`[perf] name.action=ms`），默认关、不影响线上。

### Fixed
- **聊天「下拉重复拼接旧消息 / 无界增长」**：改为标准分页——上滑到顶翻历史（`prepend` 去重 + 锚定阅读位置）、下滑到底只看新（`append` 去重）、仅贴底时轮询新消息自动沉底；服务端 `chat.list` 加 `before` 历史游标 + `hasMore`。根因为轮询与 `onSend` 共享过期 `lastCreatedAt` 游标并发各拉一份，已用 msgId 去重 + `_fetching` 防并发守卫根治。

### 验证
- DevTools 计时复核通过（2026-08-31）：三大慢点均达目标阈值（详见 `tasks/perf-plan.md` §10）。
- 聊天分页已部署并验收（用户确认「已经验收通过」）。

---

## [0.3.0] - 2026-08-30 · M3 升温·导流（代码完成，已验证）

### Added
- **F5 关系成长**：`growth` 云函数 + `pairs` 集合作为权威累计源（每对用户一条）。
  - 成长值**只增不减**（`db.command.inc(正数)`，非正值拒绝，单次上限 100）；游戏完成 +8、有效互聊 +2、连续天数 streak +3/天（ISO 周上限 +15）。
  - 阶段 S0–S4 由成长值**读时派生**（阈值 12/40/90/150），`pairs.stage` 仅作缓存冗余。
  - `recommend` 改读 `pairs`（O(1)）；`pairs` 缺失时用 M2 的 done matches 聚合做**一次性回填**。
- **F6 轻聊**：`chat` 云函数（send / list），S1（成长值 ≥12）解锁。
  - **先审后发**：复用 `safety.checkText`，不过审不落库；审核服务故障时 fail-closed 拒发。
  - 有效互聊 +2：仅当本条是「回复对方上一条」时结算，天然幂等。
- **F6 联系方式**：S4（成长值 ≥150）解锁，二维码长按识别 + 复制微信号双通道。
  - `users.wechatId` / `users.wechatQrUrl` 落库（`auth.sanitizeProfile` 白名单 + 前端校验）。
  - 微信号**仅** `chat.contact` 一个出口返回，其余接口一律不带。
- **F7 关系主页**：`src/pages/relation/relation.vue`，展示阶段 / 局数 / 默契 / 里程碑 + 成长进度条。
- 新增 `growth-bar` 组件、`src/utils/growth.js` 派生工具；`match` 函数超时 3s → 10s。

### Changed
- `match.recommend` 返回体新增 `growthValue` / `stage` 字段。
- `growth.listPairs` 服务端批量 join `users` 补齐对方资料（20/批），查不到降级「未知用户」。

### 已知限制
- 二维码走 `users.wechatQrUrl`（用户自填链接），**未接云存储上传**。
- 聊天用 3s 轮询（`messages` 由服务端写入，客户端直读会被数据库安全规则拦截）。**已于 v0.3.1 改为 1.5s 增量轮询 + 上滑翻历史分页。**
- M3 v1 不做「互加好友 +5」「赛后互评 ×1.5」（依赖 M2 未建系统）。

---

## 回滚
- 回滚到本版本：`git checkout v0.3.0`（或 `git revert <commit>` 逐个撤）；云函数需重新部署对应版本代码。
- 前端回滚后必须重新 `npm run dev:mp-weixin` 构建 `dist/dev`——DevTools 加载的是 `dist/dev` 而非 `src`。
- 已验证补丁：`v0.3.1`（性能优化 P0–P3 + 聊天分页修复），`git checkout v0.3.1` 回滚到验收态。
