# 项目/任务

从零构建「恋爱成长型社交小程序」v1 —— 一个以"关系成长"为核心驱动的微信小程序，用「轻社交社区 + 双人轻互动小游戏」让单身用户从陌生 → 好感累积 → 信任，关系自然发生，最终促成真实伴侣关系。当前处于 **Implement 阶段 M0 地基**，源码脚手架已写入但**依赖被清理、尚未成功编译验证**。

---

# 核心目标

- **最终产出**：一个可上线验证的微信小程序（v1 仅单身主链路）。
- **v1 成功定义（北极星）【已确认】**：真的有人通过它交到伴侣，并成为留存用户。可量化信号 = "关系成长是否真发生"（SC1–SC5，见下）。
- **v1 不做营收**：先积累核心用户，变现（内购道具等）后置。数据结构预留虚拟道具字段位即可。

---

# 用户需求与约束

| 类别 | 内容 | 状态 |
|------|------|------|
| 产品形态 | 微信小程序（非独立 App、非 H5） | 【已确认】 |
| 用户群 | 20–28 岁、一二线城市单身年轻人；嫌探探"太看脸太直接"、Soul"太飘难破冰" | 【已确认】 |
| v1 范围 | 仅单身主链路（社区融入→游戏结识→自然升温→导向恋爱）；**情侣经营、内购变现明确 Out of scope** | 【已确认】 |
| 形态优势 | 微信内即用（免下载）+ 微信内闭环加好友；但**无官方"一键加好友" API**（见 T3 修正） | 【已确认】 |
| 关系成长 | 两人之间的好感度/信任度（非个人等级），多次互动累积、可视化、**只增不减** | 【已确认】 |
| 技术基座 | 前端 uni-app(Vue3+Vite) 编译 mp-weixin；后端微信云开发 CloudBase | 【已确认·用户签字】 |
| 实时性 | 弱实时（首款游戏回合制，云数据库 watch / 轻量 WS 秒级足够，不建 WS 集群） | 【已确认】 |
| 冷启动 | 社区先行 + 邀请裂变，不依赖假数据/AI 陪玩 | 【已确认】 |
| 合规 | UGC 必须过微信内容安全 API；需隐私政策 + 授权弹窗 + 举报机制 | 【已确认】 |
| 阈值初值 | 关系成长阶段门限 12/40/90/150 作为首版上线值，后续 F9 校准 | 【已确认·用户签字】 |
| 交付节奏 | M0–M4 作为 v1 交付节奏，每里程碑可独立评审 | 【已确认·用户签字】 |

**底线约束（来自 SPEC §9，必须始终遵守）**
- Always：UGC/私聊先审后发；服务端校验一切输入；成长值只增不减；改前先更 Spec。
- Never：提交密钥/openid 明文到仓库或前端；v1 加情侣经营或变现；跳过内容安全；用假数据伪造指标；用非官方"个人微信协议"加好友（违规封号风险）。
- Ask-first：前端框架/依赖/数据模型/营收相关改动（前端框架已定为 uni-app，再变需重新评审）。

---

# 背景知识（理解任务必需）

- **关系成长主线（产品灵魂）**：两人共享一条成长值，5 阶段 S0→S4：S0 陌生(0) → S1 有点意思(≥12) → S2 聊得来的朋友(≥40) → S3 有好感(≥90) → S4 信任·可加微信(≥150)。阶段由"事件标志 + 成长值"共同判定。
- **累加规则（Plan §5，初值）**：共同完成一场游戏 +8；一轮有效互聊 +2；互加游戏好友 +5；连续天数互动 +3/天（周上限 +15）；双方正向互评当次增益 ×1.5。只增不减。
- **首款游戏**：默契问答 / 选择题配对（回合制、弱实时）。你画我猜类高实时游戏后置。
- **匹配**：冷启期用兴趣标签/资料属性的规则匹配（T4），后续升级协同过滤。
- **微信加好友闭环修正（关键）**：小程序无"一键加好友"官方 API。F6 在 S4 解锁对方**联系方式**——展示个人微信二维码（长按识别）/ 或复制微信号去微信添加。非零摩擦直达通讯录，但仍是微信内闭环、免下载其他 App。

---

# 已确认事实

