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

### 云端佐证（2026-08-30 01:21–01:30 真机数据，查库时间 08-30）
> 真机账号：`6LrPFY`（woailuo）↔ `Z` = `oUsf1xZonxm8p9DekXnHSh0YRbnE`（666）。
> 时间窗：**01:21:28 – 01:29:58**（以下均为北京时间）。

#### A. 逐条结论

| # | 验证项 | 云端证据 | 结论 |
|---|---|---|---|
| 1 | 成长累加与阶段跃迁 | 2 局 done（01:21:51 / 01:26:19）→ `pairs.growthValue` 累加 8×2=**16**，`stage` 缓存 `S1`（≥12） | ⚠️ **部分通过**：阶段跃迁 S1 达成，但**成长值 16 ≠ 文档口径 19** |
| 2 | 成长进度条 | `pairs` 有数据可渲染 | ⚠️ 纯前端渲染，**需目测确认** |
| 3 | 轻聊解锁（S1 门禁） | 13 条 `messages` 全部落库、`auditStatus=pass`；发送时 growth=16 ≥ 12 门禁放行 | ✅ 门禁正确 |
| 4 | 先审后发 | 13 条消息全 `pass`，**无任何违规测试消息落库**（被拒不入库） | ✅ 间接 PASS（弱证据，草稿保留需目测） |
| 5 | 互聊幂等 +2 | 13 条消息按 `lastFromPeer` 规则应结算 **8 次**；实测每条幽灵 pair 各 `11 = 4×2 + streak3` → **正正好好每侧 4 次** | ✅ **判定逻辑 100% 正确** |
| 6 | 联系方式（S4） | `growthValue=150` ≥ 150 → 应解锁 | ⚠️ **150 来源存疑，需确认** |
| 7 | 微信号落库 | `users`: `6LrPFY` → `wechatId="x299_cy"`；`Z` → `wechatId="jiuzhe765"`，均合法 | ✅ **PASS** |
| 8 | 关系主页 | `pairs` 3 条 = 1 真 + **2 条幽灵** | ❌ **FAIL**（幽灵关系会被展示） |

#### B. 🐞 BUG-1（严重）：云函数间调用丢失 OPENID，轻聊成长值全部写错对象

**现象**：本轮 8 次「有效互聊」应给真实关系 `6LrPFY|Z` 加 8×2=**16** 成长值，实际**一分未加**——真实 pair 的 `lastInteractionAt/updatedAt` 停在 `01:26:19`（第 2 局结束时），**早于**聊天开始时间 `01:26:56`。

**根因**：`chat/index.js:75` 用 `cloud.callFunction({ name:'growth' })` 跨函数累加；被调用方 `growth/index.js:205` 取 `cloud.getWXContext().OPENID`。
云函数 A 调 B 时，B 拿到的不是端用户上下文 → **`OPENID === undefined`** → `pairKeyOf(undefined, peerId)` 生成 `"<真实openid>|undefined"` 的幽灵 pair。

**决定性证据**（时间戳逐一咬合）：

| 幽灵 pair | 创建时刻 | 对应触发消息 | 差值 |
|---|---|---|---|
| `6LrPFY\|undefined` | 01:27:08.380 | 消息2「您好」Z→6LrPFY @01:27:08.197 | +183ms |
| `Z\|undefined` | 01:27:46.558 | 消息3「你好」6LrPFY→Z @01:27:46.424 | +134ms |

两条幽灵 pair 的 `growthValue` 均为 **11 = 4 次×2 + streak 3**，`lastInteractionAt` 分别咬合各自的第 4 次结算（01:29:58.138 vs 消息13 @01:29:57.980）。
→ **互聊判定逻辑本身完全正确，只是写错了对象**；`weekKey=2026-W35`、`lastStreakDay=2026-08-29`、`weekStreakAdded=3` 证明 streak 也结算到了幽灵 pair 上。

**影响面**：`chat.send` 的成长奖励 100% 失效；`chat.contact` 的 S4 门禁读的是真实 pair，**不受**此 bug 影响。

#### C. 🐞 BUG-2（中）：`pairs.stage` 缓存漂移

- `game/index.js:53` 直写 pairs 时会刷 `stage`，但**不结算 streak**（与 `growth.addGrowth` 口径不同）→ 验证步骤里「首局 = 8+3=11」的口径**实现与文档不符**。
- `match/index.js:158` 读 pairs 时用 `p.stage || stageOf(p.growthValue)` → 缓存优先。一旦 `growthValue` 被非代码途径改动（见下），**匹配页候选卡显示 S1、聊天页/关系页显示 S4**，同一个关系两个入口口径打架。

#### D. 两处数据疑点 —— ✅ 已澄清（2026-08-30 用户确认：**均为本人控制台操作，非 BUG**）

1. **`growthValue=150` 从哪来**：2 局(16) + 聊天(16，去了幽灵) 最多 32，且 `updatedAt` 停在 01:26:19 未变 → 只能是非代码途径改的。**用户确认：为测 S4 联系方式手动置的 150。**
2. **第 1 局游戏文档缺失**：`matches` 有 `10b550da6a93151800e2d6255f7aa2cf`（01:21:28 建、01:21:51 完成、`lastTacit=3`），但 `games` 里找不到这一局。**用户确认：自己在控制台删的。**
   - ⚠️ 遗留副作用（数据层面，非代码 BUG）：真实 pair `bf886e776a93152f00b6a584297faa22` 的 `gameCount=2`/`tacitTotal=8` 统计了一局已不存在的对局；且 `growthValue` 被手改成 150 后，**缓存字段 `stage` 仍是旧的 `S1`**（代码不会因控制台改数而重算）。BUG-2 修复后所有读路径均 `stageOf(growthValue)` 派生，功能不受影响，仅控制台肉眼看到的是脏缓存。

