# HANDOFF.md

# 项目/任务

从零构建「恋爱成长型社交小程序」v1 —— 以"关系成长"为核心驱动的微信小程序，用「轻社交社区 + 双人轻互动小游戏 + 性格匹配(MBTI)」让单身用户从陌生 → 好感累积 → 信任，关系自然发生，最终促成真实伴侣关系。

当前处于 **Implement 阶段**：M0 地基已验收、M1 聚人已通过 Checkpoint（step 1–6）、**M2 破冰代码完成并已提交**，且本轮额外完成了 MBTI 资料项、社区功能开关、拉黑闭环与撮合 N+1 优化。

> **⚠️ 2026-08-29 17:30 新 Agent 接手后实测核实 —— 推翻上一版 HANDOFF 的核心前提，请以此为准。**
> 旧版称"瓶颈是部署：4 个云函数未部署、3 个集合未建、真机从未验证"。**实测这三条都不成立**：
> 1. **7 个云函数全部已部署**。`auth`/`match`/`safety`/`game` 的云端代码与本地**逐字节一致**（下载云端 zip 解压后 diff，非靠时间戳推断）。唯一落后的 `community`（云端残留 5 行 `getPostDetail` 调试日志）已在本次接手时重新部署并调用验证通过。
> 2. **10 个集合全部已建且有数据**：`users`(5) / `topics`(5) / `posts`(6) / `comments`(1) / `blocks`(0) / `reports`(1) / `invites`(0) / `matches`(3) / `games`(3) / `gameQuestions`(10，已自动播种)。
> 3. **M2 闭环在云端实际跑通过**：CLS 日志显示 2026-08-28 23:0x 有一局完整走到 `state=done, round=6/5`（joinGame→playing→5 轮双方答题→结束）。现存 DB 里 3 局 `cancelled` 是之后换号重试、单方建局又取消产生的。
> 4. **Agent 可代劳云端操作**：通过 CloudBase MCP 工具能直接部署函数、查集合、读数据、拉日志，**无需用户点 GUI**。旧版"Agent 不能代劳 GUI"的前提不再成立。
> 5. **环境是纯 NoSQL，不是 PG 内核**（见下方"环境内核澄清"）。
>
> **结论：当前瓶颈不是部署，而是 ① 双设备真机验证未闭环、② MBTI / 拉黑两项新功能零数据未验证、③ M3 是否开工待用户决策。**

---

# 核心目标

- **最终产出**：可上线验证的微信小程序（v1 仅单身主链路）。
- **v1 成功定义（北极星）【已确认】**：真的有人通过它交到伴侣，并成为留存用户。可量化信号 = "关系成长是否真发生"（SC1–SC5）。
- **v1 不做营收**：变现（内购道具等）后置，数据结构预留虚拟道具字段位即可。

---

# 用户需求与约束

| 类别 | 内容 | 状态 |
|------|------|------|
| 产品形态 | 微信小程序（非独立 App、非 H5） | 【已确认】 |
| 用户群 | 20–28 岁、一二线城市单身年轻人；嫌探探"太看脸"、Soul"太飘难破冰" | 【已确认】 |
| v1 范围 | 仅单身主链路（社区融入→游戏结识→自然升温→导向恋爱）；**情侣经营、内购变现明确 Out of scope** | 【已确认】 |
| 技术基座 | 前端 uni-app(Vue3+Vite) 编译 mp-weixin；后端微信云开发 CloudBase（PG 内核环境，文档库可用） | 【已确认·用户签字】 |
| 实时性 | 弱实时（回合制游戏，云数据库 watch / 轻量轮询秒级足够，不建 WS 集群） | 【已确认】 |
| 冷启动 | 社区先行 + 邀请裂变，不依赖假数据/AI 陪玩 | 【已确认】 |
| 合规 | UGC 必须过内容安全；需隐私政策 + 授权弹窗 + 举报机制 | 【已确认】 |
| 阈值初值 | 关系成长阶段门限 12/40/90/150 作为首版上线值，后续 F9 校准 | 【已确认·用户签字】 |
| 交付节奏 | M0–M4 作为 v1 交付节奏，每里程碑可独立评审 | 【已确认·用户签字】 |

**底线约束（来自 SPEC §9，必须始终遵守）**
- Always：UGC/私聊先审后发；服务端校验一切输入；成长值只增不减；改前先更 Spec。
- Never：提交密钥/openid 明文到仓库或前端；v1 加情侣经营或变现；跳过内容安全；用假数据伪造指标；用非官方"个人微信协议"加好友（违规封号风险）。
- Ask-first：前端框架/依赖/数据模型/营收相关改动（前端框架已定为 uni-app，再变需重新评审）。

**上线路径决策【已确认】**：**个人账号先做原型验证**，上架门槛（企业主体+社交类目+内容安全+隐私政策）延后到验证产品价值之后。含义：功能开发不受账号影响；内容安全/隐私政策在原型期可先占位。

---

# 背景知识

- **关系成长主线（产品灵魂）**：两人共享一条成长值，5 阶段 S0→S4：S0 陌生(0) → S1 有点意思(≥12) → S2 聊得来的朋友(≥40) → S3 有好感(≥90) → S4 信任·可加微信(≥150)。阶段由"事件标志 + 成长值"共同判定。
- **累加规则（Plan §5，初值）**：共同完成一场游戏 +8；一轮有效互聊 +2；互加游戏好友 +5；连续天数互动 +3/天（周上限 +15）；双方正向互评当次增益 ×1.5。只增不减。
- **匹配**：冷启期用兴趣标签/资料属性/MBTI 的规则匹配（T4），后续升级协同过滤。
- **微信加好友闭环（关键）**：小程序无"一键加好友"官方 API。F6 在 S4 解锁对方**联系方式**——展示个人微信二维码（长按识别）/ 或复制微信号去微信添加。
- **【已更正 2026-08-29】CloudBase 环境内核澄清**：旧版称"PG 内核环境，文档库可用"，**实测为纯 NoSQL，不存在 PG**。`queryEnv(action=info)` 返回 `RuntimeMode: "nosql"`、`RuntimeBackends: {postgresql: false, nosql: true, mysql: false}`、`PostgreSQL: null`，官方提示明确写"PostgreSQL is NOT provisioned in this env — this is a legacy NoSQL CloudBase backend"。
  - **对项目无实质影响**：既定决策本就是沿用文档库 `cloud.database()`，不写 SQL，所以代码一行都不用改。
  - **但影响认知**：不要再提"PG 模式 / 用 `app.rdb()` / 用 RLS 策略"，本环境不适用；权限仍走 `managePermissions(resourceType="noSqlDatabase")` + Security Rules。MySQL 也不可用。
- **构建产物两个目录（极易错）**：`npm run dev:mp-weixin` 产物在 `dist/dev/mp-weixin/`（HMR 热重载，**DevTools 实际加载**）；`npm run build:mp-weixin` 产物在 `dist/build/mp-weixin/`（生产，当前配置**不加载**）。小程序只能在 DevTools 运行，不能当网页/Node 跑。
- **项目记忆目录**：`D:\Tencent\app\.workbuddy\memory\YYYY-MM-DD.md`（按日追加，被 `.gitignore:20` 排除，不进仓库，但接手时值得一读）。

---

# 已确认事实

**技术决策（T1–T5 + P1–P4 全部定案，见 `spec/SPEC.md` §10）**
- 前端 = uni-app(Vue3+Vite) 编译 mp-weixin（覆盖 Spec 默认原生，用户签字）。原生骨架已归档 `legacy/`。
- 后端 = CloudBase（PG 内核，文档库）。
- 微信 appid = `wx900385d98d023d6f`（已写入 manifest.json / project.config.json）。
- CloudBase 环境 ID = `love-app-server-d2fhg32320d65c12`（已写入 `src/utils/cloud.js` 的 `CLOUD_ENV`）【已确认】。
- 身份 = 微信 `openid`，由云函数 `cloud.getWXContext().OPENID` 取得，绝不落前端/仓库。
- 管理版 Node：`C:\Users\panda\.workbuddy\binaries\node\versions\22.22.2\node.exe`（v22.22.2）。
- 远程仓库 = `git@github.com:Tea-Codeman/love_app.git`（分支 `main`，SSH）。remote 已配置，但**本地分支当前无可用上游追踪引用**（`origin/main` 显示为 `gone`）。