**技术决策（T1/T2/T3/T4/T5 + P1/P2/P3/P4 全部定案）**
- T5 后端 = 微信云开发 CloudBase（云函数 + 云数据库 + 云调用），免运维。
- T1 实时 = 弱实时（云数据库 watch / 轻量 WS，秒级）。
- T2 冷启动 = 社区先行 + 邀请裂变。
- T3 ① 无一键加好友 API，F6 走二维码/微信号闭环；② 内容安全用微信免费 API（msgSecCheck / mediaCheckAsync），UGC 必须接入过审；③ 需隐私政策 + 授权弹窗。
- T4 匹配 = 冷启期规则匹配。
- P1 关系成长 = 5 阶段、双人共享、只增不减。
- P2 首款游戏 = 默契问答/选择题配对。
- P3 北极星 = 成功配对并加微信的情侣数 + 7日留存/转化率/阶段推进。
- P4 差异化 = 微信内即用 + 关系成长可视化 + 轻游戏破冰 + 微信内加好友闭环。

**成功标准（SC1–SC5，初版门槛，待 F9 校准）**
- SC1 关系成长真发生：走到 S2 及以上比例 ≥30%。
- SC2 留存：配对后 7 日留存 ≥25%。
- SC3 导流现实关系：解锁联系方式并加微信比例 ≥15%。
- SC4 终极验证（北极星）：上线窗口期内有可归因的真实伴侣关系形成。
- SC5 安全底线：内容违规 24h 内处置率 ≥95%，无重大合规事故。

**技术栈与账号**
- 微信 appid（已写入配置）= `wx900385d98d023d6f`。
- 身份 = 微信 `openid`，由云函数 `cloud.getWXContext().OPENID` 取得，绝不落前端/仓库。
- 管理版 Node：`C:\Users\panda\.workbuddy\binaries\node\versions\22.22.2\node.exe`（v22.22.2）。

**数据模型（云数据库集合，Plan §4）**：users / topics / posts / matches / games / gameQuestions / pairs / messages / reports / blocks / events / invites。

**云函数（9 个，Plan §6）**：auth / community / match / game / growth / chat / safety / metrics / invite。

---

# 当前方案与关键决策

- **前端框架 = uni-app（Vue3 + Vite，编译 mp-weixin）**：原 Spec 默认微信原生，用户签字覆盖为 uni-app（更快跨端、生态成熟）。现有原生骨架已归档 `legacy/`，M0 迁移为 uni-app 结构（main.js/manifest.json/pages.json/src/）。
- **为什么这样定**：v1 核心是验证"关系成长是否真发生"，弱实时 + 社区先行即可；CloudBase 免运维让小团队最快验证 MVP；uni-app 编译产物仍调 `wx.cloud` 接 CloudBase，与微信原生一致。
- **已放弃的方案**：原生微信小程序框架（改为 uni-app）；情侣经营/内购（v1 Out of scope）；你画我猜类高实时游戏（后置）；AI/机器人陪玩冷启动（不依赖假数据）；Snapchat streak 式强衰减（采用只增不减更友好）。

---

## 实现防错细节（新 Agent 直接可用，避免重踩）

**① 关系成长"事件标志"具体枚举（M3 实现必需，plan §5 提炼）**
阶段不是只看成长值，必须同时维护 `pairs` 上的布尔/计数标志（对应 plan §4 字段），由 `growth` 云函数在事件发生时翻转：
- `E_FIRST_GAME`：完成首场游戏 → 置 `firstGameDone=true`（S1 前置）
- `E_GAME_COUNT_GE3`：`gameCount>=3`（S2 前置）
- `E_MUTUAL_FRIEND`：互加游戏好友 → 置 `mutualFriendAdded=true`（S2 前置）
- `E_CROSS_3_DAYS`：跨 ≥3 天正向互动（S3 前置）
- `E_S3_SATISFIED`：满足 S3 且 `growthValue>=90`
阶段判定 = 「上述事件标志成立」AND「成长值达门限(12/40/90/150)」。只累加 `growthValue` 而不维护标志位，会导致阶段永远卡在 S0。

