# M8.1 真机实测指南（降级态：个人账号 · 受限邀请原型）

> 适用：M8.1 资质申请中、走个人账号「受限邀请原型」路径（不公开上架）。
> 目标：在真机/真机调试上跑通主链路，验证 v1 可交付。
> 更新：2026-08-31（基于代码实读校准——配对不经分享，分享入口个人账号禁用）

---

## 0. 先厘清：「M8.1 真机实测」到底测什么

M8.1 本身是**微信后台资质操作**（账号主体升级 + 社交类目），Agent 侧无法真机测。
你实际能测的是降级后的**主链路灰度验证**。二者关系：

| 项目 | 是否真机可测 | 说明 |
|---|---|---|
| 主链路：社区→游戏→关系→加微信 | ✅ 现在就能测 | 配对走 `match.recommend`/`accept`，不依赖分享 |
| `?inviter=` 分享裂变归因 | ❌ 个人账号不可测 | 平台禁分享（`community.vue:54` 已移除 `onShareAppMessage`）；前端 `invite.js` 已删；需 M8.1 资质就绪后恢复 |
| 账号主体/社交类目资质 | ❌ 后台操作 | 你在微信公众平台做，做完回「M8.1 达标」 |

**结论**：本轮真机实测 = 用「预览二维码」在小圈子（2 人起）跑通主链路。分享裂变留待资质就绪。

---

## 1. 前置准备（一次性）

### 1.1 构建产物（本地）
```bash
cd D:\Tencent\app
npm run build:mp-weixin        # 产出 dist/build/mp-weixin/（生产构建）
# 或开发联调用：
npm run dev:mp-weixin          # 产出 dist/dev/mp-weixin/（HMR，project.config.json 的 miniprogramRoot 指向这里）
```
构建成功标志：`DONE Build complete`（EXIT=0）。

### 1.2 微信开发者工具导入
- 打开**微信开发者工具** → 导入项目 → 目录选 `D:\Tencent\app`（自动读 `project.config.json`，`appid=wx900385d98d023d6f`，`miniprogramRoot=dist/dev/mp-weixin/`）。
- 云函数根 `cloudfunctions/` 已自动识别；**云函数已在 M7 部署到 CloudBase，真机直接调线上函数，无需本地上传**（除非你改了云函数代码）。

### 1.3 CloudBase 集合前置（关键，否则 match 报 500）
真机跑 `match` 前，确认 CloudBase 控制台（环境 `love-app-server-d2fhg32320d65c12`）已存在以下集合；缺失则手动创建（空集合即可）：
- `users`（登录时自动建，可省）
- **`matches`**（⚠️ `match/index.js` 注明需手动建，否则 `accept` 报 500）
- **`games`**（⚠️ 同上，`accept` 自动建 waiting 局，集合不存在会失败）
- `pairs`（关系成长，缺失时自动回退 matches 聚合，建议建）
- `events` / `reports`（M8.4 已建索引，必存在）
- `blocks`（拉黑，缺失时拉黑失效但不阻断主链路）

> 验证：开发者工具「云开发」→ 数据库，逐一看列表。缺 `matches`/`games` 立刻补建。

### 1.4 隐私 + 登录
- 首次进入弹**隐私政策页**（`privacy.vue`，M8.2 已升级合规文案）→ 点同意 → 写 `rg_privacy_agreed`。
- 随后静默登录（`auth.bootstrapLogin`）→ 写 `users` 文档。两测号都需走一遍。

---

## 2. 真机预览（两种入口）

### 方式 A：预览二维码（推荐，最接近真实用户）
开发者工具顶部点 **「预览」** → 手机微信扫码 → 进入小程序。
- 优点：真机环境、真机渲染。
- 限制：无法看 console；改代码需重新构建+预览。

### 方式 B：真机调试（需看日志时用）
开发者工具顶部点 **「真机调试」** → 手机微信扫码 → 手机运行、电脑看 console/vConsole。
- 优点：实时日志、可断点。
- 适合：验证 `?inviter=` 归因、埋点 `match_accept` 是否上报。

> 两测号都要各自扫码进入（小圈子 = 你 + 1 位朋友，各扫一次预览码）。

---

## 3. 主链路真机 Walkthrough（逐步入门验证点）

准备：测号 A、测号 B 两部手机都已完成 §1.4 登录。

### 步骤 1 · 匹配推荐（A 侧）
- A 进 `pages/match/match` → 点「推荐」→ 调 `match.recommend`。
- ✅ 验证：列表出现候选 B（按兴趣/同城/MBTI 打分排序）；无自己、无已匹配、无拉黑。
- ❌ 若空列表：检查 B 是否已登录（users 有 B 文档）；若报 500「集合未创建」→ 回 §1.3 补 `matches`/`games`。