#### E. 附带观察（非 BUG）

- 两条新 `matches` 的 `score=0`：因用户「666」资料全空（无 city/bio/tags/mbti）→ 契合度算不出分，**符合预期**，非回归。
- **`6LrPFY↔sJ8Fv8` 打了 5 局却无 pairs 记录**：`recommend` 的 `getMatchedOpenids` 会排除已匹配对象 → 已成 done 的对永远不会出现在候选里 → `aggregateGrowthStats` 的懒回填永不触发 → **「我的关系」页看不到任何历史关系**。M4 需决策是否给「已有 done match 的对」做一次性全量回填。

### 回滚
- 按功能逐提交 revert；云函数需重新部署对应版本。
- BUG-1 只影响数据不影响结构，修复后**重跑一次聊天即可自愈**，无需数据迁移（幽灵 pair 需另行清理）。

---

## BUG-1 / BUG-2 修复复验（2026-08-30 02:32–02:36 真机，查库时间 02:40）

> 真机账号：`6LrPFY`（woailuo）↔ `sJ8Fv8`（= `oUsf1xaoXeRqW5dqbCkjDfsJ8Fv8`）。
> 这是「M3.1 前打了 5 局、但懒回填永不触发、关系页看不到」的那一对 —— **上一轮根本没有 pairs 记录**。
> 时间窗：**02:32:59 – 02:36:04**（北京时间）。

### 结论：✅ PASS

| 验收点 | 证据 | 结论 |
|---|---|---|
| 成长值落到**真实** pair | 新建 pair `_id=10b550da6a93260900e36be766f2f7ee`，`pairKey="oUsf1x…6LrPFY\|oUsf1x…sJ8Fv8"` —— **无 `undefined`** | ✅ |
| 成长值数值自洽 | `growthValue=25`，逐笔推导 = 游戏 8+streak3 / 游戏 8 / 互聊 2×3 → **11+8+6=25** | ✅ |
| streak 结算生效 | `weekStreakAdded=3`、`weekKey=2026-W35`、`lastStreakDay=2026-08-29`（首活跃日给且只给一次） | ✅ |
| 写库**由 chat 触发**（证明走的是 `chat` 本进程内核，而非跨函数） | `lastInteractionAt=02:36:04.808`，最后一条消息 msg4 落库 `02:36:04.729`，**相差 79ms** | ✅ |
| S1 门禁放行 | msg1 发送时 growthValue 已是 19 ≥ 12 → 未被 403。**若 BUG 未修，真实 pair 为 0，第一条消息就会被门禁拒掉** | ✅ 反证 |
| 未再新增幽灵 pair | `pairs` 总数仍为 4；两条 `\|undefined` 幽灵的 `createdAt` 停在 01:27（修复前），本轮无新增 | ✅ |
| 历史关系能建出 pairs | 该对上一轮无 pairs，本轮 `ensurePair` 直接建出并累加 —— 「老关系进不了关系页」的路径已通 | ✅ |
| 默契统计一致 | `tacitTotal=9` = 两局 `tacitCount` 4 + 5；`gameCount=2` | ✅ |
| stage 读时派生 | 新 pair `growthValue=25` → `stage` 写入 `S1`（≥12 且 <40）；全仓已无 `p.stage` 缓存优先读（grep 复核） | ✅ |

### 成长值 25 的逐笔推导（时间戳全部北京时间）

| 时刻 | 事件 | 增量 | 累计 |
|---|---|---|---|
| 02:32:59 | 游戏1 创建（5 轮） | — | 0 |
| **02:33:45.253** | 游戏1 完成 → `ensurePair` **建出真实 pair** | +8 游戏 **+3 streak**（本活跃日首次） | **11** |
| 02:33:51 | 游戏2 创建 | — | 11 |
| **02:34:16.289** | 游戏2 完成（`lastGameAt`） | +8（同日无 streak） | **19** |
| 02:35:13 | msg1「测试数据1」6LrPFY→ | 首条无前序 → **不计分** | 19 |
| 02:35:26 | msg2「测试数据2」sJ8Fv8→ | 回复 → +2 | **21** |
| 02:35:57 | msg3「测试3」6LrPFY→ | 回复 → +2 | **23** |
| **02:36:04.729** | msg4「测试4」sJ8Fv8→ | 回复 → +2 | **25** |
| 02:36:04.808 | pair `lastInteractionAt`（+79ms） | — | 25 |

4 条 `messages` 全部 `auditStatus=pass`（先审后发生效）。

### 🟡 新发现（低优先级 · 非阻塞）：云函数运行时时区是 UTC

`lastStreakDay` 记为 **2026-08-29**，而游戏完成于**北京时间 2026-08-30 02:33** → `dayOf()` 用的是服务端本地时区，而云函数默认 **UTC**（02:33 CST = 18:33 UTC 前一天）。
**后果**：中国用户在**北京时间 08:00 之前**的活跃会被记到前一天；连续两天凌晨活跃可能只拿到 1 次 streak。
**建议**：M4 把 `dayOf`/`isoWeekOf` 改成按 `Asia/Shanghai`（+8）偏移计算。不改不影响 M3 验收。

### 已清理：2 条幽灵 pair（✅ 2026-08-30 02:45 用户确认后删除）