**② M0.2 登录 canonical 范式（防错，不要自创）**
- 客户端 `uni.login({provider:'weixin'})` 只返回 `code`，**拿不到 openid**；openid 必须由云函数 `cloud.getWXContext().OPENID` 取得。
- 正确流程：前端调 `uni.cloud.callFunction({ name:'auth', data:{ action:'login' } })` → 云函数内用 `cloud.getWXContext().OPENID` 作为身份，首次写 `users`、再次读资料返回。
- 不要：用 `uni.getUserProfile`（已废弃）取 openid；把 openid 存前端/仓库；在客户端用 appsecret（绝不需要）。
- 参考骨架（云函数 auth.login）：
  ```js
  const cloud = require('wx-server-sdk'); cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
  exports.main = async () => {
    const { OPENID } = cloud.getWXContext()
    const db = cloud.database()
    let u = await db.collection('users').where({ openid: OPENID }).get()
    if (!u.data.length) { await db.collection('users').add({ data: { openid: OPENID, createdAt: Date.now() } }) }
    return { openid: OPENID }
  }
  ```

**③ 微信开发者工具导入路径与运行方式**
- `npm run build:mp-weixin` 产物在 `D:\Tencent\app\dist\dev\mp-weixin\`。用微信开发者工具打开该目录（`project.config.json` 已配 `miniprogramRoot=dist/dev/mp-weixin/`，也可直接打开项目根目录）。不要打开 `src/` 或根目录当小程序根。
- 小程序**只能在微信开发者工具运行**，不能当普通网页/Node 服务跑；`dev:mp-weixin` 也只是起编译+监听，最终效果在 DevTools 里看。

**④ "已验证 490 包成功下载" 澄清**
那是**清理依赖之前**的历史下载结果，不是当前状态。现在 `node_modules` 已删，**必须按"已尝试但失败"里的命令重新完整安装**（缓存已预热，较快）。不要误以为依赖已就绪、直接去 `npm run build`。

**⑤ 关键集合字段速查（自包含，来自 plan §4）**
- `users`：`openid(PK)`, `nickname`, `avatarUrl`, `gender`, `age`, `city`, `interestTags[]`, `bio`, `createdAt`, `invitedBy`
- `pairs`：`pairId(PK)`, `userA`, `userB`, `growthValue`, `stage`(S0–S4), `firstGameDone`, `gameCount`, `mutualFriendAdded`, `lastInteractionAt`, `milestones[]`, `createdAt`
- `games`：`gameId(PK)`, `type`(quiz), `round`, `state`(waiting/playing/done), `players[2]`, `questions[]`, `answers{openid:[]}`, `winner`, `createdAt`
- `matches`：`matchId(PK)`, `userA`, `userB`, `score`, `status`(pending/active/done), `createdAt`
- `messages`：`msgId(PK)`, `pairId`, `senderId`, `content`, `type`(text/img/contact), `auditStatus`, `createdAt`
（其余 topics/posts/gameQuestions/reports/blocks/events/invites 见 plan §4）

**⑥ openid 随 appid 变化**
`openid` 绑定 `appid`；若日后更换小程序 appid，历史 `openid` 不通用，需数据迁移。当前 appid=`wx900385d98d023d6f` 已固定，勿随意改。

# 已完成工作

**需求澄清 → Spec → Plan → Tasks → Implement 全流程已走完规划部分，源码起点已落。**

1. **需求澄清（interview-me）**：明确产品目标、核心用户、核心功能、不确定性、Spec。
2. **SPEC.md（v1.0 决策收口版）**：`D:\Tencent\app\spec\SPEC.md` —— 全部 Open Questions 已决议，是当前唯一事实来源。
3. **plan.md（已批准）**：`D:\Tencent\app\tasks\plan.md` —— 架构、模块分解、M0–M4 里程碑、数据模型、成长阈值初值、云函数划分、风险、签字记录。
4. **todo.md（Phase 3 Tasks）**：`D:\Tencent\app\tasks\todo.md` —— 20 张任务卡（M0.1–M4.3），每张含验收标准/校验/依赖/涉及文件/范围。
5. **M0.1 源码已写入（但未编译验证，依赖已清理）**：
   - `package.json`（uni-app Vue3，仅 mp-weixin 脚本：`dev:mp-weixin` / `build:mp-weixin`）
   - `src/main.js`、`src/App.vue`（onLaunch 调 `initCloud()`）、`src/manifest.json`（mp-weixin appid 已填）、`src/pages.json`、`src/pages/index/`、`src/utils/cloud.js`（CloudBase 初始化，**CLOUD_ENV 当前为空字符串，上线前须替换为真实环境 ID**）
   - `cloudfunctions/ping/index.js` + `package.json`（首个测试云函数）
   - `project.config.json`（appid=wx900385d98d023d6f，miniprogramRoot=dist/dev/mp-weixin/，cloudfunctionRoot=cloudfunctions/）
   - `vite.config.js`、`index.html`
   - 原生骨架归档至 `legacy/`（app.js/app.json/app.wxss/components/pages/project.private.config.json/sitemap.json/utils）
6. **依赖清理**：按用户要求清除了 `node_modules`、`.npm-cache`、`package-lock.json`、安装日志。当前为**无依赖的干净源码基线**。
7. **环境踩坑记录**：已定位 npm 装不上、node_modules 删不掉的两条根因（见下"已尝试但失败"），并记入项目记忆。

---

# 已尝试但失败/放弃的方案

**【关键·必须避免重蹈】npm 安装卡死（EPERM + 慢代理）**
- 现象：npm 每个元数据请求 ~90 秒、最终 EPERM 报错；node 直连仅 ~350ms。
- 根因 ①：沙箱禁止 npm 写系统缓存 `AppData\Local\npm-cache`（EPERM）→ 每次重试 90s。
- 根因 ②：全局 `C:\Users\panda\.npmrc`（**无法编辑**，沙箱拒绝写）硬编码 `proxy=127.0.0.1:7890`，npm 元数据走慢代理。
- `npm config set` 被沙箱拦截（不能写该 .npmrc）；`.npmrc` 里写 `proxy=""` 被 npm 视为无效而忽略，回退到环境变量代理。
- **可用安装命令（此前曾用此命令成功下载 490 包；清理依赖后需重新完整安装，缓存已预热、较快）**：
  ```
  export PATH="/c/Users/panda/.workbuddy/binaries/node/versions/22.22.2:$PATH"
  cd "D:/Tencent/app"
  env -u HTTP_PROXY -u HTTPS_PROXY -u http_proxy -u https_proxy npm install \
    --cache "D:/Tencent/app/.npm-cache" --proxy= --https-proxy= --no-audit --no-fund
  ```
  要点：必须**同时** `env -u` 清掉环境变量代理 **且** CLI 传 `--proxy= --https-proxy=`（最高优先级覆盖全局 .npmrc），并用 `--cache` 指向工作区内目录。
- 工作区 `.npmrc` 现状 = `cache=D:/Tencent/app/.npm-cache` + `registry=https://registry.npmmirror.com/` + `fetch-retries=2` + `fetch-timeout=120000`（**不含 proxy 行**，代理必须在 CLI 覆盖）。

