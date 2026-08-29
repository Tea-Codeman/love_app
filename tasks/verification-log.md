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

## V3 拉黑 / 解除 — 拉黑 ✅ / 解除 ⚠️ 未跑 / 发现安全漏洞
- 拉黑：`blocks` 现有 1 条（`我不爱罗` sJ8Fv8 拉黑 `woailuo` 6LrPFY，21:10）。
  `recommend` 服务端过滤已核验（`match/index.js:107` getBlockedIds + `:128` 排除），blocker 侧推荐不出现被拉黑方 → 拉黑 half PASS。
- 解除：**未执行**，`blocks` 仍为 1（解除需在真机点，依赖用户 OPENID，云端无法代操作）。待用户补。
- ✅ **安全漏洞已修并部署**：`match.getBlockedIds` 改为双向查询（`blockerId` 我拉黑的 + `blockedId` 拉黑我的，取并集），`recommend` 据此双向排除。
  已重部署 `match`，本次 `codeSha256` 变更为 `6fd7685d…`（上次失效时哈希不变，本次变了，确认落地）。提交 `4455ac4`。
  ⚠️ 功能复测需在真机：A 拉黑 B 后，**双方**推荐列表都应不再出现对方（旧版只有拉黑方单向隐藏）。云端直调 recommend 因无 OPENID 无法功能验证。

## V4 拒绝流程（可选）— 待跑
- 判定：B 拒绝后 A 看到「对局已取消」，`games`/`matches` 出现 `cancelled`。

---
### 待清理残留（破坏性，需用户确认）
- 08-28：`games`×3 cancelled + `matches`×3 cancelled
- 2026-08-29 修 bug 前试探：`games`×2 cancelled(20:12,20:19) + `matches`×2 cancelled
