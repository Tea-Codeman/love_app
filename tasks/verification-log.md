# 真机验证结果记录（V1–V4）

> 测试前基线见 `verification-baseline.md`。本文按场景记录云端核验结论。
> 环境：`love-app-server-d2fhg32320d65c12`（纯 NoSQL）

## V1 撮合→破冰闭环 ✅ PASS（重跑后）
- 时间：2026-08-29 ~20:59（修复「两个一样用户」bug 后重跑）
- `matches` `bf886e776a92d78b`：`status=done`、`lastRounds=5`、`lastTacit=4`、`score=10`、`userA=6LrPFY`/`userB=sJ8Fv8`
- `games` `0fb91b1d6a92d78b`：`state=done`、`round=6`、`tacitCount=4`、`totalRounds=5`、`type=quiz`
- 一致性：`matches.lastTacit(4)` == `games.tacitCount(4)` ✅
- bug 修复（2774848）生效：B 侧不再重复看到邀请方。

## V2 MBTI 保存 ✅ PASS
- 时间：2026-08-29 ~21:00 后
- `users` 落库：
  - `woailuo`(`6LrPFY`, 女) → `mbti=ESTJ`
  - `我不爱罗`(`sJ8Fv8`, 男) → `mbti=INFP`
  - 其余 3 条无 mbti（基线未变）
- 判定依据：两人结果不同（非 `calcMbti([])` 默认 ESTJ），证明 quiz 真实作答、保存逻辑正确。
- 注：`mbtiFit` 不落库（profile 实时算），不影响判定。

## V3 拉黑 / 解除 ✅ 完整闭环
- 拉黑（21:10）：`blocks` +1（`我不爱罗` sJ8Fv8 拉黑 `woailuo` 6LrPFY）。`recommend` 服务端按双向黑名单过滤，blocker 侧推荐不出现被拉黑方 → 拉黑 PASS。
- 解除（用户补做）：`blocks` 回 0 → 解除 PASS，V3 完整闭环收尾。
- ✅ **安全漏洞已修并部署**（提交 `4455ac4`）：`match.getBlockedIds` 双向查询（`blockerId`+`blockedId` 并集），`recommend` 双向排除。已重部署 match（codeSha256 变更确认）。

## V3.5 实时防骚扰兜底（本次修复，提交 415aa51）
- **发现**：双向过滤只解决「推荐列表该不该出现」，但匹配大厅推荐是**一次性快照**，被拉黑方驻留页面时看不到更新，仍能点击对方「一起玩」成功建局——客户端刷新拦不住建局这一步。
- **修复三层**：
  1. **服务端权威兜底**：`match.accept` 新增黑名单双向拦截，任一方向存在拉黑关系即返回 `code:403 对方已不可见，无法发起邀请`。（`getFunctionDetail` 回传线上代码全文已确认落地 ✅）
  2. **客户端自愈**：`match.vue` 新增 12s 周期 `recommend` 刷新（`startRecommendPolling`），驻留页面期间「对方拉黑了我」也能自动生效，无需退页重进。
  3. **点击兜底**：`onPlay` 命中 403 时本地立即移除该候选卡片并提示，消除陈旧视图的误点。
- **当前 blocks 状态**（用户重跑 block 测试）：1 条 `6LrPFY`→`sJ8Fv8`（即 `woailuo` 拉黑 `我不爱罗`），`createdAt≈21:41`。
- **复测 ✅ PASS（2026-08-29 ~21:41 后查库佐证）**：
  - 本次为**反向测试**（拉黑方=6LrPFY，被拉黑方=sJ8Fv8 去点 6LrPFY 的「一起玩」），正是原漏洞方向。
  - 决定性证据：拉黑时间戳 ≈21:41，而 `matches`/`games` 最新记录均停留在 21:25 的 `37138adf…`（cancelled 对，拉黑前正常 accept+取消残留）。**拉黑之后无任何新 match/game 由 sJ8Fv8 建出** → `accept` 的 403 双向拦截拦住了建局。
  - 附带坐实：此现象只有新代码（accept 查双向黑名单）才会产生，旧代码必建出 active/cancelled match → **反向证明 match 云函数部署确实落地**（此前对 codeSha256 是否反映部署的疑虑消除）。
  - 客户端 12s 自愈 + onPlay 403 本地移除两层无需库佐证，依赖前端预览编译，已随源码提交 `415aa51`。

## V4 拒绝流程（可选）— 待跑
- 判定：B 拒绝后 A 看到「对局已取消」，`games`/`matches` 出现 `cancelled`。

---
### 待清理残留（破坏性，需用户确认）
- 当前 `matches`=8、`games`=8 总量中，仅 2 对 `done`（V1 重跑闭环，合法）与 1 对 `cancelled`（V2/V3 正常 accept 后取消，可留），**其余均为 cancelled 测试残留**：
  - 08-28：×3 对（matches+games 各 3）
  - 08-29 修 bug 前探查：×2 对（20:12、20:19）
  - 08-29 V3.5 复测前重置：×1 对（`37138adf…`，21:25 cancelled）
- 清理 = 删除 `status/cancelled` 且非业务价值的记录，需用户明确同意。