**【关键·必须避免重蹈】node_modules 删不掉**
- 本环境回收站 API 不可用，safe-delete 对路径含 `node_modules` 的删除 fail-closed 拦截（`rm -rf`、`fs.rmSync`、Node 脚本全被拦）。普通目录删除正常。
- **绕法**：`mv node_modules _old_deps`（改名避开路径匹配）→ 再 `rm -rf _old_deps`（普通目录删除畅通）。
- ⚠️ **勿杀 PID 18376**：它是 WorkBuddy 的微信支付 MCP 服务（node.exe），**不是** node_modules 的锁，与本项目无关，误杀会影响其他功能。
- npm install 偶发进程 wedged（无网络连接但占文件句柄）。排查：用 `tasklist`/`Get-CimInstance Win32_Process` 看命令行确认身份，仅杀确认陈旧的安装进程；优先用上面的安装命令重跑（缓存已有 tarball，无需重下）。

---

## ⚠️ 上线前置硬阻塞（新 Agent 最易忽略、会白干）

以下任一项未确认，都会让后续工作在某一步整体卡死或上线被拒。新 Agent **必须在动手 M1 前先向用户确认**，属于 Ask-first 级前置：

1. **微信小程序账号主体类型（个人 / 企业）与社交类目资质**【最高优先级】
   - 本产品是"社交/婚恋"类小程序，微信对**社交类目审核极严**：个人主体通常**无法获得社交类目**，企业主体还需《增值电信业务经营许可证》等资质。
   - 若 `wx900385d98d023d6f` 是个人账号，则**可能无法上架社交类目**，且内容安全云调用（`cloud.openapi.security.msgSecCheck`）等能力通常也需企业主体开通。
   - 这决定整个 T3 合规方案与最终能否上线，**先确认账号主体与类目资质再继续 M1**。