**里程碑进度**
- **M0 地基 ✅ 已验收**（用户 2026-08-27 回执）。M0 Checkpoint 六步全通过。
- **M1 聚人 ✅ 代码完成 + Checkpoint 通过（step 1–6）**（用户 2026-08-28 回执）。**step 7 裂变因个人账号封禁分享延后**：微信对个人/社交类目小程序禁分享，页面一旦定义 `onShareAppMessage`，基础库会内部自动 `showShareMenu` 并返回 `fail banned`。已移除 `onShareAppMessage` 与「邀请好友」入口，底层归因逻辑（`invite` 云函数 + `auth.login` 的 `inviteCode` + `App.vue` 捕获 `?inviter=`）保留。
- **M2 破冰 ✅ 已收尾并通过 Checkpoint（2026-08-30）**：双设备真机验证 V1–V4 全部 PASS —— 撮合→建局→答题→结束闭环、MBTI 落库、拉黑/解除闭环、契合度加成显示正常，**均有云端查库佐证**（见 `tasks/verification-log.md`）。
  - **答题逻辑已改版**：用户反馈回合制"一人选完等另一人选完太死板" → 改为**匹配后各自独立答题、最后出结果时对比两人答案算默契度**（提交 `ab8cbd8`，`game` 云函数已部署并核验落地）。
  - **cancelled 残留已清理**：按方案 B 执行，`matches` / `games` 各 10→2（8 条真残留删除 + 2 条异常 match 翻 `done`），已云端核验。
- **本轮（2026-08-29）额外完成**：MBTI 资料项、社区特性开关、拉黑闭环（拉黑按钮 + 黑名单管理页）、撮合 N+1 优化。**全部已提交，工作树干净**。
- **【2026-08-29 17:30 核实】M2 云端实测证据**：CLS 日志（2026-08-28 23:00–23:59，`game` 函数 30 条调用，全部 `status_code=200`）显示用户 `6LrPFY` × `actAho` 的一局走完：`waiting(players=1)` → `joinGame` → `playing(round=1/5, players=2, q=5)` → 逐轮 2/5、3/5、4/5、5/5 → `state=done, round=6/5`。**说明撮合→建局→加入→答题→结束的主链路在真实环境可用。**
- **【同批核实】未被验证的功能**：`users` 5 条数据**无一有 `mbti` 字段**、`blocks` 集合 **0 条** → MBTI 测评保存与拉黑/解除两项新功能**至今零数据、从未真实验证过**（代码已部署，只差真机点一遍）。

**版本与回滚锚点（2026-08-30）**
- **当前版本 `v0.3.0`**（= M3 升温·导流，代码完成待真机验证）。tag 为**带注释的本地 tag，未推送**。
- 版本映射：**MINOR 号 = 里程碑号**（`v0.3.0` = M3）。`0.1.0` 是 M0 初始化时随脚手架写入的，M1/M2 未打标，号段未被占用。变更记录见 `CHANGELOG.md`。
- **回滚**：`git checkout v0.3.0` 回到本版本；`git revert <commit>` 逐个撤功能提交（M3 每个任务都是独立原子提交）。**云函数需重新部署对应版本代码**，前端回滚后必须重建 `dist/dev`。
- 打标前的版本提交：`chore(release): v0.3.0`（仅含 `package.json` 版本号 + `CHANGELOG.md` + 本文档说明，无功能改动）。

**Git 状态（重要，2026-08-30 更新）**
- **远端 `main` 已同步**：2026-08-29 用 `git fetch` 修好 `origin/main` 追踪引用后推送，25 个历史提交全部上远端（含旧的 `338cb5c`）。**"本地领先 13 提交未推送"的旧账已结清。**
- **上游追踪正常**（`main` → `origin/main`），推送直接 `git push origin main`，**绝不 force push**。
- **用户重视提交作为回滚锚点**：改功能前先确认/补齐提交，按关注点拆原子提交（功能 / 开关 / 文档 / 性能 / 纯格式 各自独立）。
- 工作树**干净**。旧文档提到的 `PRECONTEXT.md` / `CONRRENTCONTEXT.md` / `SKILL.md` **均已不存在**（已清理，勿再挂念）。

**数据模型（云数据库集合）**
- `users`✅：`openid(PK)`, `nickname`, `avatarUrl`, `gender`, `age`, `city`, `interestTags[]`, `bio`, `mbti`(16 种四字母如 `INFP`，资料页 12 题测评写入), `createdAt`, `invitedBy`
- `topics`✅ / `posts`✅ / `comments`✅ / `blocks`✅：`community` 与 `safety` 云函数使用
- `reports`✅：`safety` 使用
- `invites`✅：`invite` 使用
- `matches`✅ / `games`✅ / `gameQuestions`✅（M2）：`match`/`game` 使用
- **【2026-08-29 核实】10 个集合全部实测存在**（`readNoSqlDatabaseStructure listCollections`）：`users`(5 条) / `topics`(5) / `posts`(6) / `comments`(1) / `blocks`(**0**) / `reports`(1) / `invites`(0) / `matches`(3) / `games`(3) / `gameQuestions`(10)。**无需再建任何 M2 及以前的集合。**
  - `gameQuestions` 10 条 = `game.ensureSeedQuestions()` 首次调用自动播种成功（只播种数据、不建集合的规则不变）。
  - `blocks` 0 条 = 拉黑功能从未真机使用；`users` 无 `mbti` = MBTI 从未保存。这两项是下一轮验证重点。
- **【2026-08-30 实测】`pairs` / `messages` / `events` / `metrics` 4 个集合均已建且为空** ✅（M3.0 完成）。注意：**代码不自动建**（用户已否决），换环境仍需手动建在该环境。
  - **`pairs`（M3 默契度系统权威源）**：每对用户一条文档（`pairKey = sorted(openidA, openidB)`），存累计 `gamesPlayed`/`tacitTotal`/`lastGameAt`/维度分/`relationshipStage`。M3 从 `pairs` 读（O(1)），M2 的「聚合 done matches」仅作**历史回填来源**。

**云函数（已实现 7 个）—— 2026-08-29 17:30 逐字节核实结果**
| 函数 | 动作 | 云端 vs 本地 | 备注 |
|------|------|------|------|
| `auth` | login / updateProfile（含 MBTI 白名单） | ✅ **完全一致** | 已部署 |
| `ping` | 连通性检查 | ✅ 已部署 | M0 连通性 |
| `community` | listTopics / listPosts / createPost / likePost / addComment / getPostDetail | ⚠️→✅ **本次已重新部署** | 原本云端残留 5 行调试日志，现已同步为本地清理版并调用 `listTopics` 验证通过（社区仍搁置） |
| `safety` | checkText / checkImage / report / **block** / **listBlocks** / **unblock** | ✅ **完全一致** | 已部署；`listBlocks` 实测返回 `401 未登录`（证明 action 存在） |
| `invite` | generate / consume | ✅ 已部署 | UI 入口已移除，底层逻辑保留 |
| `match` | recommend / accept / myPending / decline | ✅ **完全一致** | 已部署（含 MBTI 打分 + N+1 优化） |
| `game` | joinGame / getGame / submitAnswer / cancelGame | ✅ **完全一致** | 已部署，云端跑通过完整局 |
| `growth` | getPair / listPairs / addGrowth | ✅ **M3 新建并部署** | pairs 权威源；只增不减 + streak（+3/天，周上限 15） |
| `chat` | send / list / contact | ✅ **M3 新建并部署** | 先审后发（复用 `safety`）+ S1 门禁 + 有效互聊 +2 + S4 联系方式解锁 |
| `match` | recommend / accept / myPending / decline | ✅ **M3 已更新** | `recommend` 改读 `pairs`（O(1)）+ 首访回填；超时 3s→10s |
| `auth` | updateProfile / … | ✅ **M3 已更新** | `sanitizeProfile` 白名单新增 `wechatId` / `wechatQrUrl` |