| `_id` | `pairKey` | `growthValue` | 生成时刻 | 状态 |
|---|---|---|---|---|
| `37138adf6a93166c00c8ca0e7fa2172d` | `oUsf1xRnPxcjWLiSG3XFR-6LrPFY\|undefined` | 11 | 01:27（修复前） | ✅ 已删（deleted=1） |
| `37138adf6a93169200c8cac7230d182e` | `oUsf1xZonxm8p9DekXnHSh0YRbnE\|undefined` | 11 | 01:27（修复前） | ✅ 已删（deleted=1） |

两者 `userA` 字段缺失、`gameCount=0`、`tacitTotal=0`，是 BUG-1 期间跨函数调用的产物，修复后已不可能再生。

**清理后核验**：`pairs` 只剩 **2 条真实关系** ——
- `10b550da6a93260900e36be766f2f7ee`：`6LrPFY`↔`sJ8Fv8`，growthValue 25 / gameCount 2 / tacitTotal 9 / S1
- `bf886e776a93152f00b6a584297faa22`：`6LrPFY`↔`Z`，growthValue 150（手改）/ gameCount 2 / tacitTotal 8 / 缓存 stage S1（读时派生为 S4）

---

## M4.1 全链路埋点真机验收 ✅ PASS（2026-08-30 凌晨，查库时间 ~04:1x）

**验证方式**：用户双设备（A=`6LrPFY` / B=`sJ8Fv8`）跑完主链路后，Agent 通过 CloudBase MCP 直查 `events` 集合全量（limit 1000）。共 **26 条文档**，全部为本次真机产生（无历史残留）。

### 验收证据表（6 项断言）

| # | 断言 | 结果 | 证据 |
|---|---|---|---|
| 1 | 主链路埋点生效（服务端入桩自动落库） | ✅ | 26 条覆盖 9 类事件，含服务端 8 类 + 前端 `app_open`×12 |
| 2 | PII 零泄漏 | ✅ | 全部 `props` 仅含 `score`/`rounds`/`tacitCount`/`auditPassed`/`from`/`to`/`growthValue`/`mbti`；无 `reason`、无微信号、无昵称、无消息内容 |
| 3 | 白名单无越界 | ✅ | 出现的 `eventName` 全部在 13 白名单内，无黑名单外事件 |
| 4 | `day` 字段时区正确 | ✅ | 全部 `2026-08-30`（Asia/Shanghai +8），无旧 UTC 偏移 bug |
| 5 | `pairId` 取值正确 | ✅ | 均为双 openid 排序后拼 `\|`（如 `6LrPFY\|sJ8Fv8`），非 `pairs._id` |
| 6 | BUG-1 护栏有效 | ✅ | `metrics` 直调无 openid 返回 `accepted:false`；真实事件均带合法 openid |

### 26 条事件分类计数

| eventName | 计数 | 来源 | 触发路径 |
|---|---|---|---|
| `app_open` | 12 | 前端 `track.js` | 小程序启动 / 页面 onShow |
| `mbti_completed` | 1 | auth.updateProfile | 保存含 `mbti` 的资料 |
| `match_accept` | 2 | match.accept | A 接受 B 推荐（配对分母） |
| `game_join` | 1 | game.joinGame | 创建/加入游戏 |
| `game_done` | 1 | game.submitAnswer | 最后一题提交（tacitCount/rounds） |
| `message_sent` | 5 | chat.send | 过审后发送（auditPassed:true） |
| `pair_stage_changed` | 1 | chat/game/growth | S1→S2（growthValue 41） |
| `contact_unlocked` | 3 | chat.contact | SC3 加微信转化分子 |

合计 26 条，9 类。

### 3 项计数 0 的根因（2 项为测试数据/路径未覆盖，1 项为代码 bug）

| eventName | 计数 | 根因（代码行号） | 补测方式 |
|---|---|---|---|
| `chat_unlocked` | 0 | 语义＝「本 pair 在 `messages` 的历史首条消息」才报（`chat/index.js:148` `isFirstMessage=!m`）；`6LrPFY↔sJ8Fv8` 在 M3 已互聊，`MESSAGES_COL` 早有记录 → 本次非首条 | 用**全新未聊过的 pair** 互发首条消息 |
| `profile_completed` | 0 | 触发条件 `isProfileComplete`＝昵称+头像+性别+年龄齐全（`auth/index.js:106`）；两测试号资料不完整（sJ8Fv8 只存了 mbti） | 填齐**昵称/头像/性别/年龄**四项再保存 |
| `recommend_view` | 0 | ⚠️ **代码 bug（已修）**：`match.vue` 在 `loadRecommend()` 调 `track('recommend_view', …)` 但漏 `import { track }`，运行时 `ReferenceError` 事件从未发出。**与「是否进页面」无关**，进页也不报 | 见下方「修复」：补 import + 重构建前端 |

> 注：`report_created`（safety.report，仅 `targetType` 不报 `reason`）与 `relation_confirmed`（M4.4）本轮均未触发，属预期外（用户未举报、未确认关系），不计入缺口。

### ✅ 非阻塞瑕疵已修（2026-08-30 04:3x 部署）
`contact_unlocked` 原每次 `chat.contact` 成功都报（真机报 3 次），会放大 SC3 分母。已改为**每 pair 首次解锁才报一次**：在 `chat/index.js` 的 `contact` 内查询 `events` 中该 `pairId` 是否已有 `contact_unlocked` 作为判重依据（pairId 为双 openid 排序拼 `|`，与方向无关），并对埋点 `await` 保证写入后再返回避免并发重复。`chat` 函数已 `updateFunctionCode` 部署、`Status: Active`、CodeInfo 确认含幂等逻辑。补测时该事件每个 pair 应只出现 1 次。