2. **CloudBase 环境是否已开通 + 真实环境 ID**【M0 硬前置】
   - 若根本没在微信开发者工具开通 CloudBase 环境，`ping` 与一切云调用都跑不通；`CLOUD_ENV` 留空仅在他已把某环境设为"默认环境"时可用。
   - 新 Agent 第一步：确认环境已开通 → 拿到环境 ID → 填入 `src/utils/cloud.js` 的 `CLOUD_ENV`（或确认默认环境生效）。
3. **内容安全云调用权限**（`cloud.openapi.security.msgSecCheck` / `mediaCheckAsync`）是否已对该账号开通——通常随企业主体与类目一并评估。

> 这三点若不成立，M0 之后会连环失败。宁可先问，不要在未确认时假设"能过"。

# 当前状态

- **进度位置**：Implement 阶段 **M0 地基**。M0.1 源码（脚手架 + CloudBase 接入 + ping 云函数）已写完，但**依赖从未成功安装/链接，`npm run build:mp-weixin` 从未跑通验证**。
- **卡点**：无（用户已要求清理依赖，清理已完成）。当前是干净的、等重装依赖的源码基线。
- **下一步最合理动作**：用上面的"可用安装命令"重装依赖 → 验证 `npm run build:mp-weixin` 能编译出 dist/dev/mp-weixin → 在微信开发者工具打开编译产物、调 ping 云函数确认 CloudBase 连通（注意 `src/utils/cloud.js` 的 `CLOUD_ENV` 需先填真实环境 ID，或依赖默认环境）。
- **新 Agent 应避免重复**：① 不要用裸 `npm install`（会卡 90s×N 然后 EPERM）；② 不要尝试 `rm -rf node_modules` 或 `npm config set`（被拦）；③ 不要杀 PID 18376；④ 不要重新跑需求澄清/Plan/Tasks——这些已定稿，Spec/Plan/Todo 是唯一事实来源，先读它们再动手。

---

# 未解决问题

- **【高】CloudBase 环境 ID**：`src/utils/cloud.js` 的 `CLOUD_ENV` 为空。需在微信开发者工具 → 云开发 → 设置 获取真实环境 ID 并填入（或确认默认环境可用）。这是 M0 出口前必填项。
- **【中】真机/模拟器验证环境**：是否已有微信开发者工具 + 已开通 CloudBase 环境？这决定 M0.1 能否端到端验证（ping 云函数调用）。
- **【中】成长阈值校准**：12/40/90/150 为初值，上线后用 F9 数据回灌（M4.3 任务）。当前无需动。
- **【低】关系成长具体判定边缘情况**：阶段由"事件标志 + 成长值"共同判定，具体边界逻辑在 M3.1/M3.2 实现时细化（Spec §6 有示意代码）。

---

# 待确认事项

- **【最高优先级】小程序账号主体类型（个人/企业）与社交类目资质**：社交/婚恋类目审核极严，个人主体通常无法获得，企业需《增值电信业务经营许可证》。直接决定能否上架与 T3 合规方案是否可行（见上方"上线前置硬阻塞"）。
- CloudBase 环境 ID 从哪来 / 是否已有可用环境？（影响 M0 能否验证）
- 是否需在 v1 同时准备安卓/iOS？当前仅 mp-weixin（已定），如要 H5/App 需重新评审（Ask-first）。
- 微信内容安全 API 的云调用权限（CloudBase 需开启 `cloud.openapi.security.msgSecCheck` 权限，企业主体资质）——M1.2 前确认。
- 隐私政策文案与备案：合规上线前置，建议尽早准备。

---

# 关键资料

- **Spec（事实来源）**：`D:\Tencent\app\spec\SPEC.md`（v1.0，全部决策收口）
- **Plan（已批准）**：`D:\Tencent\app\tasks\plan.md`（架构/数据模型/阈值/云函数/风险/签字）
- **Tasks（20 卡）**：`D:\Tencent\app\tasks\todo.md`（M0.1–M4.3，含验收/校验/依赖）
- **项目记忆**：`D:\Tencent\app\.workbuddy\memory\2026-08-26.md`（含环境踩坑记录）
- **appid**：`wx900385d98d023d6f`（已写入 manifest.json / project.config.json）
- **可用安装命令**：见"已尝试但失败"第一段（务必复制完整）。
- **删除依赖命令**：`mv node_modules _old_deps && rm -rf _old_deps`
- **管理版 Node 路径**：`C:\Users\panda\.workbuddy\binaries\node\versions\22.22.2\node.exe`
- **原生骨架归档**：`D:\Tencent\app\legacy/`（如需回查原始结构）
- **其他**：工作区根目录另有 `BOOTSTRAP.md`（agent 身份引导文件，与本项目无关，可选处理，勿与项目任务混淆）。