> **核实方法（可复现，勿再靠 ModTime 猜）**：`queryFunctions(action=getFunctionDownloadUrl)` 拿 zip → 解压取 `index.js` → 与本地 `cloudfunctions/<fn>/index.js` 比对。注意 zip 内是 CRLF，本地是 LF，**直接 diff 会误报整文件不同**，需先归一化换行符再比较。

**成功标准（SC1–SC5，初版门槛，待 F9 校准）**
- SC1 走到 S2 及以上比例 ≥30%；SC2 配对后 7 日留存 ≥25%；SC3 解锁联系方式并加微信比例 ≥15%；SC4 北极星：有可归因真实伴侣关系形成；SC5 内容违规 24h 处置率 ≥95%。

---

# 当前方案与关键决策

**架构类**
- **后端 = CloudBase（PG 内核，沿用文档型数据库）**：确认文档库可用 `cloud.database()` + Security Rules，数据模型不改写 SQL。
- **云函数环境 = `DYNAMIC_CURRENT_ENV`**：所有云函数统一 `cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })`。**曾尝试写死 env 与「自动建集合」，被用户明确否决并已撤销，勿再提议**。
- **【M3 数据架构】默契度系统以 `pairs` 集合为权威累计源**，M2 的「聚合 done matches」仅作历史回填。背景：M2 为立刻见效、零建集合，采用 `recommend` 每次扫描所有 `status=done` 的 `matches` 汇总 `lastTacit`（读 O(N)、schema 混用、难扩维度）。M3 引入 `pairs` 做权威累计源（游戏结束处原子自增，recommend 改读 pairs = O(1)），M2 聚合逻辑保留为回填路径。**不必现在推翻 M2 代码**，做 M3 时平移即可。已与用户对齐。

**安全类（最重要，务必遵守）**
- **【拉黑过滤只能由服务端执行】**：用户曾提议「前端持有已拉黑列表 → 传给后端(community/match)过滤」，**已明确否决**。理由：`wx.cloud.callFunction` 的 payload 完全由客户端控制，传空数组即可绕过，拉黑从「安全机制」退化成「装饰」，防骚扰（本产品核心诉求）完全失效；此外还有状态漂移（换设备/清缓存即失效）、payload 无界增长、服务端失去审计追溯三个问题。
  - **原则：前端只负责"显示"黑名单，服务端负责"执行"黑名单。**
  - **例外（可行）**：非安全类的**体验偏好**过滤（如"本次会话已划过的候选人"）可以由前端传参。
  - 该原则已写入 `cloudfunctions/safety/index.js` 头部注释。
- **`unblock` 必须按 `where({ blockerId: OPENID, blockedId })` 限定**：云函数以管理员权限运行，不过滤 `blockerId` 就能删掉**他人**的拉黑记录。
- **内容安全（M1 决策）**：原型期用本地分类器兜底。`safety` 内有 `USE_WX_SECURITY = false` 开关，当前走本地关键词（样本词：`代开发票/涉黄/赌博/诈骗/违规样例/广告加微`；空内容、超长也拒），**不过审不发**。企业资质就绪后把开关置 `true` 即切微信官方 `msgSecCheck`/`mediaCheckAsync`，业务代码无需改动。

**产品/功能类**
- **【社区搁置 + 特性开关】**：社区因个人主体 + 社交类目资质未就绪而搁置，**代码与数据一律保留不删除**。新增 `src/utils/config.js` 导出 `FEATURES = { community: false }`，首页「去社区」改为 `v-if="features.community"`，**当前已隐藏**。约定：开关只管入口显隐，**不动 `pages.json` 路由、不删社区代码与集合**（深链接/扫码仍可直达，便于内部测试与一键恢复）。**恢复方式：把 `community` 改回 `true` 即可，无需改其他文件。**
- **【MBTI 参与撮合打分】**：`scoreMbtiFit()` —— 每有 1 个维度字母相同 `MBTI_SAME_WEIGHT=2`（0–8），**EI 互补另 `+3`**（SN/TF/JP 相同 = 沟通方式、价值观、生活节奏契合；EI 一外向一内向 = 经典互补）；任一方未测评返回 0，**不惩罚未填资料的用户**。权重常量集中在 `cloudfunctions/match/index.js` 顶部便于调整。注意：INFP×ENFP = 9 分，高于 INFP×INFP = 8 分，这是刻意的。
- **【默契判定 = 双方选同一项】**，无需预设标准答案；`gameQuestions.correctPairHint` 字段保留备用。
- **【游戏结束后可再约】**：产品意图由用户确认——玩完要让双方回到大厅仍互相可见、可再约，靠多次游戏累积默契度。实现：`game.submitAnswer` 在 `state→done` 时把对应 `matches` 翻成 `done`（并落盘 `finishedAt`/`lastTacit`/`lastRounds`）；`match.getMatchedOpenids` 只过滤 `active`，故 `done` 后自然重新可推。
- **【详情页性能】**：`community` 把"帖子+评论"合并为单次 `getPostDetail` action（函数内 `Promise.all` 并行查），前端只发 1 次 `callFunction`，避免两次云函数冷启动叠加。

---

# 已完成工作

**需求澄清 → Spec → Plan → Tasks → Implement（M0 全卡 + M1 全卡 + M2 全卡）全流程已走完。**

1. **需求澄清 + Spec.md（v1.0）**：`spec/SPEC.md` 全部 Open Questions 已决议，是当前唯一事实来源。
2. **plan.md（已批准）**：`tasks/plan.md` —— 架构、M0–M4 里程碑、数据模型、成长阈值、云函数划分、风险、签字。
3. **todo.md（20 张任务卡）**：`tasks/todo.md` —— M0.1–M4.3，每张含验收/校验/依赖/涉及文件。
4. **依赖安装死结破解**：见"已尝试但失败"第一段（safe-delete shim + 代理 + 缓存三连）。
5. **M0.1–M0.3 ✅**：脚手架、云函数、工具层、页面、隐私门禁。**M0 Checkpoint ✅ 已验收**。
6. **M1.1–M1.5 ✅**：社区话题/发帖/点赞/评论/详情、`safety` 内容安全 + 举报拉黑、`invite` 裂变。**M1 Checkpoint ✅ 通过（step 1–6）**，step 7 因分享封禁延后。
7. **M1 期修复**：`auth` 显式存 `openid`（`_openid`→`openid`）；`showShareMenu:fail banned` 定位与规避；`onPostTap` 双触发（自定义事件用了原生名 `tap` + 未声明 `emits` → fallthrough）；拉黑后详情页自动跳回社区；调试日志清理（`338cb5c`，未推送）。
8. **M2.1–M2.4 ✅ 破冰**：`match` 云函数（recommend/accept/myPending/decline）+ `game` 云函数（joinGame/getGame/submitAnswer/cancelGame + `gameQuestions` 首次空集合自动播种 10 题）+ 匹配页 + 游戏房 + 题目卡 + `utils/realtime.js`（watch 优先，跨用户读受限降级轮询）。
9. **M2 缺陷修复 A**：游戏结束双方互相消失 —— `game.submitAnswer` 在 `state→done` 时把 `matches` 翻成 `done` 并落盘 `finishedAt`/`lastTacit`/`lastRounds`。
10. **M2 缺陷修复 B**：契合度不接游戏结果 —— `recommend` 汇总 `status=done` 的 `matches` 的 `lastTacit`，以 `TACIT_WEIGHT=4`/题折算叠加到资料分，排序在叠加后重排；候选卡显示「已玩N局 · 默契M题」。
11. **M2 缺陷修复 C**：匹配页驻留期间收不到新邀请 —— 新增 2.5s 轮询 `match.myPending`（`onShow` 启动，`onHide`/`onUnload` 停止）。
12. **MBTI 资料项（2026-08-29）**：`src/utils/mbti.js`（12 题覆盖 EI/SN/TF/JP 各 3 题 + 16 型角色卡 + `calcMbti()` 平局取 E/S/T/J）+ `src/pages/profile/mbti.vue`（答题 + 进度 + 「正在成型的你」实时预览 + 结果角色卡 + 保存/重测）+ `profile.vue` 的 MBTI 项。复刻自原型站 `https://214e49b7ee1545cc8fa07b3d3da5c21a.app.workbuddy.link/`（「同频 · 恋爱小程序原型」，曾抓取其 `data.js`/`app.js` 提取机制）。
    - **服务端必须同步**：`auth` 的 `sanitizeProfile` 是**严格字段白名单**，已加 `mbti` 校验（16 种合法类型、统一大写，空串/非法值丢弃且**不会误清空**）。**不改则字段被静默丢弃、存不进去。**
    - **隐蔽隐患已修**：`recommend` 的 `.field()` 投影原先不含 `mbti`，不改则对方类型查不出、打分恒为 0。