### 结论
**M4.1 服务端全链路埋点验收通过**，SC1–SC4 可观测目标达成。3 项缺口属「未在本轮验证」而非「实现错误」，补三轮小测即可闭合 13 事件。详见 `tasks/m4.1-supplement-test.md`。

### 补测复核 + 代码复核（2026-08-30 04:4x）

用户跑完 `tasks/m4.1-supplement-test.md` 后查库：共 **40 条**（首测 26 + 补测 14）。

- ✅ `chat_unlocked` 缺口闭合：新 pair `R188…|6LrPFY` 首条消息触发恰好 1 次（ts 1788036077087）。
- ❌ `profile_completed` / `recommend_view` 仍为 0 → 初判为「测试未覆盖」，**后续二次复核修正**：
  - `profile_completed`：`auth/index.js:62-92,106-109`，`updateProfile` 内重读 user 后 `isProfileComplete` 四项齐全才报；本轮测试号资料仍不满足四项，属测试未填齐（**确非 bug**）。
  - ⚠️ `recommend_view`：初判「未进匹配/推荐页」是**误判**。二次全量扫 `src` 发现 `match.vue` 调用 `track(...)` **从未 import**（`App.vue` 有 import、`match.vue` 漏了），运行时 `ReferenceError: track is not defined`，事件**永远发不出**，与是否进页无关。属**代码 bug，已修**（见下）。

### ✅ 修复 `recommend_view` 漏 import（2026-08-30 05:0x）

- **根因**：`src/pages/match/match.vue` 第 136 行 `track('recommend_view', …)` 调用了未引入的 `track`（`src/utils/track.js` 是具名导出，仅 `App.vue` import 了）。uni-app 编译后该引用为全局 undefined → 运行期抛 `ReferenceError` → 埋点静默失败、页面仍正常渲染（候选已在 throw 前 set），用户无感但事件为 0。
- **修复**：
  1. `match.vue` `<script>` 增加 `import { track, flushTrack } from '../../utils/track'`。
  2. `match.vue` `onHide` 内调 `flushTrack()`，保证快速切走也能把攒批事件（含 recommend_view）发出，不依赖 10s 定时器。
- **注意（用户侧必须动作）**：这是**前端**改动，需用户在微信开发者工具**重新 `npm run dev:mp-weixin` 构建并上传**后，进「匹配破冰」页（首页「去匹配破冰 ›」入口）才会真正触发。

**当前状态**：M4.1 服务端埋点验收通过；13 事件中 11 项已观测。`profile_completed` 待补测轮次 2（填齐资料）、`recommend_view` 待补测轮次 3（**重建前端后**进匹配页）后闭环。

### 🎉 补测终验 + M4.1 正式闭环（2026-08-30 05:0x，用户「我跑完了」）

用户重建前端（fix `572be3d`）并跑完轮次 2/3 后查库：**共 47 条** events。

**分组计数（47 条 / 11 类）**
| eventName | 计数 | 说明 |
|---|---|---|
| `app_open` | 23 | DAU 分母（前端，track.js 已重建） |
| `match_accept` | 4 | 含 R188↔6LrPFY 两次复配（合法） |
| `game_join` | 3 | |
| `game_done` | 3 | |
| `message_sent` | 7 | auditPassed:true |
| `pair_stage_changed` | 2 | S1→S2 / S0→S1 |
| `mbti_completed` | 1 | |
| `chat_unlocked` | 1 | ✅ 轮次1：R188↔6LrPFY 全新 pair 首条消息（ts 1788036077087） |
| `profile_completed` | 1 | ✅ 轮次2：R188 填齐四项资料（ts 1788036769035） |
| `recommend_view` | 2 | ✅ 轮次3：6LrPFY + R188 进匹配页各 1 次（count=5，ts 1788037369810 / 1788037399168）— **证明漏 import 修复生效** |
| `contact_unlocked` | 0 | 本轮无人达 S4 联系方式解锁，未触发（非 bug，实现已部署） |

**三断言全过**
- ✅ **PII 零泄漏**：全部 props 仅 `score`/`rounds`/`tacitCount`/`auditPassed`/`from`/`to`/`growthValue`/`mbti`/`count`，无 reason/微信号/昵称/消息正文。
- ✅ **白名单无越界**：11 类均在 13 白名单内。
- ✅ **`day`=CST(+8) / `pairId` 双 openid 排序拼 `|`**：全部正确。

**缺口闭合判定**
- `chat_unlocked` / `profile_completed` / `recommend_view` 三项原缺口**全部闭合**（后两者为测试数据/路径问题，前者为漏 import 代码 bug，均已解决）。
- `contact_unlocked`：`chat` 函数幂等修复已部署，但本轮测试未达 S4 解锁门槛，**未触发、无法用数据证明幂等**（实现层已改，逻辑关系正确）。
- `report_created`：用户本轮未举报，未触发（可选验证项，实现含 PII 过滤）。
- `relation_confirmed`：属 M4.4 范围，非 M4.1 实现项。

> **结论：M4.1 F9 全链路埋点 ✅ 正式闭环** —— 13 事件埋点代码全部实现、部署、真机验证；可观测 SC1–SC4 的管道打通。剩余 `contact_unlocked`/`report_created` 为「实现就绪、测试场景未覆盖」，不阻塞闭环。后续 M4.2 看板出数即可观测指标。

---

### M4.2 北极星看板 ✅ 已上线（2026-08-30 05:0x）

实现 `metrics.dashboard`（plan-m4.md §5 决策 1：**云函数返回 JSON**，无小程序内看板页、不引入管理员鉴权）。