### 步骤 2 · 发起一起玩（A→B）
- A 点候选 B「一起玩」→ 调 `match.accept` → 建 `matches[active]` + 自动建 `games[waiting]`（invited=B）。
- ✅ 验证：A 见「等待对方加入…」；B 端 `match.myPending` 收到局邀。
- ✅ 埋点：后端 `match_accept` 入 `events`（SC1/SC2/SC3 分母，关系维度带 `pairId`）。

### 步骤 3 · B 加入 + 玩默契问答
- B 在 match 页「待接受」点加入 → `game.joinGame` 载入题目 → 各自答题 → 出 `tacitCount`。
- ✅ 验证：双方进度独立不阻塞；结束显「默契 X/N 题」+「完成破冰」。
- ✅ 成长：玩完 `pairs` 写入 `growthValue`（GAME_GROWTH）、`gameCount+1`。

### 步骤 4 · 关系确认「在一起」（→ 解锁加微信）
- 关系达 **S1**（growthValue ≥ 12，约 1 局）后，进 `pages/relation/relation` → A 发起「在一起确认邀请」。
- B 任意页面收原生弹窗（`App.vue` `handleNewInvite` 全局投递）→ 同意 → 落里程碑 `relation_confirmed` + 解锁联系方式。
- ✅ 验证：B 弹窗出现并可同意；同意后 relation 显「我们在一起了 🎉」；`contact` 页可看联系方式（加微信入口）。
- ✅ 防错：邀请超时会自动失效（`inviteRemain` 倒计时）；过期弹「请重新发起」。

### 步骤 5 · 社区发帖/浏览（先审后发）
- 进 `pages/community/community` → 发帖（`post.vue`，maxlength 500）。
- ✅ 验证：文本经本地安全兜底（`USE_WX_SECURITY=false` → `checkText` 走关键词，不调 `msgSecCheck`，无 48001）；发帖入 `reports` 待审流（先审后发）。
- ⚠️ 个人账号下社区页**无「邀请好友」入口、无转发**（分享被禁，见 §0）。

### 步骤 6 · 配对聊天
- 进 `pages/chat/chat` → 双方互发消息（`chat` 云函数）。
- ✅ 验证：消息收发；双向拉黑任一方后互发被拦（`chat/index.js` 拉黑检测）。

---

## 4. `?inviter=` 归因测试（降级下唯一能验的路径 = DevTools 注入）

分享卡片在个人账号下生成不了，但**归因代码仍在**（`App.vue:39-40` 读 `query.inviter` + `auth.js` 登录时写 `invitedBy`）。可用开发者工具手动注入启动参数模拟「从分享链接进入」：

1. 开发者工具 → 编译模式（顶部「普通编译」旁下拉）→ **「添加编译模式」**。
2. 启动参数填：`inviter=<B的openid>`（B 的 openid 从云函数日志或 `users` 文档取）。
3. 编译运行 → A 首次进入，`onLaunch` 把 `inviter` 存入 `rg_pending_inviter` → 登录时 `bootstrapLogin` 带 `inviteCode` → 服务端写 `invitedBy`。
4. ✅ 验证：DevTools console 看 `auth` 调用入参含 `inviteCode`；`users` 文档 A 的 `invitedBy` = B openid。

> 这条仅验证「归因链路没断」，不影响配对主流程。分享 UI 恢复待 M8.1 资质就绪（重加 `onShareAppMessage` + community「邀请好友」）。

---

## 5. 已知限制 / 降级态提醒

- 🚫 **无公开分享**：个人账号平台禁转发，`community.vue` 已移除 `onShareAppMessage`；裂变（`?inviter=` 卡片）冻结至 M8.1 达标。
- 🚫 **内容安全本地兜底**：`USE_WX_SECURITY=false`，脏话/敏感词靠本地关键词，非微信真审；M8.3 资质就绪后 flip。
- 🚫 **不提审不上架**：当前仅预览二维码小范围；公开搜索/扫码见需企业主体+社交类目。
- ✅ **主链路完整可用**：匹配/游戏/关系/社区/聊天/加微信解锁全部在线可测。

---

## 6. 真机验收清单（打勾即算 M8.1 灰度通过）

- [ ] §1.3 集合 `matches`/`games` 已建，match 不报 500
- [ ] A 推荐出 B；A 发起 B 收到局邀
- [ ] 双方玩完默契问答，relation 显 S1+「在一起」可确认
- [ ] B 弹窗同意 → 解锁 contact（加微信入口可见）
- [ ] 社区发帖经本地安全校验成功入待审
- [ ] 配对聊天收发正常；拉黑任一方后互发被拦
- [ ] （可选）DevTools 注入 `inviter=` 验归因链路
- [ ] 两测号均无崩溃/白屏；vConsole 无红色报错

> 清单全勾 = v1 受限邀请原型验证通过。随后你侧资质就绪回「M8.1 达标」，我落 M8.3（内容安全切真审）并请签字放行进公开上架。