13. **社区特性开关（2026-08-29）**：`src/utils/config.js` + 首页入口 `v-if`。
14. **拉黑闭环（2026-08-29）**：① 匹配页候选卡「拉黑」按钮（带二次确认，调 `safety.block`，成功后本地移除候选，并修复空状态仍在引导去已隐藏社区的文案）；② `safety` 新增 `listBlocks`/`unblock` + 新建 `pages/settings/settings.vue` + 首页「设置 ›」入口。`listBlocks` 用 `users.where({ openid: _.in(ids) })` 一次 join（2 次查询，非 N+1），显式 `.limit()`，被拉黑者不存在时显示「已注销用户」。
15. **撮合 N+1 优化（2026-08-29）**：`recommend` 原对每个候选各查一次 `matches`（最多 100 次），改为 `aggregateDoneStats` 按批（`AGG_BATCH=20`）一次查完再内存分组，查询次数从 N 降到 `ceil(N/20)`；输出结构不变。
16. **Git 提交**：本轮共 12 个提交（自 `338cb5c` 起），按「功能 / 开关 / 文档 / 性能」原子拆分。工作树干净。
17. **M3 真机佐证 + BUG-1/BUG-2 修复（2026-08-30）**：云端查库佐证 M3 的 8 项验证步骤（结论见 `tasks/verification-log.md`），查出 `chat`→`growth` 跨函数调用丢失 OPENID，导致 8 次有效互聊的成长值全写进 `"<openid>|undefined"` 幽灵 pair、真实关系 0 增长且主流程不报错。按用户拍板的方案①抽出 `cloudfunctions/growth/growth-core.js` 共享内核，`chat`/`game` 改为本进程内直接写 pairs，内核对 `openid` 缺失直接 401 作护栏；顺带修 `pairs.stage` 缓存漂移（stage 一律读时派生）并统一 streak 口径。新增 `npm run sync:core` 防止三份副本漂移。已部署 growth/game/chat/match 四函数并冒烟验证，提交 `9bf1eb8`。
18. **BUG-1 修复真机复验 ✅ PASS（2026-08-30 02:32–02:36）**：账号 `6LrPFY`↔`sJ8Fv8`（此前打了 5 局却无 pairs 的那一对）。新建真实 pair `_id=10b550da6a93260900e36be766f2f7ee`，`pairKey` 无 `undefined`；`growthValue=25` = 游戏 8+streak3 / 游戏 8 / 互聊 2×3，逐笔与北京时间时间戳完全咬合；`lastInteractionAt` 比最后一条消息晚 **79ms**（证明写库由 `chat` 本进程触发）；`weekStreakAdded=3` 只给一次；**未新增任何幽灵 pair**。M3 判定「✅ 正式通过」，M4.1 前置条件已满足。逐笔推导表见 `tasks/verification-log.md` 末尾「BUG-1 / BUG-2 修复复验」章。

---

# 已尝试但失败/放弃的方案

**【关键·必须避免重蹈】npm 安装死结（safe-delete shim 拦截，非网络问题）**
- 根因：WorkBuddy 的 Node 安全删除 shim（经 `NODE_OPTIONS=--require` 注入）拦截所有 fs 删除 API，npm install/reify 需大量删临时文件/旧包 → 全被拦 → `.bin/uni` 缺失、安装失败。
- 旁因：① 系统 npm 缓存 `AppData\Local\npm-cache` 被沙箱拒写（EPERM）；② 全局 `.npmrc` 写死代理 `127.0.0.1:7890` 不可编辑。
- **终极可靠命令（切勿裸装）**：
  ```
  unset CODEBUDDY_SESSION_ID CLAUDE_SESSION_ID
  export PATH="/c/Users/panda/.workbuddy/binaries/node/versions/22.22.2:$PATH"
  cd "D:/Tencent/app"
  env -u CODEBUDDY_SESSION_ID -u CLAUDE_SESSION_ID -u HTTP_PROXY -u HTTPS_PROXY -u http_proxy -u https_proxy \
    npm install --cache "D:/Tencent/app/.npm-cache" --proxy= --https-proxy= --no-audit --no-fund
  ```
  - shim 逻辑：`SESSION_ID = CODEBUDDY_SESSION_ID || CLAUDE_SESSION_ID`，**为空则不拦截**。
  - ⚠️ `dangerouslyDisableSandbox=true` **关不掉** safe-delete（独立层级）。
- **删 node_modules 的正确姿势**：先 `mv node_modules _old_deps`（改名不被拦），再 `rm -rf _old_deps`。

**【关键·用户已否决，勿再提】写死云函数 env + 自动建集合**
- 用户明确回退，已撤销。用户不希望云函数自动建集合、也不希望写死 env，偏好保持 `DYNAMIC_CURRENT_ENV`。
- **【防误判】** 500「集合未创建」的真实根因是**未重新部署旧函数 + 集合未建在正确环境**，并非"写死 env"引起（那两招本是尝试修复它）。看到 500 应优先排查：① 是否重新上传部署了对应云函数；② 集合是否建在函数部署所在环境。

**【已否决】前端持有黑名单并传给后端过滤**
- 详见"当前方案与关键决策·安全类"。客户端可传空数组绕过，防骚扰完全失效。**不要重新提议。**

**【已修正】集合缺失误报**
- 原 `community` 的 catch 正则 `/not exists|does not exist|collection/i` 把**任何含 "collection" 字样的报错**误判成"集合没建"，盖掉真实错误。已收紧为仅匹配 `not exist|does not exist|no such collection` 并透传真实错误消息。

**【已修正】uni-app 自定义组件事件双触发**
- 用原生事件名（`tap`/`click`）做 `$emit` 自定义事件名 + 组件未声明 `emits` → Vue3 把父监听器 fallthrough 到根元素再挂一份原生监听 → 一次点击触发两次。**后续所有自定义组件统一规范：事件名避开原生名、必须声明 `emits`。**

**【无法代码修复】个人/社交类目账号分享封禁**
- 页面定义 `onShareAppMessage` 就会触发基础库内部 `showShareMenu` 被 banned。要么不定义，要么升级为企业主体 + 社交类目。

**【已放弃】产品/技术路线**
- 原生微信小程序框架（改 uni-app）；情侣经营/内购（v1 Out of scope）；你画我猜类高实时游戏（后置）；AI 机器人陪玩冷启动（不依赖假数据）；Snapchat streak 强衰减（采用只增不减）；改用 PostgreSQL 关系表（确认文档库可用后放弃）。

---

# 当前状态

**【2026-08-29 17:30 由新 Agent 重写，旧版内容已作废】**

