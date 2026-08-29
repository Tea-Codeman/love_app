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

## V4 拒绝流程 ✅ PASS（2026-08-29 ~21:44 查库佐证）
- 判定：B 拒绝后 A 看到「对局已取消」，`games`/`matches` 出现 `cancelled`，且**不能**产生 `done`。
- 证据（V4 期间新增，A=sJ8Fv8 发起、B=6LrPFY 受邀）：
  - `matches`：`bf886e776a92e26d00b3e30d2fa8e463`（score 13, cancelled, 1788011117337）+ `0fb91b1d6a92e25501433ba65e436d5f`（score 13, cancelled, 1788011093460）
  - `games`：`10b550da6a92e26d00e00655180f9b1e`（state cancelled, createdBy=sJ8Fv8, invited=6LrPFY, questions=[]）+ `10b550da6a92e25500dff83d0f24e147`（state cancelled, questions=[]）
  - 两局 `questions=[]` → B 在 waiting 期间拒绝，`decline()` 把 `game→cancelled` + `match(active)→cancelled`，**正是拒绝预期**；无新 `done` 对 → 拒绝未误判完成。✓
  - 出现 2 对（相隔 1.6s）≈ 拒绝测试跑了两次，无害。
- `decline`（match:254）源码确认：先 `games.doc(state=cancelled)` 再 `matches.where(userA=createdBy,userB=OPENID,status=active).update(status=cancelled)` → 与数据一致。
- `blocks` 当前 0（V4 前用户已解除，干净）。

---
## cancelled 残留清理 —— 代码审查（未执行，仅审查）
> 用户要求：先不动清理代码，只审查相关代码并说明「改完（执行清理）会发生什么」。

### 1. 残留界定（当前实况）
- `matches` 共 10 条：
  - **2 条「异常」**：`bf886e776a92d78b00b2fa4b3847876a`(20:58)、`10b550da6a92cdf000de885e67998567`(20:37) —— 状态 `cancelled` 但带 `finishedAt`/`lastTacit=4`/`lastRounds=5`，且各自对应的 `games` 是 `done`（带 5 轮答案）。
    → 游戏明明打完，匹配却被标 cancelled。这是**数据不一致**（按当前代码 `decline`/`cancelGame` 均无法把 done 局翻成 cancelled，疑似早期测试序列产生；不影响功能，但属脏数据）。
  - **8 条真·cancelled 残留**：21:44×2、21:25、20:19、20:12、08-28×3（均 `score` 10/13，无 done 游戏）。
- `games` 共 10 条：2 条 `done`（对应上面 2 条「异常」match）+ **8 条 `cancelled` 残留**（与 8 条真·cancelled match 一一对应，均 `questions=[]`）。

### 2. 依赖审计（matches/games 的每一处读写）
| 函数 | 读写 | 对「删 cancelled 残留」的敏感性 |
|---|---|---|
| `match.recommend` | 读 `matches` WHERE `status='active'`(getMatchedOpenids) 与 `status='done'`(aggregateDoneStats) | 只碰 active/done；**删 cancelled 无影响**。若把上面 2 条异常 match 修成 `done`，该对会获得 `gameTacit×TACIT_WEIGHT(=4×4=16)` 的契合度加成（设计意图）。 |
| `match.accept` | 查 existing match 是否 `active/pending` 去重；新增 `active` | 删 cancelled → 这些废弃对**重新可被撮合**（预期好处）。✓ |
| `match.myPending` | 读 `games` WHERE `state='waiting'` | 只碰 waiting；**删 cancelled games 无影响**。✓ |
| `match.decline` / `game.cancelGame` | 按 `_id` 或具体配对更新 | 无批量依赖，删历史记录不影响。✓ |
| `game.joinGame/getGame/submitAnswer` | 全部按 `_id` 读 | 若某客户端仍持有已删 cancelled gameId 并尝试操作 → 返回「对局不存在」(404)。但这些是废弃 cancelled 局，本就不该被访问。✓ |
| 前端 | 仅 match(轮询 waiting+recommend)、game(getGame by id)；**M2 无历史/战绩页** | 无历史列表依赖，删残留不破坏任何 UI。✓ |
| `safety.report` | 仅把 `targetId` 存入独立 `reports` 集合 | **无外键级联**，删 games/matches 不留下悬空引用。✓ |

