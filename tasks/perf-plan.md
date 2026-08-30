# 性能改进方案（perf-plan）

> 状态：**方案已确认（2026-08-31），进入实现阶段**。约束：先确定方案再改代码（已满足）。
> 对应请求：① 社区帖子获取慢（详情评论 + 信息流）② 匹配大厅推荐列表慢 + 游戏匹配慢 ③ 聊天消息同步慢。
> 决策记录（用户拍板）：
> - 聊天：**P1 基础版** = 增量轮询 + 间隔 1.5s，**不动安全规则**（进阶版 watch 真实时留后续）。
> - recommend：**方案 X** = users 建索引 + 游标分页，维持 100 上限（方案 Y 候选池/向量匹配 v1 不做）。
> - 方案存档：写入本文档。

## 0. 诊断方法（诚实声明）
- 本环境无法跑真机/DevTools 计时，故「测量」= 读真实代码路径 + 与 `HANDOFF.md:248` 既有「🟡 中·性能」待办交叉印证。
- 落地时每项改动**单独测前后**（`console.time` / DevTools Network 瀑布），中性改动一律回退（性能铁律）。

## 1. 三大慢点根因（含代码证据）

### ① 社区帖子（详情评论 + 信息流）
- **主因**：`comments` 缺 `{postId, auditStatus, createdAt}`、`posts` 缺 `{auditStatus, createdAt}`。CloudBase NoSQL 中 `.where().orderBy()` 无索引会退化为**全集合扫描 + 内存排序**，每次开详情/刷信息流都扫全表 → 慢。命中 `HANDOFF.md:248` 已列但**从未建**的索引待办。
  - 证据：`cloudfunctions/community/index.js:55-63`（listPosts）、`:114-121`（getPostDetail 评论）。
- **次因**：评论 `limit(100)` 无分页，首屏必拉满 100（community:119）。
- **非问题**：detail.vue 已合并为单次云函数调用（community 一次取 post+comments，Promise.all）；posts 已 denormalize 作者昵称/头像 → 无 N+1。

### ② 匹配大厅 + 游戏匹配
- **主因**：`recommend` 每次 `users.where({openid: _.neq(OPENID)}).limit(100).get()` 拉全量用户在内存打分（match/index.js:209-214）。`_.neq` 无法走单字段索引 → **每次推荐都是一次全 users 扫描**；用户 >100 时推荐还不完整。
- **次因**：`getBlockedIds`(2 查)/`getMatchedOpenids`(1 查)/`aggregateGrowthStats`（分批 pairs+matches 查询）随候选放大；`matches` 的 `_.or([{userA,status},{userB,status}])` 若无 `{userA,status}`/`{userB,status}` 索引也扫表。
- **对局体感**：`src/utils/realtime.js:43` 游戏状态靠 **1.5s 轮询**兜底（watch 受限时），对端状态最长 1.5s 才同步。

### ③ 聊天消息同步
- **主因（体感）**：`src/pages/chat/chat.vue:123-129` 每 **3000ms** 轮询一次 `loadMessages` → 对方消息最长 3s 才出现。
- **量级**：`chat.list` 每次返回最多 50 条并**整体替换**数组 → 无新消息也每 3s 重拉全量 + 重渲染（chat/index.js:216-220）。
- **扫描**：`messages` 缺 `{pairKey, createdAt}` → 每次轮询 `where({pairKey}).orderBy('createdAt','desc')` 退化为全 messages 扫描（消息积累后变慢）。

## 2. P0 · 复合索引（控制台建，零代码风险）
> ⚠️ CloudBase NoSQL 索引**只能控制台建**（当前 MCP 无建索引能力：`readNoSqlDatabaseStructure` 只读、`writeNoSqlDatabaseContent` 只写文档）。下列规格供用户在 CloudBase 控制台 → 数据库 → 对应集合 → 索引 手动创建；创建后 `listIndexes` 复核状态 ready。
> 命中 `HANDOFF.md:248` 既有待办（comments/posts 两条已列），补齐其余。

| 集合 | 索引字段（方向） | 命中查询 |
|---|---|---|
| comments | `postId:1, auditStatus:1, createdAt:1` | 详情评论（community:116） |
| posts | `auditStatus:1, createdAt:-1`（+ 可选 `topicId:1, createdAt:-1`） | 信息流（community:55） |
| messages | `pairKey:1, createdAt:-1` | 聊天 list / send 末条（chat:216、143） |
| games | `invitedUserId:1, state:1, createdAt:-1` | 待接受邀请（match:332） |
| matches | `userA:1, status:1` / `userB:1, status:1` | 推荐过滤 / accept 查重（match:79、283） |
| pairs | `pairKey:1` | 成长聚合（match:139） |
| users | `createdAt:-1`（供 recommend 游标，见 P2） | recommend 游标分页（match:209） |

**预期**：① 详情/信息流、③ 聊天 list 的「全表扫描」直接变索引命中，延迟从随数据量线性增长降为亚秒级（典型 <100ms）。ROI 最高、风险最低。
**验证**：控制台建索引后，DevTools 按对应 `where+orderBy` 跑查询看执行计划是否走索引（无全表扫告警）；云函数调用 `console.time` 计时。

## 3. P1 · 聊天增量轮询 + 1.5s（不动安全规则）
- `cloudfunctions/chat/index.js` `list` 增加 `since`（传最后一条 `createdAt` 或 `msgId`）→ 仅返回 `createdAt > since` 的新消息；无 `since` 时退回全量（兼容首屏）。
- `src/pages/chat/chat.vue`：
  - `loadMessages` 收到增量后 **append** 而非整体替换；记录 `lastCreatedAt`。
  - 轮询间隔 3000ms → **1500ms**（与游戏实时一致）；仅 `unlocked` 且页面前台时轮询。