- **进度位置**：M0 已验收、M1 Checkpoint 通过（step 1–6）、**M2 已收尾并通过 Checkpoint（2026-08-30）**。**M3（升温·导流）代码全部完成并部署；真机跑过两轮（01:21–01:30 首轮、02:32–02:36 复验），云端佐证均已完成 —— BUG-1/BUG-2 已修且复验 PASS，M3 判定「✅ 正式通过」**（详见 `tasks/verification-log.md` 的 M3 章节与末尾「BUG-1/BUG-2 修复复验」章）。
  - M3.0 ✅ 四个集合已建 ｜ M3.1 ✅ 成长累加 + pairs 权威源 ｜ M3.2 ✅ 阶段跃迁 + `growth-bar` ｜ M3.3 ✅ 轻聊（门禁/审核/幂等/成长值落点全对）｜ M3.4 ✅ wechatId + S4 联系方式页 ｜ M3.5 ✅ F7 关系主页（幽灵关系待清理，非代码问题）｜ M3.6 ✅ streak（并入 M3.1）
  - 🔴→✅ **BUG-1（严重 · 已修 · 复验 PASS）**：`chat` 用 `cloud.callFunction` 调 `growth` → **被调用方 `getWXContext().OPENID` 为 `undefined`**（云函数间调用不带端用户身份）→ 8 次互聊成长值全部写进 `"<openid>|undefined"` 幽灵 pair，真实 pair 一分未得。详见「盲区防护」第 19 条。
    - **修法（用户拍板方案①）**：成长规则抽到 `cloudfunctions/growth/growth-core.js`，`game`/`chat`/`match` 各存一份同步副本；`chat`/`game` 改为**本进程内直接写 pairs**，不再跨函数调用。内核对 `openid` 缺失直接 401（护栏，宁可响亮失败也不再造幽灵数据）。新增 `npm run sync:core` 防三份副本漂移。
    - 提交 `9bf1eb8`，已部署 growth/game/chat/match 四函数并冒烟验证（均可加载共享模块；无 openid 的 `addGrowth` 返回 401 且不写库）。
    - **复验（2026-08-30 02:32–02:36，账号 `6LrPFY`↔`sJ8Fv8`）结论 ✅ PASS**：新建真实 pair `_id=10b550da6a93260900e36be766f2f7ee`（`pairKey` **无 `undefined`**），`growthValue=25` = 游戏 8+streak3 / 游戏 8 / 互聊 2×3，**逐笔与时间戳完全咬合**（`lastInteractionAt` 比最后一条消息晚 **79ms**，证明写库由 `chat` 本进程触发）；`weekStreakAdded=3` 只给一次；**未新增任何幽灵 pair**。
    - **剩余动作**：清理 2 条修复前遗留的幽灵 pair（已列 `_id` 待用户点头）。
  - 🟡→✅ **BUG-2（中 · 已修）**：`pairs.stage` 是缓存字段，`game` 直写分支会刷但**不结算 streak**（与 `growth.addGrowth` 口径不一致）；`match.recommend` 读时缓存优先 → 非代码途径改 `growthValue` 会造成「匹配页 S1 / 聊天页 S4」的口径打架。现改为：**`match` 的 stage 一律由 `growthValue` 读时派生**，且 `game` 结束也开始结算 streak（两处口径已统一）。
  - **真机验证步骤见 `tasks/verification-log.md` 的 M3 章节**（8 步）。**前端改动必须先 `npm run dev:mp-weixin` 重新构建 `dist/dev`**，否则 DevTools 仍加载旧包。
  - 新增前端文件：`src/utils/growth.js`、`src/components/growth-bar.vue`、`src/pages/chat/`、`src/pages/contact/`、`src/pages/relation/`。
  - 🟢 **附带收益**：BUG-1 修复后 `ensurePair` 在 `game` 完成/互聊时被调用，**「老关系进不了关系页」的路径已自愈** —— 复验中 `6LrPFY↔sJ8Fv8`（此前打了 5 局却无 pairs）本轮直接建出了真实 pair。存量中「已 done 但此后无任何互动」的老对仍无 pairs，是否需要一次性全量回填仍待 M4 决策（见下表）。
- **已核实完成（不再是阻塞项）**：7 个云函数全部部署且与本地一致；**14 个集合全部存在**（M2 的 10 个 + M3 新增 `pairs`/`messages`/`events`/`metrics`）；M2 主链路双设备真机闭环 PASS。
- **M2 遗留问题已全部关闭**：
  1. ~~双设备真机 Checkpoint 未按规范跑完~~ ✅ V1–V4 全部 PASS（撮合→建局→答题→结束、结束回大厅仍互可见）。
  2. ~~MBTI 与拉黑零数据~~ ✅ MBTI 已落库验证（`woailuo=ESTJ`、`我不爱罗=INFP`）；拉黑/解除闭环已验证。
  3. ~~cancelled 残留~~ ✅ 按方案 B 清理（`matches`/`games` 各 10→2），已云端核验。
- **下一步里程碑**：**先把 M3 真机验证跑完**（详见 `tasks/verification-log.md`），人工评审通过后进入 **M4**。M3 范围与偏差记录见 `tasks/plan-m3.md`（注意：页面实际路径为 `src/pages/relation/relation.vue` 与 `src/pages/contact/contact.vue`，**非**规划草稿里的 `src/pages/growth/`、`src/pages/chat/contact.vue`）。
- **M4 规划已定稿**（`tasks/plan-m4.md`，2026-08-30 三项决策已拍板）：
  1. **看板形态** = `metrics.dashboard` 云函数返回 JSON（MCP/控制台/脚本查看），**不做小程序内看板页、不引入管理员鉴权**。
  2. **入桩时机** = **等 M3 真机验证通过后**再往 `game`/`chat`/`match`/`safety` 插桩（保基线干净、缺陷可归因）。
  3. **只补 SC4 自评入口**（关系主页「我们在一起了」）；**SC5 处置能力留到 M5**，M4 期间 SC5 为数据缺口、需人工终审放行。
  - M4.1 的 13 个事件清单与 SC1–SC5 计算口径（分母定义）见 `tasks/plan-m4.md` §4–§5。
- **M3 新增集合 `pairs` / `messages` / `events` / `metrics` 已建且为空**（2026-08-30 实测）。

---

# 未解决问题

