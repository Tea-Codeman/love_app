# 变更记录

> 本项目是微信小程序（无外部消费方），版本号用于**标记里程碑、作为回滚锚点**，与 git tag 一一对应。
> 版本映射：**MINOR 号 = 里程碑号**（`v0.3.0` = M3）。M0 初始化时随脚手架写入 `0.1.0`，M1/M2 未打标，故号段未被占用。

## [0.3.0] - 2026-08-30 · M3 升温·导流（代码完成，**待真机验证**）

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
- 聊天用 3s 轮询（`messages` 由服务端写入，客户端直读会被数据库安全规则拦截）。
- M3 v1 不做「互加好友 +5」「赛后互评 ×1.5」（依赖 M2 未建系统）。

---

## 回滚
- 回滚到本版本：`git checkout v0.3.0`（或 `git revert <commit>` 逐个撤）；云函数需重新部署对应版本代码。
- 前端回滚后必须重新 `npm run dev:mp-weixin` 构建 `dist/dev`——DevTools 加载的是 `dist/dev` 而非 `src`。
