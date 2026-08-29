# 真机验证 · 基线快照（BEFORE）

> 采集时间：2026-08-29 19:55（用户真机测试开始前）
> 目的：记录验证前云端状态，测试后对比 `games`/`matches`/`users`/`blocks` 增量，作为 V1–V4 判定的「前」基准。
> 环境：`love-app-server-d2fhg32320d65c12`（上海，纯 NoSQL）

## 后端健康度
- `ping` → `code:0` pong，runtime v16.13.1 ✅
- `safety.listBlocks` → `401 未登录` ✅（新拉黑 action 在线，需登录态）

## 集合基线

### users（5 条，全部无 `mbti` 字段）
| openid 尾段 | nickname | gender | 备注 |
|---|---|---|---|
| `…6LrPFY` | woailuo | 2(女) | 08-28 测试机 A 账号 |
| `…sJ8Fv8` | 我不爱罗 | 1(男) | 08-28 测试机 B 账号 |
| `…YRbnE` | （空） | 0 | 早期残留 |
| `…actAho` | 1 | 0 | 早期残留 |
| `…fyhk` | （空） | 0 | 早期残留 |

> 若用户复用同一两台微信扫码，会命中 `6LrPFY`/`sJ8Fv8` 这两条旧 user（openid 绑定微信号+appid，不变）；V2 会在这两条上写入 `mbti`。

### games（3 条，全部 cancelled）
- 3 局 createdAt 均落在 2026-08-28 23:00–23:36，全是 `round=0 / questions=[] / players=[单方1人] / tacitCount=0`。
- 属 08-28 换号重试残留，**非 bug**。

### matches（3 条，全部 cancelled）
- 同一对 `6LrPFY ↔ sJ8Fv8` 互建 3 次（含互为 userA/userB），score=10，均 08-28。

### blocks（0 条）
- 干净。V3 拉黑会在此新增 `{blockerId, blockedId, createdAt}`；解除会置 `removed=1` 或删除。

## 验证后对比方法（AFTER）
测试每完成一个场景，在云端重跑对应查询，按 `createdAt` 倒序取最新，与基线 diff：
- **V1**：最新 `games` 应出现 `state=done, round=6, questions.length=5, players.length=2`；最新 `matches` 应 `status=done, lastTacit` 与页面一致。
- **V2**：`users` 中测试用 openid 出现合法 16 型 `mbti` 字段（基线为全空）。
- **V3**：`blocks` 从 0 → 新增 1 条；解除后该条消失或被标记。
- **V4**（可选）：新增 `games.cancelled` + `matches.cancelled`（与基线 3 条 cancelled 区分，看 createdAt 是否晚于本快照）。

> 注意：08-28 的 3 局 cancelled + 3 matches 会一直存在于云端，判定时务必按 `createdAt` 倒序取「测试期间新增」的记录，勿与旧残留混淆。是否需要清理旧残留见 `verification-m2.md` §7。