| 优先级 | 问题 |
|--------|------|
| ✅ **【已修·复验 PASS 2026-08-30】** | **BUG-1：云函数间调用丢失 OPENID。** 已按方案①修复：成长规则抽共享内核 `cloudfunctions/growth/growth-core.js`，`game`/`chat`/`match` 各存同步副本；`chat`/`game` 本进程内直接写 pairs；内核对 `openid` 缺失直接 401。提交 `9bf1eb8`，四函数已部署并冒烟通过。**真机复验 ✅ PASS**（`growthValue=25` 逐笔咬合、`lastInteractionAt` 与末条消息相差 79ms、无新增幽灵 pair）。**2 条修复前遗留的幽灵 pair 已于 2026-08-30 02:45 清理完毕，云端核验 `pairs` 只剩 2 条真实关系。此项关闭。** |
| ✅ **【已修】** | **BUG-2：`pairs.stage` 缓存漂移。** `match.recommend` 的 stage 改为一律 `stageOf(growthValue)` 读时派生（同提交 `9bf1eb8`）；`game` 结束现在也结算 streak，与 `growth.addGrowth` 口径统一。全仓已 grep 复核：无任何 `p.stage` 缓存优先读残留，前端 `src/utils/growth.js` 同样是读时派生。 |
| ✅ **【已澄清 2026-08-30 用户确认】** | **数据疑点 2 条 —— 均为用户本人在控制台操作，非 BUG**：① `growthValue=150` 是手动置的（为测 S4 联系方式）；② 缺失的 `games` 文档是手动删的。遗留副作用（数据层，非代码）：真实 pair `bf886e77…` 的 `gameCount=2`/`tacitTotal=8` 统计了一局已不存在的对局；`growthValue` 被手改后缓存 `stage` 仍是旧 `S1`（读路径已派生，功能无影响）。 |
| **【🟡 中·M4 决策】** | **存量老对的全量回填**：`recommend` 的 `getMatchedOpenids` 排除已匹配对象 → 已成 done 的对永不进候选 → `aggregateGrowthStats` 懒回填不触发。但 BUG-1 修复后 `game` 完成/互聊都会 `ensurePair`，**只要双方再互动一次即自愈**（复验中 `6LrPFY↔sJ8Fv8` 已自愈）。仅「已 done 且此后零互动」的老对仍缺 pairs —— M4 需决策是否做一次性全量回填。 |
| **【🟡 低·非阻塞】** | **云函数运行时时区为 UTC**：复验中游戏完成于北京时间 08-30 02:33，但 `lastStreakDay` 记为 `2026-08-29`。`dayOf()`/`isoWeekOf()` 用服务端本地时区，而云函数默认 UTC（02:33 CST = 18:33 UTC 前一天）。**后果**：中国用户在北京时间 08:00 前的活跃被记到前一天，连续两天凌晨活跃可能只拿 1 次 streak。**建议 M4 改为按 `Asia/Shanghai`(+8) 偏移计算。** |
| ~~**【已解决 2026-08-29】**~~ | ~~部署 4 个云函数 + 确认 3 个集合已建~~ —— **实测已全部部署且一致、10 个集合全存在，`community` 也已补部署。此项关闭。** |
| **【高·真机】** | 双设备跑 M2 Checkpoint：A 约 B → B 收到并接受 → 双方答题 5 轮 → 结束回大厅仍互相可见。**重点看回合同步延迟与结束页**。 |
| **【高·真机】** | 验证 MBTI 全链路：资料页 12 题 → 保存 → 重进能回显 → 匹配推荐里契合度分数变化（`users` 至今无一条 `mbti`）。 |
| **【高·真机】** | 验证拉黑闭环：匹配页拉黑 → 设置页黑名单可见 → 解除 → 对方不再被过滤（`blocks` 至今 0 条）。 |
| **【高·上线前置】** | 账号主体（个人/企业）与社交类目资质。本产品是社交/婚恋类，微信对个人主体通常无法授予社交类目，`msgSecCheck` 也通常需企业主体。【推测】当前仍是个人主体（从未在公众平台核实）。卡"上线"不卡"开发"。 |
| **【中·性能】** | 复合索引：为 `comments` 建 `{ postId:1, auditStatus:1, createdAt:1 }`、为 `posts` 建 `{ auditStatus:1, topicId:1, createdAt:1 }`。只能控制台建，代码无法自动建。 |
| **【中】** | 内容安全云调用权限未开通（个人账号），当前用本地兜底；企业资质就绪后切 `USE_WX_SECURITY=true`。 |
| **【中】** | 隐私政策正式文案与备案（M0 已有隐私页门禁，正式文案待补）。 |
| **【低·死代码】** | `src/utils/invite.js` 自裂变入口移除后**全仓无任何 import**，实为死代码。**删除前需用户确认**，不要擅自删。 |
| **【低·结构性重复】** | `getBlockedIds` 在 `community/index.js` 与 `match/index.js` 各有一份相同实现（云函数独立部署所致，暂接受）。 |
| **【低·数据】** | `users` 可能残留无 `openid` 的历史孤儿文档（在 `_openid→openid` 修复前旧部署登录产生），建议控制台手动清理。 |
| **【低·本地残留】** | `_rm_oldbd/`：早期损坏 `node_modules` 改名副本（约 29M，已 gitignore，safe-delete 删不掉，非阻塞，用户本机可手动清）。 |
| **【低】** | 成长阈值 12/40/90/150 为初值，上线后 F9 校准（M4.3），当前无需动。 |

---

# 待确认事项

**【2026-08-30 02:40 · 复验后更新，最优先】**
- ✅ **BUG-1 修法 = ①抽共享模块**，已于 `9bf1eb8` 实施，**真机复验 ✅ PASS**（2026-08-30 02:32–02:36，`6LrPFY`↔`sJ8Fv8`）。核对三件事全部通过：① 真实 pair `growthValue=25` = 游戏 8+streak3 / 游戏 8 / 互聊 2×3，逐笔咬合；② `lastInteractionAt` 晚于最后一条消息 79ms；③ **未新增任何 `|undefined` 幽灵 pair**。
- ✅ **数据疑点已澄清**：`growthValue=150` 与缺失的 `games` 文档**均为你本人在控制台操作**，非代码 BUG。
- ✅ **幽灵 pair 已清理**（2026-08-30 02:45，用户确认后删除）：`37138adf6a93166c00c8ca0e7fa2172d`、`37138adf6a93169200c8cac7230d182e`。**清理后云端核验：`pairs` 只剩 2 条真实关系**（`6LrPFY↔sJ8Fv8` gv25 / `6LrPFY↔Z` gv150）。两者原是 BUG-1 期间跨函数调用的产物，修复后已不可能再生。
- 🟡 **顺带记一笔（M4 再说）**：云函数运行时是 UTC，`lastStreakDay` 会比北京时间慢一天（详见上表低优先级项）。
- ▶️ **M4.1 可以开工**：`plan-m4.md` 决策 2 的前置条件（M3 真机验证通过）**已满足** —— 13 个事件插桩随时可开。

- **是否要推送本地 13 个提交**：需先 `git fetch` 修复无上游追踪引用的问题，再 push（**绝不 force**）。其中 `338cb5c` 用户曾决定不推送，若要推送需重新确认。
- **【本轮新增，待用户拍板】**：下一步做什么？三选一 —— ① **跑真机验证**（双设备 M2 Checkpoint + MBTI + 拉黑，Agent 出步骤清单、用户执行）；② **直接开工 M3**（关系成长 `growth` + `chat` + 关系主页，需先建 `pairs`/`messages`/`events`/`metrics` 集合）；③ **先修小项**（MBTI 未答题显示 ESTJ 的 UX 问题、`mbtiFit` 未渲染、`FEATURES` 进 `data()` 等 4 个已列出未改的小项）。
- **是否删除死代码 `src/utils/invite.js`**（需用户点头）。
- **MBTI 测评页的一个 UX 细节**（审查发现，未改）：未答任何题时 `calcMbti([])` 会返回 `ESTJ` 并显示在「正在成型的你」，有误导。建议加 `v-if="idx > 0"`。
- **其他审查发现的小项（均未改）**：`match` 返回的 `mbtiFit` 前端未渲染（冗余载荷）；`index.vue` 把 `FEATURES` 模块对象直接放进 `data()`（被 Vue 响应式代理，建议改 computed）；`mbti.vue` 的 `role: getRole('INFP')` 魔法默认值。
- 小程序账号个人/企业、是否具备社交类目资质？内容安全云调用权限是否就绪？隐私政策文案进度？

---

# 关键资料

- **Spec（事实来源）**：`D:\Tencent\app\spec\SPEC.md`（v1.0）
- **Plan（已批准）**：`D:\Tencent\app\tasks\plan.md`
- **Tasks（20 卡）**：`D:\Tencent\app\tasks\todo.md`
- **项目记忆**：`D:\Tencent\app\.workbuddy\memory\` 下 `2026-08-26/27/28/29.md`（按日，含各轮踩坑细节）
- **原型参考站（MBTI 机制来源）**：`https://214e49b7ee1545cc8fa07b3d3da5c21a.app.workbuddy.link/`（「同频 · 恋爱小程序原型」，其 `data.js`/`app.js` 可直接 curl 抓取查看）
- **N+1 聚合逻辑的测试脚本**：`C:\Users\panda\AppData\Local\Temp\agg-test.js`（提取云函数实际代码 + mock db，7 条用例；若系统临时目录已清理可照此重写）
- **appid**：`wx900385d98d023d6f`
- **CloudBase envId**：`love-app-server-d2fhg32320d65c12`
- **远程仓库**：`git@github.com:Tea-Codeman/love_app.git`（SSH，分支 `main`）
- **管理版 Node**：`C:\Users\panda\.workbuddy\binaries\node\versions\22.22.2\node.exe`
- **原生骨架归档**：`D:\Tencent\app\legacy/`
- **`project.config.json`**：`miniprogramRoot = "dist/dev/mp-weixin/"`；`cloudfunctionRoot = "cloudfunctions/"`
- **本地 HEAD**：`a6ecc0b`；**远端 `main`**：`97df138`（本地领先 13 提交）
- **CloudBase 环境实况（2026-08-29 实测）**：`love-app-server-d2fhg32320d65c12`，个人版，ap-shanghai，`RuntimeMode=nosql`（**无 PG、无 MySQL**），到期 2027-02-26，绑定小程序 `wx900385d98d023d6f`
- **云端核实方式（Agent 可自助，无需 GUI）**：CloudBase MCP 工具 —— `queryEnv`/`queryFunctions`/`manageFunctions`(含 invokeFunction、updateFunctionCode)/`readNoSqlDatabaseStructure`/`readNoSqlDatabaseContent`/`queryLogs`。注意 `queryFunctions(action=listFunctionLogs)` **已废弃报错**，查日志必须用 `queryLogs(action=searchLogs)`。

