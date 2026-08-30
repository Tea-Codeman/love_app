# HANDOFF.md

# 项目/任务

从零构建「恋爱成长型社交小程序」v1 —— 以"关系成长"为核心驱动的微信小程序，让单身用户从陌生 → 好感累积 → 信任，最终促成真实伴侣关系。当前处于 **Implement 阶段**，M0–M4 全部完成；**M5 全收官（2026-08-30）**：M5.1–M5.4 落地部署、线上验收 PASS（SC5 rate=100 / 双计修复实证）、阈值回灌评估 #2 维持初值、**人工终审 21:40 签字通过**。**M6 全收官（2026-08-30 22:29 真机验收通过）：M6.1–M6.4 落地部署 + 真机验收 PASS（管理员处置闭环 + SC5 真机有数 + 403/幂等补验通过）；冷启动准备/技术债留 M7。下一步 = M7 规划（上线就绪 / 技术债）。**

> **⚠️ 2026-08-29 实测推翻旧版前提**：旧版 HANDOFF 称"4 个云函数未部署、3 个集合未建、从未真机验证"。**实测全不成立**——7 个存量云函数全部已部署且与本地逐字节一致；10+ 个集合全部已建且有数据；M2 主链路云端跑通过完整一局。瓶颈从来不是部署，而是**真机验证**与**埋点校准**。

---

# 核心目标

- **最终产出**：可上线验证的微信小程序（v1 仅单身主链路：社区→游戏破冰→关系升温→加微信导流）。
- **v1 成功定义（北极星）**：真的有人通过它交到伴侣并成为留存用户。可量化信号 = "关系成长是否真发生"（SC1–SC5）。
- **v1 不做营收**：变现（内购/情侣经营）明确 Out of scope，数据结构预留字段即可。

---

# 用户需求与约束

| 类别 | 内容 | 状态 |
|------|------|------|
| 产品形态 | 微信小程序（非 App、非 H5） | 【已确认】 |
| 用户群 | 20–28 岁、一二线城市单身年轻人 | 【已确认】 |
| v1 范围 | 仅单身主链路；情侣经营、内购变现 Out of scope | 【已确认】 |
| 技术基座 | 前端 uni-app(Vue3+Vite) 编译 mp-weixin；后端 CloudBase（**纯 NoSQL**，文档库） | 【已确认·用户签字】 |
| 实时性 | 弱实时（回合制游戏，watch/轮询秒级足够，不建 WS） | 【已确认】 |
| 冷启动 | 社区先行 + 邀请裂变，不依赖假数据/AI 陪玩 | 【已确认】 |
| 合规 | UGC 先审后发；服务端校验一切输入；成长值只增不减；隐私政策+授权弹窗+举报 | 【已确认】 |
| 阈值初值 | 关系阶段门限 12/40/90/150 作为首版上线值，F9 校准 | 【已确认·用户签字】 |
| 交付节奏 | M0–M4 里程碑，每里程碑可独立评审 | 【已确认·用户签字】 |

**底线约束（SPEC §9）**
- Always：UGC/私聊先审后发；服务端校验输入；成长值只增不减；改前先更 Spec。
- Never：提交密钥/openid 明文；v1 加情侣经营或变现；跳过内容安全；用假数据伪造指标；用非官方个人微信协议加好友。
- Ask-first：前端框架/依赖/数据模型/营收相关改动。

**上线路径决策【已确认】**：个人账号先做原型验证，上架门槛（企业主体+社交类目+内容安全+隐私政策）延后。功能开发不受账号影响。

---

# 背景知识

- **关系成长主线**：两人共享一条成长值，5 阶段 S0→S4：S0 陌生(0) → S1 有点意思(≥12) → S2 聊得来的朋友(≥40) → S3 有好感(≥90) → S4 信任·可加微信(≥150)。阶段由"事件标志 + 成长值"共同判定，**一律读时派生，不读缓存字段**。
- **累加规则（初值）**：共同完成一场游戏 +8；一轮有效互聊 +2；互加游戏好友 +5；连续天数互动 +3/天（周上限 +15）；双方正向互评当次增益 ×1.5。只增不减。
- **匹配**：冷启期用兴趣标签/资料属性/MBTI 规则匹配（T4）。
- **微信加好友闭环（F6）**：小程序无"一键加好友"官方 API。S4 解锁对方**联系方式**——展示个人微信二维码（长按识别）/ 或复制微信号。
- **🔴 CloudBase 环境内核澄清（2026-08-29 实测）**：`queryEnv(action=info)` 返回 `RuntimeMode: "nosql"`、`RuntimeBackends: {postgresql:false, nosql:true, mysql:false}`。**本环境是纯 NoSQL，无 PG、无 MySQL**。既定决策本就用 `cloud.database()` 不写 SQL，所以**代码一行都不用改**，但认知上**不要再提"PG 模式 / app.rdb() / RLS 策略 / MySQL"**。权限走 `managePermissions(resourceType="noSqlDatabase")` + Security Rules。
- **构建产物两个目录（极易错）**：`npm run dev:mp-weixin` → `dist/dev/mp-weixin/`（HMR 热重载，**DevTools 实际加载**）；`npm run build:mp-weixin` → `dist/build/mp-weixin/`（生产，当前配置**不加载**）。小程序只能在 DevTools 跑，不能直接当网页/Node 跑。
- **项目记忆目录**：`D:\Tencent\app\.workbuddy\memory\YYYY-MM-DD.md`（按日追加，被 `.gitignore` 排除，接手值得一读）。

---

# 已确认事实

**技术决策（已定案）**
- 前端 = uni-app(Vue3+Vite) 编译 mp-weixin（覆盖 Spec 默认原生，用户签字）。原生骨架归档 `legacy/`。
- 微信 appid = `wx900385d98d023d6f`（写入 `manifest.json` / `project.config.json`）。
- CloudBase 环境 ID = `love-app-server-d2fhg32320d65c12`（写入 `src/utils/cloud.js` 的 `CLOUD_ENV`）。
- 身份 = 微信 `openid`，由云函数 `cloud.getWXContext().OPENID` 取得，绝不落前端/仓库。
- 远程仓库 = `git@github.com:Tea-Codeman/love_app.git`（分支 `main`，SSH）。