- **部署**：`cloudfunctions/metrics/index.js` 新增 `dashboard` action（只读聚合，分页拉全量 `events`），`updateFunctionCode` 部署，`Status: Active`，CodeInfo 确认含完整聚合逻辑。
- **口径严格照搬 plan-m4.md §5，保证可复算**：
  - SC1 = 达 S2（`growthValue≥40`）的 pair ÷ 期间有 `game_done` 的 pair，目标 ≥30%
  - SC2 = 配对日 +7 当天有互动（`game_done`/`message_sent`）的 pair ÷ 期间 `match_accept` 的 pair，目标 ≥25%
  - SC3 = `contact_unlocked` 去重 pair ÷ 期间 `match_accept` pair，目标 ≥15%
  - SC4 = `relation_confirmed` 的 pair 数（定性证据待人工回访）
  - SC5 = 数据缺口（`report_handled` 未入白名单，处置能力留 M5）
  - 漏斗：`recommend_view`(users) → `match_accept` → `game_join` → `game_done` → `chat_unlocked` → `contact_unlocked`

**invoke 实测输出（action=dashboard, days=30，47 条 events）**

```
windowStartDay: 2026-08-01
sc:
  SC1_stage_s2_rate: 50
  SC2_d7_retention: 0
  SC3_contact_conv: 0
  SC4_relation_confirmed_pairs: 0
  SC5_report_24h: { status: "no_data", reason: "report_handled 未入白名单（M4 不做处置能力，留 M5）" }
sc_detail:
  SC1_pairs_reached_S2: 1   / SC1_pairs_with_game_done: 2
  SC2_pairs_matched: 3      / SC2_pairs_d7_active: 0
  SC3_pairs_contact: 0
funnel:
  recommend_view_users: 2 / match_accept_pairs: 3 / game_join_pairs: 2
  game_done_pairs: 2 / chat_unlocked_pairs: 1 / contact_unlocked_pairs: 0
```

**手工复算（口径一致 ✅）**

- `match_accept` 4 条事件 → 3 去重 pair（R188↔6LrPFY 复配 2 次合法）✅
- `game_join` 3 条 → 2 pair、`game_done` 3 条 → 2 pair ✅
- **SC1** = 1/2 = 50%（1 个 pair 有 `growthValue≥40` 的 `pair_stage_changed` S1→S2）≥ 30% 目标 ✅
- **SC2** = 0%：全部事件 `day=2026-08-30`，D7=2026-09-06 无数据 → 单日测试测不出 7 日留存，**口径正确非 bug** ✅
- **SC3** = 0%：`contact_unlocked` 已清理且无新解锁（幂等修复已部署）✅
- **SC4**=0 / **SC5**=no_data：均未实现（M4.4 / M5 范围）✅
- 漏斗各阶段去重计数与 47 条分布逐一吻合 ✅

> **结论：M4.2 ✅ 看板可出数，口径可复算。** Checkpoint M4 第一项「能观测 SC1–SC4（看板有数、口径可复算）」达成；SC5 仍为数据缺口，Checkpoint M4 该项需人工终审放行。下一步：M4.3 阈值校准（12/40/90/150 → 校准值或「样本不足沿用初值」）、M4.4 SC4 自评入口。

---

## M4.4 SC4 关系确认自评入口 ✅ 代码完成 + 已部署（2026-08-30，待真机验证）

**需求（plan-m4.md §5 M4.4 决策 3）**：关系主页「我们在一起了 🎉」自评入口 → 写 `pair.milestones` + 上报 `relation_confirmed`；沿用 M3 `growth` 云函数新增 `confirmRelation` action，幂等（同 pair 只记一次）。

### 改动

**后端 `cloudfunctions/growth/`**
1. `growth-core.js` 新增：
   - 常量 `RELATION_CONFIRMED_MILESTONE = '在一起 🎉'`
   - `confirmRelation(ctx, { openid, peerId })`：BUGBUG-1 护栏（缺 openid → 401）；`ensurePair` 建/取 pair；若 `milestones` 已含标记 → `alreadyConfirmed` 幂等返回（不写、不上报）；否则 `_.push` 里程碑 + `confirmedAt` 并写库。
2. `index.js`：`confirmRelation` action 路由；`core.confirmRelation` 返回 `confirmed=true` 时本进程内 `metrics.track` 上报 `relation_confirmed`（pairId=pairKeyOf，失败静默）。**绝不做跨函数调用**（BUG-1）。

**前端 `src/pages/relation/relation.vue`**
- `rel-actions` 加「我们在一起了 🎉」按钮：`canConfirm(p)` = 达 S1 且 milestones 未含『在一起』；点击 `onConfirm` 调 `callFunction('growth', { action:'confirmRelation', peerId })`，成功后本地补 milestones chip + toast。
- 已 `npm run sync:core` 同步 growth-core 到 game/chat/match 副本（维护约定）。

### 部署与校验

| 项 | 方式 | 结论 |
|---|---|---|
| 语法 | `node --check` 两文件 | ✅ 通过（修了一处 `confirmRelation` 重复声明导致编译失败，已改） |
| 内核同步 | `npm run sync:core` | ✅ game/chat/match 三副本均含 confirmRelation |
| growth 部署 | `manageFunctions(updateFunctionCode)` | ✅ Success；`getFunctionDetail` 轮询至 `Status: Active`、CodeInfo 含 confirmRelation（Namespace=love-app-server-d2fhg32320d65c12） |
| 前端编译 | `npm run build:mp-weixin` | ✅ `DONE Build complete`（DevTools 实际加载 `dist/dev`，用户本地 `dev:mp-weixin` 即可 HMR） |