---

# 我的偏好与工作方式

- **决策风格**：先澄清需求、再逐里程碑签字放行；重视"为什么"而不仅是"是什么"；不喜"为看起来完整"而加无关信息。
- **流程偏好**：需求未明确前禁止实现；Spec/Plan 是活文档，改动前先更新。
- **沟通**：中文；高密度、去冗余；直接给结论与下一步，不绕弯。
- **Git**：用户重视"提交作为回滚锚点"，倾向**按关注点拆成多个原子提交**（如「功能代码 / 功能开关 / 文档 / 性能」分开），而非一个大提交。
- **Agent 协作**：希望 Agent 先读已有 Spec/Plan/Tasks 再动手；遇到环境坑要定位根因并固化记录，而非反复试错；**希望 Agent 在发现方案有问题时直接反对并说明理由**（曾明确认可对"前端传黑名单"方案的否决）。
- **已确认的禁忌**：不用裸 `npm install`；不 `rm -rf node_modules`/`npm config set`；不写死 env / 不提议自动建集合；不擅自重加 `onShareAppMessage`/邀请入口；不擅自删除疑似死代码（先问）。

---

# 盲区防护与易错避坑（针对缺失信息自查）

> 假设你完全看不到原始聊天记录，以下是最容易误判/漏看/重复踩坑的地方。

**A. 启动与环境**
1. **`node_modules` 与 `dist` 均被 gitignore**，clone 后都不存在。首次必须跑"已尝试但失败"第一段的可靠 npm 命令；跑完再 `npm run dev:mp-weixin` 生成 `dist/dev/mp-weixin`。
2. **DevTools 只读 `dist/dev/mp-weixin`**（`project.config.json` 的 `miniprogramRoot`）。改完源码跑 `dev:mp-weixin` 即可 HMR 自动刷新，**不要"重导 dist/build"**。`build:mp-weixin` 只做编译验证与生产打包，当前配置不加载它。
3. 微信开发者工具导入时目录选**仓库根目录 `D:\Tencent\app`**，不要手动指到 dist 子目录，否则与 `miniprogramRoot` 冲突。

**B. 云函数与集合**
4. **「代码改了但没部署」是本项目最常见的假 bug**，但**不要凭 ModTime 猜**。可靠核实法：下载云端代码 zip（`getFunctionDownloadUrl`）→ 解压取 `index.js` → **归一化换行符后**（云端 CRLF、本地 LF，直接 diff 会误报整文件不同）与本地比对。2026-08-29 已用此法确认 7 个函数全一致。
   - 部署方式：既可 DevTools 右键「上传并部署：云端安装依赖」，也可 Agent 用 `manageFunctions(action=updateFunctionCode, functionRootPath="D:/Tencent/app/cloudfunctions", func={name, isWaitInstall:true})` 直接部署（已验证可用）。**不要选本地安装依赖**，本地 npm 会被 safe-delete 卡死。
5. **云函数用 `DYNAMIC_CURRENT_ENV`**，所以部署环境必须 = `love-app-server-d2fhg32320d65c12`，否则读不到控制台建的集合，报"集合未创建"。
6. 集合必须**手动**在控制台建，代码不自动建（用户已否决）。
7. `safety` 必须先于 `community` 部署（后者会调用前者）。**【2026-08-30 更正】现在存在 3 条跨函数调用**：`community`→`safety`、`chat`→`safety`、`chat`→`growth`。改动 `safety`/`growth` 的**入参或返回结构**时，必须同步检查所有调用方。
19. **🔴 云函数 A 用 `cloud.callFunction` 调 B 时，B 里的 `cloud.getWXContext().OPENID` 是 `undefined`** —— 端到端用户身份**不会自动透传**（M3 真机佐证实测坐实，见 `verification-log.md` M3 章）。
   - **症状**：被调用方用 `undefined` 拼业务主键 → 生成 `"<真实id>|undefined"` 这类**幽灵文档**，数据看起来"写了"其实全写错对象，且**主流程不报错**（`addGrowth` 返回 true）。极难从前端表现发现。
   - **自查方法**：查库看主键里有没有 `undefined` 字面量；比对文档的 `updatedAt` 是否早于触发时间（若早于，说明该路径根本没写进来）。
   - **修法**：① 抽共享模块给调用方 `require`，直接在本函数内写库（推荐）；② 显式传 `openid` + 内部令牌鉴权；③ 不要指望 `getWXContext()` 能拿到端用户。
   - ⚠️ 同样的坑适用于任何"被调用方需要知道是谁"的跨函数场景。
   - ✅ **本项目已按①落地**（2026-08-30，提交 `9bf1eb8`）：`cloudfunctions/growth/growth-core.js` 是唯一源头，`game`/`chat`/`match` 各存一份同步副本 —— 云函数独立打包无法跨目录 `require`，改完内核**必须跑 `npm run sync:core`** 再重新部署，否则副本还是旧的。
   - ✅ **复验已 PASS**（2026-08-30 02:32–02:36）。**判定"修复真的生效"的关键证据不是"不报错"，而是两条时间戳咬合**：`pairs.lastInteractionAt` 必须紧跟最后一条 `messages.createdAt`（实测 +79ms），且 `pairKey` 里没有 `undefined`。
20. **🟡 云函数运行时时区是 UTC，不是北京时间**（2026-08-30 复验实测坐实）。
   - **症状**：用 `new Date().getFullYear()/getMonth()/getDate()` 算"今天"（本项目 `dayOf()`/`isoWeekOf()`），拿到的是 **UTC 日期**。北京时间 08:00 之前的活跃会被算到**前一天**。
   - **实测**：游戏完成于北京时间 2026-08-30 02:33，`pairs.lastStreakDay` 记为 `2026-08-29`。
   - **后果**：中国用户凌晨活跃会"跨错日"；连续两天凌晨互动可能只拿到 1 次 streak（第二次因 `lastStreakDay` 同日而被跳过）。
   - **修法（M4 待办）**：`dayOf`/`isoWeekOf` 先做 +8 小时偏移再取日期部分（`new Date(ts + 8*3600*1000)` 后用 `getUTC*`），或直接读 `TZ=Asia/Shanghai` 环境变量（需先在控制台给函数配 `TZ`）。

**C. 代码结构暗坑**
8. **`auth` 的 `sanitizeProfile` 是严格字段白名单**——新增任何用户资料字段，必须同时改这里，否则前端写入被静默丢弃。这是 MBTI 功能最容易漏的一步。
9. **`recommend` 的 `.field()` 投影要包含新字段**——否则查询结果的字段是 undefined，打分恒为 0（MBTI 已踩过此坑）。
10. **从子页 `navigateBack` 返回时 `onLoad` 不会重跑**，需要刷新数据要用 `onShow`（MBTI 回填即如此处理；但不要整体回填，会覆盖用户未保存的编辑）。
11. **自定义组件事件名必须避开原生名（`tap`/`click`）且必须声明 `emits`**，否则一次点击触发两次。
12. **个人账号下不要定义 `onShareAppMessage`**，会触发内部 `showShareMenu` 被 banned，且代码改不掉。
13. **`npm run build:mp-weixin` 偶发卡住**（与常驻的 `dev` watcher 争用 `dist`，表现为 3–11 分钟无输出，而正常仅需 ~12 秒）。识别与处理：用 `TaskStop` 停掉该后台任务后重跑即可完成；不要误判为编译失败。**改完源码优先看 `dist/dev` 产物**（watcher 会自动重编译），build 仅作最终验证。