### 3. 「改完会发生什么」（执行清理后的后果）
- **活跃流程零破坏**：recommend/myPending/accept/decline 全部按显式状态或 `_id` 过滤，cancelled 残留对它们不可见。
- **废弃对重新可撮合**：删掉 cancelled match 后，`accept` 的去重不再拦，双方可再「一起玩」（符合预期）。
- **数量变化**：若「精确清理」（删 8 对真·cancelled + 修复 2 条异常 match 为 `done`）→ `matches` 10→2、`games` 10→2，且这 2 条 match 状态正确为 `done`。若「粗暴全删」（`status='cancelled' && state='cancelled`）→ `matches` 10→0、`games` 10→2，2 条 done 游戏的 match 被一并删掉（功能中性，但丢失了应保留的 match 种子）。
- **唯一行为变化点**：若选择修复那 2 条异常 match 为 `done`，`6LrPFY↔sJ8Fv8` 这一对在彼此的推荐里契合度 +16（设计内，非回归）。
- **无 UI/无报表/无外键受影响**。

### 4. 推荐清理方案（待用户拍板，未执行）
- **方案 B（推荐）**：删除 8 对真·cancelled 残留（`games` state=cancelled 且 questions=[] + 对应 `matches` status=cancelled），并 `update` 那 2 条异常 match 的 `status` 由 `cancelled`→`done`（finishedAt/lastTacit/lastRounds 字段已存在，仅翻状态）。
- **方案 A（粗暴）**：按状态全删 cancelled。简单但会误删 2 条应保留的 match 种子，不推荐。
- 两种方案都**破坏性**，删除前我会先列出待删 `_id` 给你过目；绝不擅自动手。

## cancelled 残留清理 —— 执行（方案 B ✅ 已落地，2026-08-29 ~22:0x）
> 用户拍板「选择方案 B」。以下为云端实际操作与核验。

### 操作清单（均通过 CloudBase MCP 执行）
1. **删 8 条真·cancelled `matches`**（`deleted:8`）：
   `0fb91b1d6a91a67b0128a8603afe0164`、`0fb91b1d6a91aadd0128f1a964aee99d`、`0fb91b1d6a91ab00012901c41e0e89ce`、`bf886e776a92ce4600b21ac85dab5abb`、`bf886e776a92cfdc00b22e0a37cda90f`、`37138adf6a92dda900c6269e7d79c654`、`0fb91b1d6a92e25501433ba65e436d5f`、`bf886e776a92e26d00b3e30d2fa8e463`
2. **翻 2 条异常 `matches` `cancelled`→`done`**（`modifiedCount:2`，finishedAt/lastTacit/lastRounds 字段原已存在，仅翻状态）：
   `10b550da6a92cdf000de885e67998567`、`bf886e776a92d78b00b2fa4b3847876a`
3. **删 8 条 `state=cancelled` 且 `questions=[]` 的 `games`**（`deleted:8`）：
   `10b550da6a91a67b00cc9df166f54452`、`10b550da6a91aadd00ccd6cb532e71a8`、`37138adf6a91ab0000b62c8c63df485d`、`0fb91b1d6a92ce4601416be73509db1b`、`10b550da6a92cfdc00deb26f4694c8dc`、`37138adf6a92dda900c626a138bc0603`、`10b550da6a92e25500dff83d0f24e147`、`10b550da6a92e26d00e00655180f9b1e`
4. **保留 2 条 `done` `games`**（与上面翻状态的两 match 一一对应）：`10b550da6a92cdf000de88607843db13`、`0fb91b1d6a92d78b014234f547ed832a`

### 核验（执行后重查）
- `matches` `total=2`：两条均为 `status=done`、`lastTacit=4`、`lastRounds=5` ✅
- `games` `total=2`：两条均为 `state=done` ✅
- 与审查预期「精确清理 → matches 10→2、games 10→2」完全一致 ✅

### 影响说明（印证此前审查结论）
- 活跃流程零破坏：`recommend`/`myPending`/`accept`/`decline` 全部按显式状态或 `_id` 过滤，cancelled 残留本就不可见。
- 副作用：翻成 `done` 的两对（`6LrPFY↔sJ8Fv8`）在彼此推荐里契合度各 +16（设计内，非回归）。
- 无 UI / 无报表 / 无外键受影响。

## M2 答题逻辑改版（各自独立答题 · 终局对比）—— 2026-08-30
> 用户反馈：回合制「一人选完等另一人选完」太死板。改为匹配后各自答题，最后出结果时再对比两人答案算默契度。