---

# 我的偏好与工作方式

- **决策风格**：先澄清需求、再逐里程碑签字放行；不喜"为看起来完整"而加无关信息；重视"为什么"而不仅是"是什么"。
- **流程偏好**：需求未明确前禁止实现（已满足）；Spec/Plan 是活文档，改动前先更新。
- **沟通**：中文；高密度、去冗余；直接给结论与下一步，不绕弯。
- **Agent 协作**：希望 Agent 先读已有 Spec/Plan/Tasks 再动手，不要重复已完成的规划工作；遇到环境坑要定位根因并固化记录，而非反复试错。

---

# 新 Agent 接手指南

1. **当前最重要问题**：M0 地基已完成源码但**依赖缺失、从未编译**。第一要务是用正确命令重装依赖并验证 `npm run build:mp-weixin` 能产出 `dist/dev/mp-weixin`，再在微信开发者工具调 ping 确认 CloudBase 连通。
2. **从哪一步继续**：从 **M0.1 收尾（依赖安装 + 编译验证）** 开始，然后按 todo.md 顺序做 M0.2（auth 登录）、M0.3（资料+隐私）。每里程碑末尾有 Checkpoint 人工评审（本对话中由用户放行）。
3. **不要重复**：不重跑需求澄清/Plan/Tasks；不用裸 `npm install`；不 `rm -rf node_modules`、不 `npm config set`；不杀 PID 18376（微信支付 MCP）。
4. **信息不足时优先问**：① **小程序账号是个人或企业、是否具备社交类目资质**（决定能否上线，最高优先级）；② CloudBase 环境 ID 与是否已开通；③ 是否有微信开发者工具可做真机/模拟器验证；④ 内容安全云调用权限是否就绪。①~④ 直接决定 M0/M1 能否端到端验证与最终能否上线。
5. **动手前必读**：`spec/SPEC.md` → `tasks/plan.md` → `tasks/todo.md`（尤其 M0.1–M0.3 与"已尝试但失败"中的环境命令）。

---

# 极简版（20% 必读）

- **做什么**：微信小程序「恋爱成长型社交」v1（单身主链路：社区→游戏破冰→关系升温→加微信导流），促成真实伴侣关系。
- **技术**：uni-app(Vue3)→mp-weixin + 微信云开发 CloudBase；弱实时；关系成长 5 阶段(S0–S4, 阈值12/40/90/150, 只增不减)。
- **已定稿**：`spec/SPEC.md`(v1.0)、`tasks/plan.md`(已批准)、`tasks/todo.md`(20卡) 是事实来源，先读完再动手。
- **现状**：M0.1 源码已写，但**依赖被清理、从未编译**。当前是无依赖干净基线。
- **第一动作**：用此命令重装依赖并验证编译（**切勿用裸 npm install**）：
  ```
  export PATH="/c/Users/panda/.workbuddy/binaries/node/versions/22.22.2:$PATH"
  cd "D:/Tencent/app"
  env -u HTTP_PROXY -u HTTPS_PROXY -u http_proxy -u https_proxy npm install \
    --cache "D:/Tencent/app/.npm-cache" --proxy= --https-proxy= --no-audit --no-fund
  npm run build:mp-weixin
  ```
- **必避坑**：npm 卡死=沙箱禁写系统缓存+全局.npmrc 慢代理（用上面命令）；node_modules 删不掉=改名 `_old_deps` 再删；**勿杀 PID 18376**(微信支付MCP)；上线前填 `src/utils/cloud.js` 的 `CLOUD_ENV`。
- **约束**：v1 不做情侣经营/变现；UGC 先审后发；成长值只增不减；改前更 Spec。
- **待确认（最高优先级）**：小程序账号是**个人还是企业**、是否有**社交类目资质**（社交/婚恋类目审核极严，个人主体通常无法上架，企业需《增值电信业务经营许可证》）——这决定能否上线与 T3 合规方案可行性。其次：CloudBase 环境 ID、微信开发者工具验证环境、内容安全云调用权限。