**D. 调试误判**
14. **"一打开就显示已登录"不是 bug**：应用没有静默登录，`openid` 只在点击授权登录时写入；但 DevTools 模拟器的 Storage 不随重新编译清空。清 `rg_openid`/`rg_user`/`rg_privacy_agreed`（或 `uni.clearStorageSync()`）即可重走流程。
15. 看到 500「集合未创建」，先查"是否重部署了函数"与"集合是否建在正确环境"，**不要因此误判写死 env 有害**。
16. **查日志别用 `listFunctionLogs`**（底层接口已下线，会直接报"getFunctionLogsV2 已废弃"）。改用 `queryLogs(action=searchLogs, service="tcb", queryString='(src:app OR src:system) AND log:"关键字"')`。**注意返回可能几十万字符被截断存文件**，需写脚本解析 `Results[].Content`（是嵌套 JSON 字符串，要二次 `json.loads`）再取 `ret_msg`。

**E. 文档与现实的落差**
17. **决策写进文档 ≠ 代码已实现 ≠ 已部署到云端**。曾出现"用户以为社区开关已配置，实际只有 HANDOFF 里的决策记录"；2026-08-29 又发现**反向错误**：HANDOFF 写"4 个函数未部署、3 个集合未建、从未真机验证"，实测**全部已部署已建成且跑通过**。**接手时两条都要核实**：文档说做了的事可能没做，文档说没做的事可能早做了。
18. 旧版 HANDOFF 提到的工作树残留文件 `PRECONTEXT.md`/`CONRRENTCONTEXT.md`/`SKILL.md` **现已全部不存在**，勿再当作待办。

---

# 新 Agent 接手指南

> **2026-08-29 17:30 重写**：旧版第 1 条（"先让用户部署 4 个函数、确认 3 个集合"）**已被实测证伪并作废**——函数全部署、集合全存在、M2 云端跑通过。

1. **当前最重要的问题**：**部署不再是瓶颈**。真正没做的是「真机验证」与「M3 决策」。三件待办按优先级：
   - **① 双设备真机 Checkpoint**（M2 主链路 + 回合同步 + 结束页）—— 需用户两部手机/两个微信号，Agent 出步骤清单。
   - **② MBTI 与拉黑闭环验证** —— 这两项今天才合入，**数据库零数据**（`users` 无 `mbti`、`blocks` 0 条），代码没被真正跑过。
   - **③ M3 是否开工** —— 等用户发话。
2. **从哪一步继续**：
   - 若用户说"验证" → 给精确 Checkpoint 步骤（见"未解决问题"三条真机项）；Agent 可**同步在云端查数据佐证**（如验证完立刻查 `users.mbti` 是否落库、`blocks` 是否有新记录），不用等用户截图。
   - 若用户说"推进 M3" → 先读 `tasks/todo.md` 的 M3 卡，遵守"默契度系统以 `pairs` 为权威源、M2 聚合作回填"的既定决策；**开工前先让用户建 `pairs`/`messages`/`events`/`metrics` 四个集合**（M3 必需，代码不自动建）。
   - 若用户报 bug → **先核实云端代码是否与本地一致**（下载 zip diff），再查代码逻辑；不要默认"没部署"。
3. **不要重复**：不重跑需求澄清/Plan/Tasks；不用裸 `npm install`；不写死 env / 不提议自动建集合；不重新提议"前端传黑名单给后端过滤"；不擅自重加 `onShareAppMessage`/邀请入口；不擅自删 `src/utils/invite.js`；**不擅自删云端测试数据**（3 局 cancelled 需用户决定）。
4. **隐含约束（极易漏）**：云函数部署环境必须 = `love-app-server-d2fhg32320d65c12`；M3+ 的新集合仍需手动建在该环境；DevTools 加载 `dist/dev`；**本环境是纯 NoSQL，别提 PG/RLS/MySQL**。
5. **信息不足时优先问**：① 下一步做验证、开工 M3、还是先修 4 个小项？② 要推送本地 13 个提交吗（需先 `git fetch` 修远端引用）？③ 是否删除 `src/utils/invite.js` 死代码？④ 是否清理云端 3 局 cancelled 测试数据？⑤ 账号主体（个人/企业）与社交类目资质现状？
6. **动手前必读**：`spec/SPEC.md` → `tasks/plan.md` → `tasks/todo.md` → 本文件的「盲区防护与易错避坑」与「已尝试但失败/放弃的方案」→ `.workbuddy/memory/` 最近几天的项目记忆。

---

# 极简版

- **做什么**：微信小程序「恋爱成长型社交」v1（单身主链路：社区→游戏破冰→关系升温→加微信导流）。uni-app(Vue3)→mp-weixin + CloudBase（PG 内核，文档库可用）；弱实时；成长 5 阶段 S0–S4（阈值 12/40/90/150，只增不减）。
- **现状**：M0 已验收、M1 Checkpoint 通过（step 1–6，step 7 裂变因个人账号禁分享延后）、**M2 破冰代码完成并提交**；本轮另完成 MBTI 资料项、社区特性开关、拉黑闭环、撮合 N+1 优化。**工作树干净，本地 HEAD = `1206d46`，远端 `main` = `97df138`，本地领先 12 提交未推送。**
- **【2026-08-29 实测更正】瓶颈不是部署**：7 个云函数**全部已部署且与本地逐字节一致**（`community` 本轮补部署）；10 个集合**全部已建**；M2 主链路**云端已跑通过完整一局到 `done`**。真正的缺口是：**双设备真机 Checkpoint 未规范跑完、MBTI 与拉黑零数据未验证、M3 未开工**。
- **三条硬性原则**：
  1. `auth` 的 `sanitizeProfile` 是**严格白名单**——加任何用户资料字段必须同步改它，否则静默丢弃。
  2. **拉黑过滤只能服务端执行**（前端传参可被空数组绕过，防骚扰失效）；`unblock` 必须 `where({ blockerId: OPENID, blockedId })` 限定。
  3. `recommend` 的 `.field()` 投影要包含新字段，否则查询结果 undefined、打分恒为 0。
- **必避坑**：① npm 卡死 = safe-delete 拦删除，`unset CODEBUDDY_SESSION_ID CLAUDE_SESSION_ID` 解（切勿裸装，用"已尝试"里的完整命令）；② DevTools 只读 `dist/dev/mp-weixin`（`miniprogramRoot`），改完跑 `npm run dev:mp-weixin`；③ 云函数部署环境必须 = `love-app-server-d2fhg32320d65c12`；④ `build:mp-weixin` 偶发卡 3–11 分钟（与 dev watcher 争用，正常 12 秒），停掉重跑即可，别误判失败；⑤ 自定义组件事件名避开 `tap/click` 且必须声明 `emits`；⑥ 个人账号别定义 `onShareAppMessage`（内部 showShareMenu 被 banned）；⑦ 子页 `navigateBack` 后 `onLoad` 不重跑，刷数据用 `onShow`；⑧ "一开就显示已登录"是模拟器 Storage 未清（非 bug）；⑨ **查云端代码必须归一化换行符再 diff**（云端 CRLF / 本地 LF，否则误报全文件不同）；⑩ **查日志用 `queryLogs` 不用 `listFunctionLogs`**（后者已废弃）。
- **Agent 可自助的云端操作**（无需用户点 GUI）：查环境/函数/集合/数据/日志，部署函数，调用函数冒烟测试。已验证可行。
- **不要主动提议**：写死 env、自动建集合（用户已否决）；前端传黑名单给后端过滤（已否决）；重加 `onShareAppMessage`/邀请入口；擅自删 `src/utils/invite.js`（死代码，待用户确认）。
- **下一步 M3**：关系成长 `growth` + 轻聊/导流 `chat` + 关系主页 F7；默契度系统以 **`pairs`** 集合为权威累计源（每对用户一条，O(1) 读取），M2 的「聚合 done matches」仅作历史回填——**不必推翻 M2 代码，做 M3 时平移即可**。