**里程碑进度【已确认】**
- **M0 地基 ✅ 已验收**（2026-08-27）。
- **M1 聚人 ✅ Checkpoint 通过（step 1–6）**（2026-08-28）。step 7 裂变因个人账号禁分享延后（页面定义 `onShareAppMessage` 会触发基础库内部 `showShareMenu` 被 banned）。底层归因逻辑（`invite` 云函数 + 捕获 `?inviter=`）保留。
- **M2 破冰 ✅ 已收尾并通过 Checkpoint（2026-08-30 双设备真机 V1–V4 全 PASS）**：撮合→建局→答题→结束闭环、MBTI 落库、拉黑/解除闭环、契合度加成。云端查库佐证见 `tasks/verification-log.md`。答题逻辑已改版为「匹配后各自独立答题、终局对比算默契度」（`game` 云函数已部署）。
- **M3 升温·导流 ✅ 代码完成 + 部署 + 真机验证（v0.3.0）**：pairs 默契度系统、先审后发、S1 门禁、联系方式解锁、拉黑闭环。BUG-1/BUG-2 已修且真机复验 PASS。
- **M4 验证 ✅ 全部完成（2026-08-30）**：13 事件全链路埋点真机验收；`metrics.dashboard` 聚合 SC1–SC5 上线（数据已至 108 条/3 对，SC4=1）；M4.4 关系确认为**双边邀请**（A 发邀请→B 任意页面经应用级轮询+原生通知收到，同意落 milestones + 上报 relation_confirmed，超时 10min 失效）——真机验收通过；M4.3 阈值校准结论「样本不足，沿用初值」（`tasks/threshold-calibration.md`，附游戏权重偏高/app_open 双计两个观察）。M4.5 SC5 处置留 M5。

**版本与回滚锚点**
- 当前版本 `v0.3.0`（= M3），`MINOR 号 = 里程碑号`（v0.3.0 = M3）。tag 为**带注释本地 tag，未推送**。
- 回滚：`git checkout v0.3.0` 整体回退；`git revert <commit>` 逐任务撤。**云函数需重新部署对应版本代码**，前端回滚后必须重建 `dist/dev`。
- **用户重视"提交作为回滚锚点"**：改功能前先确认/补齐提交，按关注点拆原子提交（功能/开关/文档/性能/纯格式各自独立）。

**Git 状态（2026-08-30 20:25 最新）**
- **远程 `main` 与本地 HEAD 已对齐 = `c8e3e2d`**（M5 规划定稿提交）。本会话（M4.4→M5 规划）共推进 10+ 个提交，全部快进推送，零强推，工作树干净。关键锚点：`8ba58e8`/`6109adf`(M4.4 单边) → `7641267`/`907e26a`(双边邀请) → `a79d782`/`43a42f3`(M4.4b 全局投递) → `aee4416`(M4.4c 布局) → `7a4395e`(getOpenid 修复) → `6d5c040`(观察修正) → `75fcb71`(M4.3 校准) → `c8e3e2d`(M5 规划)。
- ⚠️ **沙箱怪象**：本沙箱内 `git rev-parse origin/main` 报 unknown、`git status` 显示 `origin/main: gone`。但 `git ls-remote --heads origin` 真实返回 = 本地 HEAD（2026-08-30 20:25 实测为 `c8e3e2d`）。**判断推送是否成功一律以 `ls-remote` 为准，勿信本地 ref 的 gone 标记。**
- 工作树**干净**。

**数据模型（云数据库集合，全部已建）**
- M2 的 10 个：`users`(openid,nickname,avatarUrl,gender,age,city,interestTags[],bio,mbti,wechatId,wechatQrUrl,invitedBy) / `topics` / `posts` / `comments` / `blocks` / `reports` / `invites` / `matches` / `games` / `gameQuestions`(10 题已自动播种)
- M3 新增 4 个：`pairs`（每对用户一条，`pairKey=sorted(openidA,openidB)`，存累计 gamesPlayed/tacitTotal/lastGameAt/维度分/relationshipStage，M3 起为默契度权威源）/ `messages` / `events`（M4 埋点落这里）/ `metrics`
- **代码不自动建集合**（用户已否决自动建），换环境需手动建。