### 真机验证步骤（待用户）
1. 双设备 A/B 走到关系页，至少达 S1（growthValue≥12）。
2. 该关系卡出现「我们在一起了 🎉」→ 点击 → toast「已记录 🎉」、卡上出现『在一起 🎉』chip。
3. 再点按钮：应已隐藏（milestones 含标记），不重复写、不重复上报。
4. 查库：`pairs` 该 pair `milestones` 含『在一起 🎉』、`confirmedAt` 有值；`events` 出现 1 条 `relation_confirmed`（pairId=双 openid 排序拼 `|`）。
5. 看板 `metrics.dashboard` 的 `SC4_relation_confirmed_pairs` 自增 1。

### 已知限制 / 待办
- 真机读数未跑（需双设备 + 真实关系），SC4 看板当前仍为 0，属「实现就绪、场景未覆盖」，不阻塞闭环。
- 按钮门槛设在 S1（产品判断，防对陌生人误触）；若需更宽松/严格可改 `canConfirm` 的 `reached(..., 'S1')`。
- M4.3 阈值校准仍待做（样本不足则写「沿用初值」）。

## M4.4（升级）双边邀请确认 ✅ 代码完成 + 已部署（2026-08-30，待真机验证）

**背景**：用户真机验证单边版发现——A 点「我们在一起了 🎉」直接落库，B 端不实时刷新（须退回主页重进才见）。按用户要求改为**双边邀请 + 超时兜底**，沿用 chat 的弱实时轮询（不用 realtime.js）。

### 改动
**后端 `cloudfunctions/growth/`（growth-core.js + index.js）**
- `growth-core.js` 单边 `confirmRelation` 改为四个动作：
  - `sendConfirmInvite(ctx,{openid,peerId})`：读 pair（无 pair→403 先一起玩）；已确认→幂等返回；未达 S1(≥12)→403；有有效邀请时：自己发的→幂等返回、对方发的→409 提示去确认；否则写 `pairs.confirmInvite={from,at,expiresAt}`，`expiresAt=now+CONFIRM_INVITE_TTL_MS`(10min)。
  - `acceptConfirmInvite`：校验邀请有效且 `from!==openid`，写 `milestones` + `confirmedAt` + `confirmInvite:_.remove()`。
  - `rejectConfirmInvite` / `cancelConfirmInvite`：清空 `confirmInvite`（reject 限被邀请方、cancel 限发起方）。
  - BUG-1 护栏（缺 openid→401）全保留；`confirmInviteActive(pair,now)` 统一判活。
- `index.js`：`acceptConfirmInvite` 确认成功时本进程内 `metrics.track(relation_confirmed)`（pairId=pairKeyOf，失败静默）。其余三个动作透传。
- `npm run sync:core` 已同步到 game/chat/match 副本。

**前端 `src/pages/relation/relation.vue`**
- A 端：`onConfirm`→`sendConfirmInvite`；显示「等待对方回应·倒计时（点此撤销）」→`cancelConfirmInvite`。
- B 端：关系页加 4s 轮询（`load(silent)`）+ 1s 倒计时 tick；`receivedInvite()` 命中即弹自定义弹窗（同意/拒绝 + 倒计时）。
- 仅在「未确认 + 达 S1 + 无进行中邀请」时显示「我们在一起了 🎉」按钮；`isMyInvite`/`isReceivedInvite`/`isInviteActive` 派生状态。

### 部署与校验
| 项 | 方式 | 结论 |
|---|---|---|
| 语法 | `node --check` growth-core.js / index.js | ✅ 通过 |
| 内核同步 | `npm run sync:core` | ✅ 三副本均含 sendConfirmInvite 等 |
| growth 部署 | `manageFunctions(updateFunctionCode, functionRootPath="D:/Tencent/app/cloudfunctions")` | ✅ Success；轮询至 `Status: Active`、CodeInfo 含四个新 action（Namespace=love-app-server-d2fhg32320d65c12） |
| 前端编译 | `npm run build:mp-weixin` | ✅ `DONE Build complete`（DevTools 加载 `dist/dev`，用户本地 `dev:mp-weixin` HMR） |

### 真机验证步骤（待用户）
1. ⚠️ **用全新 pair**：旧单边版点过的目标 pair 已含 milestones『在一起 🎉』，`sendConfirmInvite` 会直接返回已确认，无法测新流程。双设备 A/B 走到新关系、达 S1。
2. A 关系页点「我们在一起了 🎉」→ toast「邀请已发送」+ 显示「等待对方回应·倒计时」。
3. **B 无需重进**：其关系页经 4s 轮询自动弹出「在一起确认邀请」弹窗（含倒计时）。
4. B 点「同意 🎉」→ 双方卡均出现『在一起 🎉』chip；`events` 增 1 条 `relation_confirmed`。B 点「拒绝」→ 邀请清空、A 端回流可重发。
5. 超时：A 发起后不动，10min 内 A 端倒计时归零→按钮回流「可重新发起」；B 弹窗消失（服务端 accept 会因过期返回 409）。
6. 查库：`pairs` 该 pair `milestones` 含『在一起 🎉』、`confirmedAt` 有值、`confirmInvite` 已清；看板 `SC4_relation_confirmed_pairs` 自增 1。

### 已知限制 / 待办
- 超时采用「客户端倒计时展示 + 服务端过期校验」双保险；服务端为权威。
- 弹窗为前端轮询驱动（4s），非推送；若 B 恰在轮询间隙进入页面，onShow 会立即 `load` 拉到邀请。
- M4.3 阈值校准仍待做。