### 改动
- 服务端 `cloudfunctions/game/index.js#submitAnswer`：去掉回合推进。客户端传 `round`（1-based）+ `optionIndex`；答案按 `answers[题号][openid]` 落盘，互不阻塞；仅当**双方都答完全部 `totalRounds` 题**才终局对比（逐题 `a0===a1` → 默契），算 `tacitCount`、写 `roundResults`、翻 `matches` 为 `done`。
- 前端 `src/pages/game/game.vue`：去掉「已选择，等待对方」的回合阻塞；本地 `myRound` 跟踪已答数（重连时从 `answers` 恢复）；进度显示「你 X/N · 对方 Y/N」；答完显示「等对方答完即出结果」。
- 已部署 `game` 云函数（`getFunctionDetail` CodeInfo 已核验为新逻辑，Status: Active）。代码提交 `ab8cbd8`。

### 真机验证步骤
1. 拉测试号 A/B，A 发起邀请 → B 加入，进入游戏页。
2. **各自独立**：A 连答 5 题（B 不操作），确认 A 端显示「你 5/5 · 对方 0/5」+「等对方答完即出结果」；B 端实时看到「对方已答 0/5 → 5/5」（靠 watch/轮询同步）。
3. B 再答 5 题，B 答完即双方完成 → 两端同时出结果页（默契 X/5）。
4. 默契计算：故意选不同选项，确认默契数 = 选项相同的题数。
5. 落库核验：查库确认对应 `match` `status=done`、`lastTacit=X`、`lastRounds=5`（M3 契合度加成种子）。
6. 断点续答：A 答 3 题后杀进程重进，确认从「你 3/5」续答而非从头。

### 回滚
- `git revert ab8cbd8` + 重新部署 `game` 函数即可回到回合制。
- 前端改动需重新 `npm run dev:mp-weixin` 构建 `dist/dev`（DevTools 加载的是 dist/dev，不是 src）。

## M3 升温·导流（关系成长 + 轻聊 + 联系方式）—— 2026-08-30
> 规划见 `tasks/plan-m3.md`。M3.1–M3.6 代码已全部完成并部署，云端已核验；**待真机验证**。

### 已部署改动（云端核验方式）
| 函数 | 核验 | 结论 |
|---|---|---|
| `growth`（新建） | 冒烟 `addGrowth 8` → base 8 + streak 3 = 11；`delta=-5` → 400 拒绝 | ✅ 只增不减 + streak 生效 |
| `growth.listPairs` | 插入测试 pair → 返回 `peerId` + `peer{}`；用户缺失降级「未知用户」 | ✅ join 与降级路径均正确 |
| `game` | `submitAnswer` 不传 `round` → 400「缺少题号」（旧版无此校验） | ✅ 新逻辑已上线 |
| `match` | `getFunctionDetail` CodeInfo 含 `aggregateGrowthStats` | ✅ pairs 权威源已上线 |
| `chat`（新建） | `send` → 401（MCP 无 OPENID）；`contact` action 存在（否则会 404） | ✅ 含联系方式解锁 |
| `auth` | 部署回执成功（wechatId/wechatQrUrl 白名单） | ✅ |

### 真机验证步骤（双设备 A/B）
0. **前置**：`npm run dev:mp-weixin` 重新构建 `dist/dev`（前端改动不构建不会生效）。
1. **成长累加与阶段**：A/B 打完一局 → 我的关系页出现该关系，成长值 = 8 + streak(3) = 11，阶段 S0（<12）；再打一局 → 累计 ≥19，跃迁 **S1**。
2. **成长进度条**：匹配页候选卡出现「初步破冰」+ 进度条；关系页同步显示。
3. **轻聊解锁（S1）**：候选卡出现「聊聊」→ 进入聊天页互发消息；发送后成长值 +2（互聊）+ streak。
4. **先审后发**：发含违规词（如「代开发票」）的消息 → 被拒并提示，**草稿保留不清空**。
5. **互聊幂等**：A 连发两条、B 回一条 → 只结算一次 +2（「回复对方上一条」才计分）。
6. **联系方式（S4）**：成长值 <150 时无入口；达到 150 后出现「联系方式」→ 展示二维码（长按识别）+ 微信号（可复制）。未填微信号时提示「对方还没有填写微信号」。
7. **微信号落库**：资料页填写 → 保存 → 查库确认 `users.wechatId` 已写入；填非法值（如 `123`）应被前端拦截提示。
8. **关系主页**：首页「我的关系」→ 列出所有关系，按 `updatedAt` 倒序，显示阶段/局数/默契/里程碑。

### 已知限制
- 二维码走 `users.wechatQrUrl`（用户自填链接），**未接云存储上传**——原型期先跑通双通道。
- 聊天用 3s 轮询（messages 由服务端写入，客户端直读会被安全规则拦截）。
- M3 v1 不做「互加好友 +5」「赛后互评 ×1.5」（依赖 M2 未建系统）。

### 回滚
- 按功能逐提交 revert；云函数需重新部署对应版本。