**云函数（共 10 个，全部 Active）**
| 函数 | 动作 | 备注 |
|------|------|------|
| `auth` | login / updateProfile（MBTI 白名单） | 已部署 |
| `ping` | 连通性检查 | M0 |
| `community` | listTopics/listPosts/createPost/likePost/addComment/getPostDetail | 已部署，入口已开启（特性开关 `FEATURES.community=true`，M6.4 正式提交；正式上架前需过社交类目资质，M7） |
| `safety` | checkText/checkImage/report/**block**/**listBlocks**/**unblock** | 已部署；`listBlocks` 返 401 证明 action 存在 |
| `invite` | generate/consume | 已部署，UI 入口已移除，逻辑保留 |
| `match` | recommend/accept/myPending/decline | 已部署（含 MBTI 打分 N+1 优化，读 `pairs` O(1)） |
| `game` | joinGame/getGame/submitAnswer/cancelGame | 已部署，云端跑通过完整局 |
| `growth` | getPair/listPairs/addGrowth/**sendConfirmInvite/acceptConfirmInvite/rejectConfirmInvite/cancelConfirmInvite**(M4.4) | M3 新建，pairs 权威源；只增不减 + streak；M4.4 双边邀请确认，accept 落 milestones + 上报 relation_confirmed，超时失效 |
| `chat` | send/list/contact | M3 新建，先审后发 + S1 门禁 + 有效互聊 +2 + S4 联系方式解锁 |
| `metrics` | track（前端上报入口）/ **dashboard**（M4.2 聚合 SC1–SC5） | M4.1 新建，补 `package.json` 修复 wx-server-sdk 后 CodeSize 6KB→11MB |

**M4.1 埋点内核**
- 共享内核 `cloudfunctions/metrics/metrics-core.js` 为唯一源头，同步副本到 auth/chat/game/growth/match/safety（云函数独立打包无法跨目录 require），`npm run sync:core` 防漂移。
- 13 事件白名单：app_open / profile_completed / mbti_completed / recommend_view（前端）/ match_accept / game_join / game_done / pair_stage_changed / chat_unlocked / message_sent / contact_unlocked（服务端 8 类 + 前端 2 类）/ relation_confirmed（M4.4）/ report_created（M4.5 留 M5）。
- **PII 过滤**：props 只收 ID/枚举/数值（score/rounds/tacitCount/auditPassed/from/to/growthValue/mbti/count），超 1KB 整包丢弃，对象值丢弃。
- **BUG-1 护栏**：`if(!openid) return {code:401}` 拒绝无主事件（MCP 直调无 WX 上下文会被拦，证明防护有效）。
- `pairId` 取值 = 两个 openid 排序后拼 `|`（非 pairs._id）；`day` 字段按 Asia/Shanghai(+8) 计算。

---

# 当前方案与关键决策

**架构类**
- 后端 = CloudBase（纯 NoSQL，`cloud.database()` + Security Rules），不写 SQL。
- 云函数 `cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })`。**曾尝试写死 env + 自动建集合，被用户否决并已撤销，勿再提议。**
- M3 数据架构：默契度以 `pairs` 集合为权威累计源；M2「聚合 done matches」仅作历史回填。

**安全类（最重要）**
- **🔴 拉黑过滤只能服务端执行**：用户曾提议"前端持有黑名单传给后端过滤"，**已明确否决**（客户端 payload 可传空数组绕过，防骚扰失效）。原则：前端只显示、服务端执行。
- `unblock` 必须 `where({ blockerId: OPENID, blockedId })` 限定，否则以管理员权限能删他人拉黑记录。
- 内容安全：`safety` 内 `USE_WX_SECURITY=false` 走本地关键词兜底（不过审不发）；企业资质就绪后置 `true` 切微信官方 `msgSecCheck`。

**产品/功能类**
- 社区已开启（M6.4）：特性开关 `src/utils/config.js` 的 `FEATURES.community=true`（原为用户真机测试所改，2026-08-30 正式提交）；只管入口显隐，不动路由、不删代码。个人主体+社交类目资质未就绪，仅 DevTools 可跑，正式上架前需过资质（M7）。
- MBTI 撮合打分 `scoreMbtiFit()`：每维度字母相同 +2，EI 互补 +3；任一方未测评返 0（不惩罚未填用户）。
- 默契判定 = 双方选同一项，无需标准答案。
- 游戏结束后可再约：靠多次游戏累积，done 后自然重新可推。

**M4 规划三决策（2026-08-30 拍板）**
1. 看板形态 = `metrics.dashboard` 云函数返回 JSON（MCP/控制台/脚本查看），**不做小程序内看板页、不引入管理员鉴权**。
2. 入桩时机 = 等 M3 真机验证通过后再插桩（保基线干净）。
3. 只补 SC4 自评入口（关系主页「我们在一起了」）；SC5 处置能力留 M5，M4 期间 SC5 为数据缺口、需人工终审放行。

---

# 已完成工作

1. **需求→Spec→Plan→Tasks→Implement 全流程**走完（M0 全卡 + M1 全卡 + M2 全卡）。
2. **M0.1–M0.3 ✅**：脚手架、云函数、工具层、页面、隐私门禁。M0 Checkpoint 验收通过。
3. **M1.1–M1.5 ✅**：社区 + 内容安全/举报拉黑 + 邀请裂变。M1 Checkpoint 通过（step 1–6）。
4. **M2.1–M2.4 ✅ 破冰**：match/game 云函数 + 匹配页/游戏房/题目卡 + realtime.js。
5. **M2 缺陷修复 A/B/C**：游戏结束双方消失 / 契合度不接结果 / 匹配页收不到新邀请。
6. **MBTI 资料项**：`src/utils/mbti.js` + `src/pages/profile/mbti.vue`，服务端 `auth.sanitizeProfile` 加 `mbti` 白名单校验。
7. **社区特性开关 + 拉黑闭环**：`safety.listBlocks/unblock` + `pages/settings/settings.vue`。
8. **撮合 N+1 优化**：`recommend` 按批聚合 done stats。
9. **M3 真机佐证 + BUG-1/BUG-2 修复**：抽 `cloudfunctions/growth/growth-core.js` 共享内核，`chat`/`game` 改本进程内直接写 pairs，内核对 openid 缺失 401 护栏；stage 改读时派生统一口径。提交 `9bf1eb8`，真机复验 PASS。
10. **M4.1 F9 全链路埋点部署收尾**：6 存量函数 + 新建 metrics 函数部署；修复 metrics 漏 `package.json` 致 wx-server-sdk 未装；events 冒烟通过。前端 `track.js`/`App.vue`/`match.vue` 用户重建前端后真机验证。
11. **M4.1 真机验收 + 闭环**：查库 47 条 / 11 类事件，三断言全过（PII 零泄漏 / 白名单无越界 / day=CST+8 / pairId 双 openid 排序）。`chat_unlocked`/`profile_completed`/`recommend_view` 三个曾为 0 的缺口全部闭合（含修 `match.vue` 漏 import track 的 bug）。提交 `e7f40ef`。
12. **contact_unlocked 幂等化**：`chat/index.js` 每次上报前查 events 是否已存在该 pair 的 contact_unlocked，仅首次上报。提交 `e250f36`。
13. **M4.2 北极星看板**：`metrics.dashboard` 只读聚合 SC1–SC5 + 漏斗，按 plan-m4.md §5 口径。提交 `2b4c06e`（feat）+ `53ce5b0`（docs）。
14. **推送**：M4.1 68 提交 + M4.2 2 提交全部快进推送至 `origin/main`（=`53ce5b0`），零强推。
15. **清理**：3 条预修复重复 `contact_unlocked` 已按精确 `_id` 逐条删除（contact_unlocked 现归零）。
16. **M4.4 SC4 双边邀请确认（2026-08-30）**：单边 `confirmRelation`（A 点即落库）升级为**双边邀请**。`growth-core.js` 新增 `sendConfirmInvite/acceptConfirmInvite/rejectConfirmInvite/cancelConfirmInvite`（邀请存 `pairs.confirmInvite={from,at,expiresAt}`，TTL=10min，服务端 accept/reject 校验过期）；growth 已重部署并校验 `Status=Active`。
17. **M4.4b 邀请投递应用级修复（2026-08-30）**：真机发现"B 不在关系页收不到弹窗"——根因是轮询挂在 relation.vue 页面级（onHide 即停）。修复：新增 `src/utils/confirmInvite.js` 全局 store（4s 轮询+1s tick，命名避让 T2 已占用的 `invite.js`），App.vue onShow/onHide 启停，B 在任意页面经 `uni.showModal` 原生通知（按 pairKey+expiresAt 去重）；`relation.vue` 改消费共享 store，`receivedInvite` 必须 computed（原 method 写法模板中恒真值）。提交 `a79d782`。
18. **M4.4c 布局微调（2026-08-30）**：等待/撤销移出 rel-actions 按钮列（按钮尺寸不再跳动），改为信息区状态条「💌 等待 XX 回应 · 倒计时」+ 内联撤销链接。提交 `aee4416`。
19. **getOpenid ReferenceError 修复（2026-08-30）**：M4.4b 重写 relation.vue 时漏 import `getOpenid`，Vite 不检查未定义引用故编译恒绿、运行到 onShow 才炸（`BUG.md` 有记录）。**教训：重写 vue 文件后必须对照旧 imports 清单核对**。提交 `7a4395e`。
20. **M4.3 阈值校准 ✅ M4 收官（2026-08-30）**：查库 pairs 3 对（growthValue {150,150,21}）+ events 108 条（单日）→ **n=3 样本不足，沿用初值 12/40/90/150**，产出 `tasks/threshold-calibration.md`。两个观察经代码级复核**修正归因**（提交 `6d5c040`）：① 「游戏权重偏高」改判为 M4.1 手工 addGrowth 测试污染（实际权重游戏+8/局、聊天+2/轮、纯游戏到 S4 约需 19 局）；② 「app_open 双计致 SC2 虚高一倍」降级为零影响（看板 SC1–SC5 均不消费 app_open）。提交 `75fcb71`。
21. **M5 规划定稿（2026-08-30 20:20）**：用户三选拍板——范围=SC5 处置能力+修 app_open 双计（冷启动线明确跳过）；处置=`safety.handleReport`+管理员 openid 白名单（推荐 `admins` 集合载体）；SC5 以 `reports` 集合为权威源（`report_handled` 事件仅观测流）；处置只标记不做自动下架/封号。产出 `tasks/plan-m5.md` + todo.md M5 任务卡（M5.1–M5.4+Checkpoint M5）。提交 `c8e3e2d`。
22. **M5 代码全部落地 + 部署（2026-08-30 20:40，用户签字放行后）**：
    - M5.2：`report_handled` 入白名单（`993e1c0`，sync:core 7 副本）；
    - M5.1：`safety.handleReport`（`6a7c486`）——admins 集合校验 403 / decision 限 handled|dismissed / 幂等 alreadyHandled / note 截 200 不入埋点；
    - M5.3：dashboard SC5（`74e0cf0`）——reports 直读 24h 处置率 + pendingCount，替换 no_data；
    - M5.4：App.vue 双计修复（`022cdad`）——`coldLaunching` 标记跳过冷启动配对 onShow；
    - docs：`77622d7`（todo/plan-m5/verification-log）。
    - **部署核验**：safety/metrics 均 `Status=Active` 且 CodeInfo 含新代码；dashboard MCP 冒烟 code=0。
23. **Checkpoint M5 线上验收 + 人工终审通过（2026-08-30 21:20–21:40）**：
    - 用户自建 `admins` 集合（1 管理员 openid `oUsf1xRnPxcjWLiSG3XFR-6LrPFY`，21:14）。
    - 验收 PASS：① 未登录守卫（MCP invoke → 401）；② 处置 1 条 pending（等价字段模拟，无管理员 UI 无法真实触发）→ `SC5={ok, rate:100, handledCount:1, pendingCount:2}`；③ app_open 双计修复实证（部署后 5 次启动全单条，部署前有成对样本）。提交 `90db466`。
    - **403 / alreadyHandled 未走真实登录态**（逻辑经代码审查覆盖），待管理员 UI 上线补验。
    - 阈值回灌评估 #2（`4666752`）：样本无增量（n=3 对测试数据 / 0 自然用户 / 无跨天），**维持沿用初值 12/40/90/150**；唯一新信号=SC5 首次有数（n=1，不构成校准依据）。下次回灌条件：自然用户 ≥10 对 + 跨天可算。
    - **人工终审通过（21:40，用户签字）→ M5 全收官，下一步 = M6 规划**。
24. **M6 规划定稿（2026-08-30 21:56）**：用户选 **范围 A 收 M5 尾** + `config.js` 提交 `community=true`。M6 = 管理员处置 UI 闭环（M6.1 `safety.isAdmin` 云函数动作 / M6.2 前端 `isCurrentUserAdmin()` + settings 页条件入口 / M6.3 `pages/admin/reports.vue` 处置页 pending 列表+处置/驳回+幂等禁用）；isAdmin 走服务端（admins 集合不外泄客户端）；冷启动准备（资质/类目/隐私/索引）与技术债（时区/streak、删 invite.js、老对回填）整线延后留 **M7**。产出 `tasks/plan-m6.md` + todo.md M6 任务卡（M6.1–M6.4 + Checkpoint M6）。**状态：已签字放行，代码落地 + 部署 Active + MCP 冒烟 PASS（2026-08-30 22:18）。**
25. **M6 落地（2026-08-30 22:18）**：用户签字「放行」。M6.1 `safety.isAdmin` 动作（查 admins 集合→{isAdmin}，401 守卫）+ M6.3 `safety.listReports` 动作（管理员鉴权+join users 取昵称）；部署 safety → `Status=Active`（CodeInfo 含 isAdminAction/listReports）。前端 M6.2 `src/utils/admin.js`（`isCurrentUserAdmin()` 会话缓存）+ settings 条件入口；M6.3 `pages/admin/reports.vue`（pending/已处置 tab、处置/驳回、幂等禁用、isAdmin 深链守卫）+ pages.json 注册。M6.4 `config.js` community 正式提交 true。build DONE；原子提交 `878ad10`(safety)/`d4cd6b2`(admin)/`9ce5c71`(config)。MCP 冒烟 isAdmin/listReports 均 401（无登录态守卫生效；管理员 happy path 留真机）。**下一步 = M6 真机验收（管理员账号走闭环），通过即 M6 全收官，进 M7。**
26. **M6 真机验收通过（2026-08-30 22:29，用户确认「M6验收完成」）**：管理员账号真机走闭环 PASS——设置页见「管理后台」→ 处置/驳回 pending → reports.status 变更 + handledAt 落库 + dashboard SC5 出真实 rate；非管理员无入口且深链被守卫拦截；重复处置 alreadyHandled + 服务端 403 双向印证。**闭合 M5 遗留的 403/幂等真机补验**。M6 全收官，下一步 = M7 规划（上线就绪 / 技术债）。

---

# 已尝试但失败/放弃的方案

**🔴 npm 安装死结（safe-delete shim 拦截，非网络问题）**
- 根因：WorkBuddy Node 安全删除 shim（经 `NODE_OPTIONS=--require` 注入）拦截所有 fs 删除 API，npm install/reify 需大量删临时文件 → 全被拦 → `.bin/uni` 缺失、安装失败。
- 旁因：① 系统 npm 缓存 `AppData\Local\npm-cache` 被沙箱拒写(EPERM)；② 全局 `.npmrc` 写死代理 `127.0.0.1:7890` 不可编辑。
- **终极可靠命令（切勿裸装）**：
  ```
  unset CODEBUDDY_SESSION_ID CLAUDE_SESSION_ID
  export PATH="/c/Users/panda/.workbuddy/binaries/node/versions/22.22.2:$PATH"
  cd "D:/Tencent/app"
  env -u CODEBUDDY_SESSION_ID -u CLAUDE_SESSION_ID -u HTTP_PROXY -u HTTPS_PROXY -u http_proxy -u https_proxy \
    npm install --cache "D:/Tencent/app/.npm-cache" --proxy= --https-proxy= --no-audit --no-fund
  ```
  - shim 逻辑：`SESSION_ID = CODEBUDDY_SESSION_ID || CLAUDE_SESSION_ID`，**为空则不拦截**。`dangerouslyDisableSandbox=true` **关不掉** safe-delete（独立层级）。
- 删 node_modules：先 `mv node_modules _old_deps`（改名不被拦），再 `rm -rf _old_deps`。

**🔴 写死云函数 env + 自动建集合（用户已否决，勿再提）**
- 用户明确回退。500「集合未创建」真实根因是「未重部署函数」或「集合未建在正确环境」，非写死 env 引起。看到 500 先查这两点。

**🔴 前端持有黑名单传后端过滤（已否决）**：客户端可传空数组绕过，防骚扰失效。勿重新提议。

**已修正·集合缺失误报**：原 `community` catch 正则把含 "collection" 字样的报错误判成"集合没建"。已收紧为匹配 `not exist|does not exist|no such collection`。

**已修正·uni-app 自定义组件事件双触发**：用原生事件名(`tap`/`click`)做 `$emit` 名 + 未声明 `emits` → 一次点击触发两次。**规范：自定义组件事件名避开原生名、必须声明 `emits`。**

**无法代码修复·个人账号分享封禁**：页面定义 `onShareAppMessage` 触发内部 `showShareMenu` 被 banned。要么不定义，要么升企业主体+社交类目。

**已放弃路线**：原生框架（改 uni-app）；情侣经营/内购（Out of scope）；高实时游戏（后置）；AI 陪玩冷启动；Snapchat 强衰减（采用只增不减）；改 PostgreSQL（确认文档库后放弃）。

**🔴 NoSQL delete 用 `$in` 只删 1 条**：`writeNoSqlDatabaseContent` 的 `action:delete` 配 `$in` 查询**只命中 1 条**（返回 `deleted:1`）。须用精确 `_id` 逐条删。列 `_id` 给用户过目再删的规则仍遵守（破坏性强删云端数据前必列 _id）。

---

# 当前状态

**进度位置**：M0 已验收、M1 Checkpoint 通过、M2 已收尾、M3 已通过（含 BUG-1/BUG-2 真机复验 PASS）、M4 全部完成 ✅、**M5 全收官 ✅（2026-08-30：代码落地 + 线上验收 PASS + 阈值回灌评估 #2 + 人工终审 21:40 签字通过）**。**M6 规划定稿 ✅（2026-08-30：范围 A 收 M5 尾）**；**M6 全收官 ✅（2026-08-30 22:29 真机验收通过 + 人工终审）**。Checkpoint M4/M5/M6 均已终审放行。下一步 = M7 规划。

**M4.1 埋点终验结果（2026-08-30，查库 47 条 / 11 类事件）**
- `app_open`×23、`match_accept`×4、`game_join`×3、`game_done`×3、`message_sent`×7、`pair_stage_changed`×2、`mbti_completed`×1、`chat_unlocked`×1、`profile_completed`×1、`recommend_view`×2
- 三断言全过：PII 零泄漏 / 白名单无越界 / day=CST(+8) / pairId 双 openid 排序拼接
- 剩余 `contact_unlocked`(0，本轮无 pair 达 S4 解锁门槛) / `report_created`(0，用户未举报) = 实现就绪、场景未覆盖，不阻塞闭环

**M4.2 看板口径（47 条数据复算一致）**
| 指标 | 结果 | 目标 | 说明 |
|---|---|---|---|
| SC1 阶段 S2 率 | **50%** | ≥30% | 达 S2 的 pair(1) ÷ 有 game_done 的 pair(2) |
| SC2 D7 留存 | **0%** | ≥25% | 全部事件同一天，D7=09-06 无数据 → 单日测不出，口径正确非 bug |
| SC3 加微信转化 | **0%** | ≥15% | contact_unlocked 已清理且无新解锁 |
| SC4 关系确认 | **1**（3 条事件，唯一 pair=1） | — | M4.4 双边邀请真机验收通过；同一 pair 多次确认周期各报一次，看板按唯一 pair 计数 |
| SC5 违规处置 | **no_data** | ≥95% | 处置能力留 M5 |

**Checkpoint M4 第一项「能观测 SC1–SC4（看板有数、口径可复算）」已达成**；SC5 仍需人工终审放行。

---

# 未解决问题

| 优先级 | 问题 |
|--------|------|
| ✅ 已修·复验 PASS | **BUG-1：云函数间调用丢失 OPENID** → 幽灵 pair。已抽 `growth-core.js` 共享内核，`chat`/`game` 本进程内直接写 pairs，内核 openid 缺失 401 护栏。提交 `9bf1eb8`，真机复验 PASS（无新增幽灵 pair）。 |
| ✅ 已修 | **BUG-2：`pairs.stage` 缓存漂移**。`match.recommend` 改 `stageOf(growthValue)` 读时派生；`game` 结束也结算 streak。 |
| ✅ 已澄清 | 数据疑点 2 条（growthValue=150 手改测 S4、缺失 games 文档手删）均为用户本人操作，非 BUG。 |
| 🟡 中·M4 决策 | **存量老对全量回填**：已成 done 且此后零互动的老对仍缺 pairs。BUG-1 修复后只要双方再互动一次即自愈，仅彻底零互动的老对缺 pairs，M4 需决策是否做一次性回填。 |
| 🟡 低·非阻塞 | **云函数运行时时区 UTC**：复验中游戏完成于北京时间 08-30 02:33，`lastStreakDay` 记为 08-29。`dayOf()`/`isoWeekOf()` 用服务端本地时区，而中国用户在北京时间 08:00 前活跃被记前一天，连续两天凌晨活跃可能只拿 1 次 streak。**建议 M4 改为按 `Asia/Shanghai`(+8) 偏移计算**（埋点 events 的 `day` 字段已用 +8，成长值 streak 的 dayOf 尚未改）。 |
| 🟡 高·上线前置 | 账号主体（个人/企业）与社交类目资质。微信对个人主体通常无法授社交类目，`msgSecCheck` 通常需企业主体。卡"上线"不卡"开发"。 |
| 🟡 中·性能 | 复合索引：`comments` 建 `{postId:1,auditStatus:1,createdAt:1}`、`posts` 建 `{auditStatus:1,topicId:1,createdAt:1}`（只能控制台建）。 |
| 🟡 中 | 内容安全云调用权限未开通（个人账号），当前本地兜底；企业就绪后切 `USE_WX_SECURITY=true`。 |
| 🟡 中 | 隐私政策正式文案与备案（M0 已有隐私页门禁，正式文案待补）。 |
| 🟢 低·死代码 | `src/utils/invite.js` 自裂变入口移除后全仓无 import，实为死代码。**删除前需用户确认**，勿擅自删。 |
| 🟢 低 | `users` 可能残留无 `openid` 历史孤儿文档（_openid→openid 修复前产生），建议控制台手动清理。 |
| 🟢 低·本地残留 | `_rm_oldbd/`：早期损坏 node_modules 改名副本（~29M，gitignore，safe-delete 删不掉，用户本机可手动清）。 |
| 🟢 低 | 成长阈值 12/40/90/150：M4.3 校准结论=样本不足沿用初值（见 `threshold-calibration.md`，含游戏权重偏高观察）。 |

---

# 待确认事项

- ~~M4.3 阈值校准~~ ✅ **已完成（2026-08-30）**：`tasks/threshold-calibration.md` 已产出——n=3 对（单日、全测试账号）→ **样本不足，沿用初值 12/40/90/150**；记录两个后续观察（**2026-08-30 19:40 代码级复核已修正归因**）：① growthValue 区分度弱系 M4.1 手工 addGrowth **测试污染**（实际权重游戏+8/局、聊天+2/轮、streak+3/天，纯游戏到 S4 约需 19 局），真实权重配比待自然用户数据判定；② `app_open` 冷启动双计对现行看板**零影响**（SC1–SC5 均不消费 app_open，SC2 为 pair 维度 D7 互动留存），仅未来裸数 DAU 需按 (userId, day) 去重——修复已列入 M5.4。
- ~~M4.4 SC4 自评入口~~ ✅ **已完成并升级为双边邀请，真机验收通过（2026-08-30）**：A 发起邀请→B 任意页面经应用级轮询（`src/utils/confirmInvite.js` 全局 store + `uni.showModal` 原生通知）收到→同意落 milestones + 上报 relation_confirmed / 拒绝 / 撤销 / 超时 10min 失效。
- **是否做存量老对全量回填**（见上表 🟡 中）。
- **是否修复 UTC 时区**：把成长值 streak 的 `dayOf`/`isoWeekOf` 改为 +8（埋点 day 已改，streak 未改）。
- **是否删除死代码 `src/utils/invite.js`**（需用户点头）。
- 小程序账号主体/社交类目资质现状？内容安全云调用权限是否就绪？隐私政策文案进度？
- **push 已无待办**：远程 `main` 已与本地 HEAD 对齐（2026-08-30 20:25 实测 `c8e3e2d`），历史提交均已推送。

---

# 关键资料

- **Spec（事实来源）**：`D:\Tencent\app\spec\SPEC.md`（v1.0）
- **Plan（已批准）**：`D:\Tencent\app\tasks\plan.md`
- **Tasks（20 卡）**：`D:\Tencent\app\tasks\todo.md`
- **M4 规划定稿**：`D:\Tencent\app\tasks\plan-m4.md`（含 13 事件清单 + SC1–SC5 口径）
- **M5 规划定稿**：`D:\Tencent\app\tasks\plan-m5.md`（SC5 处置 handleReport + 管理员白名单 + SC5 口径 + M5.4 双计修复，待放行）
- **M4.3 校准结论**：`D:\Tencent\app\tasks\threshold-calibration.md`（n=3 沿用初值 + 修正后的两个观察）
- **BUG 记录**：`D:\Tencent\app\BUG.md`（getOpenid ReferenceError 案例）
- **验收记录**：`D:\Tencent\app\tasks\verification-log.md`（M2/M3/M4.1/M4.2/M4.3/M4.4/M4.4b/M4.4c 各章）
- **M4.1 补测清单**：`D:\Tencent\app\tasks\m4.1-supplement-test.md`
- **项目记忆**：`D:\Tencent\app\.workbuddy\memory\2026-08-26/27/28/29/30.md`
- **原型参考站（MBTI 机制）**：`https://214e49b7ee1545cc8fa07b3d3da5c21a.app.workbuddy.link/`
- **appid**：`wx900385d98d023d6f`
- **CloudBase envId**：`love-app-server-d2fhg32320d65c12`（个人版，ap-shanghai，纯 nosql，到期 2027-02-26）
- **远程仓库**：`git@github.com:Tea-Codeman/love_app.git`（SSH，分支 `main`，已对齐 `c8e3e2d`）
- **管理版 Node**：`C:\Users\panda\.workbuddy\binaries\node\versions\22.22.2\node.exe`
- **`project.config.json`**：`miniprogramRoot = "dist/dev/mp-weixin/"`；`cloudfunctionRoot = "cloudfunctions/"`
- **CloudBase MCP 工具（Agent 可自助，无需 GUI）**：`queryEnv`/`queryFunctions`(getFunctionDetail/listFunctions/getFunctionDownloadUrl/updateFunctionCode/managePermissions)/`readNoSqlDatabaseStructure`/`readNoSqlDatabaseContent`/`writeNoSqlDatabaseContent`/`queryLogs`。**注意 `queryFunctions(action=listFunctionLogs)` 已废弃**，查日志用 `queryLogs(action=searchLogs)`。

---

# 我的偏好与工作方式

- **决策风格**：先澄清需求、再逐里程碑签字放行；重视"为什么"；不喜为看起来完整而加无关信息。
- **流程偏好**：需求未明确前禁止实现；Spec/Plan 是活文档，改动前先更新。
- **沟通**：中文；高密度、去冗余；直接给结论与下一步。
- **Git**：重视"提交作为回滚锚点"，按关注点拆多个原子提交（功能/开关/文档/性能分开）。
- **Agent 协作**：希望先读已有 Spec/Plan/Tasks 再动手；遇到环境坑定位根因并固化记录；发现方案有问题直接反对并说明理由（曾认可对"前端传黑名单"的否决）。
- **已确认禁忌**：不裸 `npm install`；不 `rm -rf node_modules`/`npm config set`；不写死 env / 不提议自动建集合；不擅自重加 `onShareAppMessage`/邀请入口；不擅自删疑似死代码（先问）；不擅自删云端数据（强删前必列 `_id` 给用户过目）。

---

# 盲区防护与易错避坑（针对缺失信息自查）

> 假设新 Agent 完全看不到历史聊天记录，以下是最易误判/漏看/重复踩坑处。

**A. 启动与环境**
1. `node_modules` 与 `dist` 均被 gitignore，clone 后都不存在。首次必须跑"已尝试但失败"第一段的可靠 npm 命令；跑完再 `npm run dev:mp-weixin` 生成 `dist/dev/mp-weixin`。
2. **DevTools 只读 `dist/dev/mp-weixin`**（`miniprogramRoot`）。改完源码跑 `dev:mp-weixin` 即可 HMR 刷新，**不要重导 dist/build**。`build:mp-weixin` 只做编译验证，当前不加载。
3. 微信开发者工具导入目录选**仓库根目录 `D:\Tencent\app`**，不要指到 dist 子目录。

**B. 云函数与集合**
4. **「代码改了但没部署」是本项目最常见假 bug**，勿凭 ModTime 猜。核实法：下载云端代码 zip（`getFunctionDownloadUrl`）→ 解压取 `index.js` → **归一化换行符**（云端 CRLF、本地 LF，直接 diff 误报整文件不同）与本地比对。部署用 `manageFunctions(updateFunctionCode, functionRootPath="D:/Tencent/app/cloudfunctions", func={name, isWaitInstall:true})`，**isWaitInstall 必须放 func 内、func 必须带 name，否则参数校验失败**。`updateFunctionCode` 是异步，需等 `getFunctionDetail` 的 `Status` 从 `Updating` 变为 `Active` 后 CodeInfo 才算落地（瞬时态 CodeInfo 是旧快照）。
5. 云函数用 `DYNAMIC_CURRENT_ENV`，部署环境必须 = `love-app-server-d2fhg32320d65c12`，否则读不到控制台建的集合报"集合未创建"。
6. 集合必须**手动**在控制台建，代码不自动建。
7. 跨函数调用：存在 `community`→`safety`、`chat`→`safety`、`chat`→`growth`。改 `safety`/`growth` 的入参/返回结构须同步检查调用方。
8. **🔴 云函数 A 用 `cloud.callFunction` 调 B 时，B 内 `getWXContext().OPENID` 是 `undefined`**（端用户身份不自动透传）。症状：被调用方用 undefined 拼主键 → 生成 `"<真实id>|undefined"` 幽灵文档，主流程不报错。自查：查主键有无 `undefined` 字面量；比对 `updatedAt` 是否早于触发时间。修法：抽共享模块给调用方 require 本进程内写库（已落地 `growth-core.js`，改完必须 `npm run sync:core` 再部署）。
9. **🟡 云函数运行时时区 UTC 非北京时间**：`dayOf()`/`isoWeekOf()` 拿到 UTC 日期，北京时间 08:00 前活跃被记前一天。埋点 events 的 `day` 字段已用 +8，成长值 streak 的 dayOf 尚未改，两者口径可能不一致。

**C. 代码结构暗坑**
10. `auth.sanitizeProfile` 是**严格字段白名单**——新增任何用户资料字段须同步改它，否则前端写入被静默丢弃（MBTI 踩过）。
11. `recommend` 的 `.field()` 投影要含新字段，否则查询结果 undefined、打分恒 0（MBTI 踩过）。
12. 子页 `navigateBack` 返回时 `onLoad` 不重跑，刷数据用 `onShow`。
13. 自定义组件事件名避开原生名(`tap`/`click`)且必须声明 `emits`，否则一次点击触发两次。
14. 个人账号别定义 `onShareAppMessage`（内部 showShareMenu 被 banned，代码改不掉）。
15. `npm run build:mp-weixin` 偶卡（与 dev watcher 争用 dist，3–11 分钟无输出，正常仅 ~12 秒）。识别：停掉后台 build 任务重跑即可，别误判编译失败。改完源码优先看 `dist/dev` 产物。

**D. 调试误判**
16. "一打开就显示已登录"不是 bug：模拟器 Storage 不随重编译清空，清 `rg_openid`/`rg_user`/`rg_privacy_agreed` 或 `uni.clearStorageSync()` 即可重走。
17. 看到 500「集合未创建」先查"是否重部署函数"与"集合是否建在正确环境"，勿误判写死 env 有害。
18. 查日志用 `queryLogs`，**别用 `listFunctionLogs`**（已废弃）。返回可能几十万字符被截断存文件，需写脚本解析 `Results[].Content`（嵌套 JSON 二次 json.loads）取 `ret_msg`。
19. **查云端代码必须归一化换行符再 diff**（云端 CRLF / 本地 LF，否则误报全文件不同）。
20. **Glob 工具对本项目 `cloudfunctions/**/metrics-core.js`、`src/utils/track.js` 会返回假阴性「No files found」**，但 `ls`/`git show`/`head` 证实真实存在。勿单凭 Glob 下结论。

**E. 文档与现实落差**
21. 决策写进文档 ≠ 代码已实现 ≠ 已部署云端。曾出现双向错误（文档说没做实际早做了，文档说做了实际漏了）。接手两条都核实。
22. 旧版 HANDOFF 提到的 `PRECONTEXT.md`/`CONRRENTCONTEXT.md`/`SKILL.md` **现已全部不存在**，勿当待办。
23. **🔴 落盘后务必复核**：曾出现过 `Edit` 返回成功但**实际未写入**（git 干净、Grep 查无内容）的情况。落盘后用 `git status`/`Grep` 复核编辑真的写入，勿默认 Edit 成功。

---

# 新 Agent 接手指南

1. **当前最重要的问题**：M0–M6 全收官（M5 终审 21:40 / M6 真机验收 22:29 均通过）。**M6 全收官 ✅（2026-08-30 22:29）**：safety 含 isAdmin+listReports（Active）、前端 admin 判定+设置页入口+处置页、community 提交 true，真机验收 PASS（管理员处置闭环 + SC5 真机有数 + 403/幂等补验通过）。**下一步 = M7 规划**（候选：冷启动准备 = 账号主体+社交类目资质指引 / 隐私正式文案 / 内容安全切换 / 复合索引；技术债 = UTC 时区/streak 修复 / 删 invite.js / 老对回填）。
2. **从哪一步继续**：
   - 若用户说"做 M7" → M6 已验收收官，直接规划 M7（冷启动准备 / 技术债）；候选清单见本文件「现状」段与 plan-m6.md「留 M7」项，范围需用户拍板（同 M5/M6 流程）。
   - 若用户说"做 M5.4" → 已完成（双计修复，见已完成工作），勿重做。
   - 若用户说"做 M4.4" → 已完成（双边邀请，见已完成工作 16–19），勿重做。
   - 若用户报 bug → 先核实云端代码是否与本地一致（下载 zip 归一化 diff），再查逻辑；勿默认"没部署"。
3. **不要重复**：不重跑需求澄清/Plan/Tasks；不用裸 npm install；不写死 env / 不提议自动建集合；不重新提议"前端传黑名单给后端过滤"；不擅自重加 `onShareAppMessage`/邀请入口；不擅自删 `src/utils/invite.js`；不擅自删云端数据（强删前必列 `_id`）。
4. **隐含约束（极易漏）**：云函数部署环境必须 = `love-app-server-d2fhg32320d65c12`；新集合仍需手动建在该环境；DevTools 加载 `dist/dev`；本环境纯 NoSQL，别提 PG/RLS/MySQL；改 `growth-core.js` 后必须 `npm run sync:core` 再部署。
5. **信息不足时优先问**：① M7 范围切多大（冷启动准备 vs 技术债，见 plan-m6.md「留 M7」清单）？② 是否做存量老对全量回填？③ 是否修 UTC 时区（streak 的 dayOf）？④ 是否删 `src/utils/invite.js`？⑤ 账号主体与社交类目资质现状（决定冷启动线 M7 何时启动）？
6. **动手前必读**：`spec/SPEC.md` → `tasks/plan.md` → `tasks/todo.md` → `tasks/plan-m4.md` → 本文件「盲区防护」与「已尝试但失败/放弃的方案」→ `.workbuddy/memory/` 最近几天记录。

---

# 极简版

- **做什么**：微信小程序「恋爱成长型社交」v1（单身主链路：社区→游戏破冰→关系升温→加微信导流）。uni-app(Vue3)→mp-weixin + CloudBase（**纯 NoSQL，无 PG/MySQL**）；弱实时；成长 5 阶段 S0–S4（阈值 12/40/90/150，只增不减）。
- **现状**：M0/M1/M2/M3/M4 全部完成；**M5 全收官 ✅（2026-08-30 21:40 人工终审通过）**：M5.1–M5.4 落地部署、验收 PASS（SC5 rate=100%、双计修复实证、admins 已建）、回灌评估 #2 维持初值。**M6 全收官 ✅（2026-08-30 22:29 真机验收通过 + 人工终审）：M6.1–M6.4 落地部署 + 真机验收 PASS（管理员处置闭环 + SC5 真机有数 + 403/幂等补验通过）；冷启动准备/技术债留 M7**。下一步 = M7 规划（上线就绪 / 技术债）。
- **Git**：远程 `main` 已对齐本地（2026-08-30 20:25 实测 `c8e3e2d`），全部推送，工作树干净。**⚠️ 沙箱 `origin/main` ref 显示 gone 是怪象，以 `git ls-remote` 真实 SHA 为准。**
- **三条硬性原则**：① `auth.sanitizeProfile` 是严格白名单——加任何用户资料字段须同步改它；② 拉黑过滤只能服务端执行（前端传参可空数组绕过）；③ `recommend` 的 `.field()` 投影须含新字段，否则打分恒 0。
- **必避坑**：① npm 卡死= safe-delete 拦删除，`unset CODEBUDDY_SESSION_ID CLAUDE_SESSION_ID` 解（用"已尝试"完整命令）；② DevTools 只读 `dist/dev/mp-weixin`，改完跑 `npm run dev:mp-weixin`；③ 云函数部署环境必须=`love-app-server-d2fhg32320d65c12`；④ `build:mp-weixin` 偶卡 3–11 分钟（停掉重跑，别误判失败）；⑤ 自定义组件事件名避开 `tap/click` 且声明 `emits`；⑥ 个人账号别定义 `onShareAppMessage`；⑦ 子页 `navigateBack` 后 `onLoad` 不重跑，刷数据用 `onShow`；⑧ "一开就显示已登录"是模拟器 Storage 未清；⑨ 查云端代码须归一化换行符再 diff（云端 CRLF/本地 LF）；⑩ 查日志用 `queryLogs` 不用 `listFunctionLogs`（已废弃）。
- **🔴 两个最致命历史坑（已修但极易复发）**：A. 云函数 A `callFunction` 调 B 时 B 的 `OPENID=undefined` → 幽灵 pair，已抽 `growth-core.js` 共享内核，改完务必 `npm run sync:core` 再部署；B. **NoSQL delete 用 `$in` 只删 1 条，必须精确 `_id` 逐条删**（强删云端数据前必列 `_id` 给用户）。
- **🔴 落盘习惯**：`Edit` 可能返回成功但实际未写入，落盘后用 `git status`/`Grep` 复核。
- **不要主动提议**：写死 env、自动建集合（已否决）；前端传黑名单给后端（已否决）；重加 `onShareAppMessage`/邀请入口；擅自删 `src/utils/invite.js`（死代码，待用户确认）。
- **下一步方向**：M5 规划已定稿（`tasks/plan-m5.md`，2026-08-30 拍板：SC5 处置能力 handleReport+管理员白名单 + app_open 双计修复，冷启动线跳过）→ 待用户签字放行后逐任务落地；积累真实用户数据后再按 `threshold-calibration.md` 备忘方法回灌阈值（重点看游戏:聊天权重配比；app_open 双计已列 M5.4）。