- **预期**：消息延迟 3s→1.5s；每次轮询仅传增量（渲染/带宽大幅下降）。
- **进阶（留后续，本期不做）**：给 `messages` 配安全规则 `read: auth.openid ∈ {senderId, receiverId}`，前端改 `db.collection('messages').where({pairKey}).watch()` 真实时，彻底去轮询。需改安全规则 + 复核不泄露他人消息 + watch 受限仍保留轮询兜底。

## 4. P2 · recommend 游标分页（方案 X）
- `cloudfunctions/match/index.js` `recommend`：
  - 去掉 `where({ openid: _.neq(OPENID) })` 全扫；改为**游标分页**：`users.where({ createdAt: _.lt(cursor) }).orderBy('createdAt','desc').limit(100)`（依赖 P0 的 `users.createdAt` 索引）；首页 `cursor = Date.now()`，内存过滤 `blocked/matched/自己` 后取满 `limit` 即止（不足 100 且仍有候选则翻下一页，但 v1 用户量小通常一页够）。
  - 保留 `limit=100` 上限（v1 用户量小，推荐完整性不变）。
- **预期**：大厅列表从「全 users 扫描」变「索引游标 ≤100」，延迟稳定亚秒级。
- **不做（方案 Y）**：预计算候选池 / 离线打分写入 `candidates` 集合 —— 架构级、v1 收益低、复杂度高。

## 5. P3（可选）· 削冗余读
- `cloudfunctions/game/index.js` `joinGame`/`submitAnswer` 在 `update` 后又 `get` 同 doc（:111、:241）→ 改为直接返回内存已构造的 `updated`（或不再回读），省 1 次读/答案。
- `community.getPostDetail` 评论 `limit(100)` 改首屏 20–30 + 下拉加载更多。
- 优先级低于 P0–P2，且不解决主因，建议 P0–P2 落地后顺手做。

## 6. 不做（避免过度设计）
- v1 上方案 Y（候选池/向量匹配）。
- 社区/聊天加本地长缓存（实时性要求高、易脏），先靠索引 + 增量解决。

## 7. 落地顺序与验证
按性能铁律：**每改一项，单独测前后（同环境、同数据量），中性改动回退。**
1. **P0 索引**（影响面最大、零代码、命中既有待办）→ 测 ① ③。
2. **P1 聊天增量轮询**（体感最明显）→ 测 ③。
3. **P2 recommend 游标** → 测 ② 大厅。
4. **P3 削冗余**（可选）。

**提交策略**：按关注点原子提交（chat / match / docs），沿用「提交即回滚锚点」；推 `origin/main`。
**运行时计时**：真机/DevTools 计时由用户在预览环境验证（本环境无法跑真机）。

## 8. 关联
- `HANDOFF.md:248`（性能待办，含 comments/posts 索引）
- `tasks/launch-readiness.md`（M8.4 已建 reports/events 索引，方法可复用）
- 代码入口：community/index.js、match/index.js、chat/index.js、chat.vue、realtime.js

## 9. 实施状态（已落地 / 待办）
- [x] **P1 聊天增量轮询** → commit `688a00d`（chat/index.js `since` + chat.vue append/1.5s）
- [x] **P2 recommend 游标** → commit `0c681bb`（match/index.js `createdAt` 游标 + 内存排除自己）
- [x] **P3 game 削冗余读** → commit `281a4f9`（joinGame/submitAnswer 不再回读同 doc）
- [x] **P3 community 评论首屏分页** → commit `efb305b`
  - `getPostDetail` 评论 `limit(100)→limit(30)`，返回 `commentHasMore`
  - 新增 `listComments` action（page 懒加载，命中 comments 复合索引）
  - detail.vue 首屏 30 条 + 「加载更多评论」按钮；标题用 `post.commentCount` 真实总数
- [x] **P0 索引（复核结论 2026-08-31，二次复核通过）** → 第一次复核发现 matches 缺 userB 索引；用户补建后二次 `listIndexes` 复核全绿：
  - ✅ 完全命中：comments（`postId:1,auditStatus:1,createdAt:1`）、messages（`pairKey:1,createdAt:1`）、games（`invitedUserId:1,state:1,createdAt:1`）、pairs（`pairKey:1`）、users（`createdAt:1`）。方向 1/-1 不影响排序（可逆扫）。
  - ✅ matches 已修：现 `uA`(userA:1,status:1) + `uB`(userB:1,status:1) 两个独立索引（旧 `optimization` 三字段复合已删）。`match/index.js` 全部 3 处 `_.or` 查询（:80、:101、:289）的 userA/userB 两分支分别命中 uA/uB，无全扫。
  - ⚠️ posts 非阻塞：建的 `auditStatus:1,createdAt:1,topicId:1` 主信息流命中；话题筛选 `where({auditStatus,topicId})` 因 topicId 在尾部键、createdAt 在中间，无法在排序前用 topicId 等值 → 退化为审计分区内内存过滤。v1 话题列表量小，非阻塞；可选补 `{topicId:1,createdAt:-1}`。
  - 💡 可选补强（非本次范围）：`users.openid` 无独立索引，`community/match` 中 `where({openid})` 作者查询走全 users 扫；v1 量小可忽略，未来可在 users 建 `openid` 唯一索引。
  - **结论：P0 全量释放。** ① 社区详情/信息流、② 大厅 recommend、③ 聊天 list 均由全表扫描变索引命中；P1/P2/P3 代码侧收益现全部生效。
- 远端 HEAD：`origin/main = efb305b`