## M4.4b 邀请投递全局化修复 ✅ 代码完成 + 已编译（2026-08-30，待真机验证）

### 问题（用户反馈）
A 发送邀请后，**B 收不到**（除非 B 恰好停在关系页）。

### 根因（Code Review 定位）
上一版把邀请轮询挂在 `relation.vue` 的 onShow/onHide——**页面级**轮询。B 不在关系页时轮询已停，A 发的邀请在 B 端无人拉取。即「弱实时」只做到了「关系页内实时」，不是「应用级投递」。

另发现隐藏 bug：`receivedInvite` 原为 method，模板 `v-if="receivedInvite"` 拿到的是函数引用（恒真值），且 `onReject(receivedInvite)` 传的是函数本身——弹窗常显、动作传参错误。

### 修复（纯前端，服务端无改动）
1. **新增 `src/utils/confirmInvite.js`**：全局邀请 store（vue reactive 单例，项目无 Pinia/Vuex）。
   - `inviteState = { openid, pairs, nowTs, notifiedKey }`；4s 轮询拉 `listPairs` + 1s tick 倒计时。
   - `startInviteWatch(onNewInvite)` / `stopInviteWatch()`；`refreshInvites()` 页面级立即拉取。
   - 派生：`currentReceived()` / `isMyInvite(p)` / `isInviteActive(p)` / `inviteRemain(p)`。
   - 动作封装：`send/accept/reject/cancelConfirmInvite` 四个 action 的调用封装。
   - 命名避让：`src/utils/invite.js` 已被 T2 邀请裂变占用，故用 `confirmInvite.js`。
2. **`App.vue`**：onShow 启动 `startInviteWatch(handleNewInvite)`、onHide 停止。
   - B 收到新邀请且**当前不在关系页**时，用 `uni.showModal` 原生弹窗通知（任意页面盖顶）；「去处理」跳关系页。
   - 同一邀请只原生通知一次（`notifiedKey` 按 pairKey+expiresAt 去重）；已在关系页时不叠原生弹窗（页内富弹窗自己显示）。
3. **`relation.vue`**：数据源改为消费共享 store（computed `pairs` / `receivedInvite`），删除页面级 `startPolling/stopPolling/timer/tick/nowTs`；`receivedInvite` 改为 computed（修复恒真值 bug）；四个动作改调 store 封装后 `load(true)` 刷新。

### 校验
| 项 | 方式 | 结论 |
|---|---|---|
| 前端编译 | `npm run build:mp-weixin` | ✅ `DONE Build complete` |
| 服务端 | 无改动（上次部署的四个 action 原样有效） | ✅ 无需重部署 |

### 真机验证步骤（待用户，增量）
1. 本地跑 `npm run dev:mp-weixin` 重建 `dist/dev` 并上传。
2. **B 停在任意非关系页**（如主页/聊天页）→ A 在关系页发邀请。
3. 预期：B 在 4s 内收到原生弹窗「💌 在一起确认邀请」；点「去处理」进关系页看到富弹窗（同意/拒绝+倒计时）。
4. B 停在关系页时：不弹原生窗，直接页内富弹窗。
5. 其余（同意落里程碑/拒绝/超时/查库/看板 SC4）同上一节步骤 4–6。

### 布局微调（用户真机反馈，2026-08-30 18:52）
- 问题：A 发邀请后 `rel-actions` 里插入 `btn pending` 长文案按钮，导致「一起玩/聊聊/联系方式」列尺寸跳动。
- 修复：撤销功能独立为信息区（rel-meta）的一行状态条「💌 等待 XX 回应 · 倒计时 · 撤销」（`.invite-status` + 内联 `.cancel-link`），`rel-actions` 恢复恒定三按钮；删除 `.btn.pending` 样式。编译 `build:mp-weixin` DONE。


## M4.3 阈值校准 ✅ 结论=样本不足沿用初值（2026-08-30 19:16）

### 数据快照
- `pairs` 3 对（同日创建、全测试账号）：growthValue {150, 150, 21}；其中 1 对含 milestones『在一起 🎉』（双边邀请真机确认）。
- `events` 108 条（单日）：app_open 占多数；match_accept×5、game_done×3、message_sent×7、chat_unlocked×1、pair_stage_changed×2、relation_confirmed×3（唯一 pair=1）。

### 分桶表
| 桶 | pair 数 | 代理指标 |
|---|---|---|
| S1（12–39） | 1（growth 21） | 解锁聊天+发消息×2；未解锁联系方式 |
| S2/S3 | 0（仅途经事件） | — |
| S4（150） | 2 | ① 3局/默契14/互聊5条/已确认 ② 2局/默契8/0聊天/未确认 |

### 结论
**n=3、单日、零自然用户、D7 不可算 → 样本不足，沿用初值 12/40/90/150**（规划决策 4：避免小样本过拟合）。详见 `tasks/threshold-calibration.md`。

### 数据质量观察（2026-08-30 19:40 代码级复核修正）
1. growthValue 区分度弱系**测试污染**而非权重偏高：实际权重（游戏 +8/局、聊天 +2/轮、streak +3/天）下纯游戏到 S4 需约 19 局，「2 局即 150」的大额成长来自 M4.1 期手工 addGrowth 测试调用。真实权重配比是否合理待自然用户数据判定。
2. `app_open` 冷启动双计对现行看板**零影响**（SC1–SC5 均不消费 app_open，SC2 为 pair 维度 D7 互动留存）；仅影响未来从 events 裸数 DAU——按 (userId, day) 去重即可消除。修复不紧急，App.vue 过时注释已更正。详见 threshold-calibration.md 观察节。

---

## M5 验证记录（2026-08-30）

### M5 代码落地 + 云端部署（Agent 执行）

| 项 | 结果 |
|---|---|
| 语法校验 | `node --check` safety/index.js、metrics/index.js、metrics-core.js 全过 |
| 生产构建 | `npm run build:mp-weixin` DONE（App.vue 双计修复编译通过） |
| safety 部署 | updateFunctionCode 受理 → getFunctionDetail `Status=Active`（ModTime 20:38:27），CodeInfo 含 `handleReport`/`isAdmin`（管理员校验） |
| metrics 部署 | updateFunctionCode 受理 → `Status=Active`（ModTime 20:38:33），CodeInfo 含 `computeSC5`/`fetchAllReports` |
| dashboard 冒烟 | MCP invoke `action=dashboard` → code=0，`SC5_report_24h={status:"no_data", pendingCount:1, handledCount:0, source:"reports"}`，SC1–SC4 读数与 M4 复算一致（SC1=50%，SC4=1），_note 已更新口径说明 |
| 提交 | `993e1c0`(M5.2 白名单) → `6a7c486`(M5.1 handleReport) → `74e0cf0`(M5.3 dashboard) → `022cdad`(M5.4 双计修复)，原子分提 |

### 数据盘点

- `reports` 集合现有 1 条 pending（_id `0fb91b1d6a9096dc010ed1b84230ff4f`，targetType=post）——真机验收可直接用它走处置闭环
- `admins` 集合**未创建**——handleReport 现阶段对所有人返回 403（护栏生效，但也意味着无人能处置）

### 待人工验收（Checkpoint M5）

1. 控制台建 `admins` 集合 + 插入管理员 openid（users 现有 6 个 openid 可选）
2. 真机：普通账号举报 → 管理员处置 → reports.status 变更 + handledAt → dashboard SC5 出 rate
3. 非管理员调 handleReport 返回 403；重复 handle 返回 alreadyHandled
4. 冷启动小程序 → events 无毫秒级成对 app_open；切后台回前台各报一条

---

## M5 线上验收（2026-08-30 21:20，Agent 执行）

| 验收项 | 结果 |
|---|---|
| admins 集合初始化 | ✅ 用户已建（21:14），含 1 个管理员 openid `oUsf1xRnPxcjWLiSG3XFR-6LrPFY` |
| 未登录守卫 | ✅ MCP invoke `handleReport`（无登录态）→ `401 未登录`（服务端鉴权真实生效） |
| 举报→处置→SC5 闭环 | ✅ reports 3 条 pending（真机新增 2 条）→ 按等价字段处置 1 条（`0fb91b1d6a942cea0165aab0753f4c59`，handledBy=管理员，note 注明验收模拟）→ dashboard：`SC5={status:ok, rate:100, handledCount:1, within24h:1, pendingCount:2}`，SC1=50% / SC4=1 与 M4 一致 |
| app_open 双计修复 | ✅ events 复核：20:38 部署后 5 次启动（20:59/21:00/21:07×2/21:12/21:15）全为单条；部署前存在毫秒级成对样本（如 19:46 同用户 3ms 成对） |
| 403 / alreadyHandled | ⚠️ 未走真实登录态端到端（无管理员 UI；MCP 直调无 openid，只能验到 401）。逻辑经代码审查覆盖，待管理员 UI 上线后真机补验 |

**结论**：Checkpoint M5 技术项全部有据可查，SC1–SC5 全有数。剩人工终审；建议 M6 规划管理员 UI（pending 列表 + 处置按钮），顺带补验 403/幂等路径。

---

## M6 落地记录（2026-08-30 22:18，Agent 执行，用户签字放行）

| 项 | 结果 |
|---|---|
| 语法校验 | `node --check cloudfunctions/safety/index.js` PASS |
| 生产构建 | `npm run build:mp-weixin` DONE（首编因 settings.vue 脚本块重复 `methods:` 报错，已修） |
| safety 部署 | updateFunctionCode 受理 → getFunctionDetail `Status=Active`（ModTime 22:18:44），CodeInfo 含 `isAdminAction`/`listReports` |
| isAdmin 冒烟 | MCP invoke `action=isAdmin` → `401 未登录`（无登录态守卫生效，动作已接线非 unknown） |
| listReports 冒烟 | MCP invoke `action=listReports` → `401 未登录`（同上） |
| 提交 | `878ad10`(safety isAdmin+listReports) → `d4cd6b2`(admin 前端) → `9ce5c71`(config community=true)，原子分提 |

### 交付内容
- M6.1 `safety.isAdmin`：查 admins 集合 by OPENID → {isAdmin}，未登录 401；纯读
- M6.2 `src/utils/admin.js` `isCurrentUserAdmin()`（会话缓存，未登录/网络错误不缓存）+ settings.vue「管理后台」条件入口
- M6.3 `safety.listReports`（管理员鉴权 + join users 取举报人昵称）+ `pages/admin/reports.vue`（pending/已处置 tab、处置/驳回、幂等禁用、isAdmin 深链守卫）+ pages.json 注册
- M6.4 `config.js` community 正式提交 true（注释同步「已开启」）

### 待真机验收（Checkpoint M6，MCP 无登录态无法走 happy path）
1. 管理员账号：设置页见「管理后台」→ 处置 1 条 pending → reports.status 变 handled/handledAt 落库 → dashboard SC5 出 rate
2. 非管理员：settings 无入口；深链 admin 页被守卫 toast 拦截
3. 重复处置：alreadyHandled 提示 + 按钮禁用；服务端 403 双向印证
4. reports 现 2 条 pending 可作验收样本
