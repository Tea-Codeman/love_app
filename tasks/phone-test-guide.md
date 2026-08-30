# 真机实测指南（受限邀请原型 v1）

> 配套 `tasks/launch-readiness.md`（LA 收官）。当前为 M8.1 降级态：个人账号、不公开上架、内容安全 `USE_WX_SECURITY=false` 本地兜底。
> 本指南只覆盖「如何把 v1 跑上真机 + 验收主链路 + 验证受限邀请归因」，不含公开上架（见 launch-readiness §4）。

## 0. 前置条件（一次性）

| 项 | 要求 | 说明 |
|---|---|---|
| 开发者工具 | 微信开发者工具（稳定版） | 导入 `project.config.json` 所在目录 |
| AppID | `wx900385d98d023d6f` | 个人账号；你需是**开发者** |
| 云环境 | `love-app-server-d2fhg32320d65c12` | `src/utils/cloud.js` 已硬编码，工具登录同微信账号即自动连 |
| 手机权限 | 体验者 / 开发者 | 公众平台 → 管理 → 成员管理 → 添加（真机预览/体验版必需） |
| 云函数 | 7 函数 Active | growth/game/chat/match/safety/auth/metrics（M7.1 部署态） |

## 1. 构建与加载（关键坑：dev vs build 目录）

`project.config.json` 的 `miniprogramRoot` = `dist/dev/mp-weixin/`（**dev 目录**）。
但 `npm run build:mp-weixin` 输出 `dist/build/mp-weixin/`（build 目录）。两者源码同源、功能一致，仅 dev 带 sourcemap 便于排错。

**真机实测推荐用 dev 目录（热更新、可断点）：**

1. 终端跑（沙箱内带 session env unset，规避 safe-delete 误清 src/utils）：
   ```bash
   cd /d/Tencent/app
   env -u CODEBUDDY_SESSION_ID -u CLAUDE_SESSION_ID npm run dev:mp-weixin
   ```
   等待编译完成，`dist/dev/mp-weixin/` 生成。
2. 开发者工具导入项目 → 自动加载 `dist/dev/mp-weixin/` → 模拟器可运行即成功。

> 若改为「上传体验版/审核版」：先 `npm run build:mp-weixin`，DevTools「上传」上传的是 `miniprogramRoot`（dev）；要传 build 需临时改 `project.config.json` 的 `miniprogramRoot` 为 `dist/build/mp-weixin/`。**真机实测不必上传，用「预览/真机调试」即可。**

## 2. 真机打开（三选一）

| 方式 | 操作 | 适用 |
|---|---|---|
| 预览 | DevTools 顶部「预览」→ 手机扫二维码 → 自动打开 | 最快，每日有次数限制 |
| 真机调试 | DevTools「真机调试」→ 扫码 → 手机跑 + 控制台日志回传 | 排错首选 |
| 体验版 | 上传后在公众平台「体验版」→ 体验成员扫码 | 给小范围圈子 |

⚠️ 真机首次打开若报「不在以下 request 合法域名」：DevTools「详情 → 本地设置」勾「不校验合法域名」（云函数走微信通道通常无需，但兜底）。

## 3. 核心主链路实测（必做，无外部依赖）

按序走，每步看 DevTools 控制台是否红字、云函数日志是否 500：

1. **隐私门禁**：首次打开跳 `pages/privacy/privacy` → 点「同意并继续」→ `setPrivacyAgreed` 写本地 → 自动进 login。
2. **登录**：`pages/login/login` 点「微信授权登录」→ `bootstrapLogin` → 调 `auth` 云函数写/读 `users`。
3. **社区**：`community` 页浏览 + 发一条帖（M8 `FEATURES.community=true` 已开）。
4. **匹配**：`match` 页看推荐（带 `sharedTags`）。
5. **游戏破冰**：进游戏互动（产生 growth/metrics 事件）。
6. **关系升温**：`relation` 页 → A 发起 `sendConfirmInvite` → B 收全局弹窗（App.vue 应用级轮询，`confirmInvite.js`）→ B `acceptConfirmInvite`。
7. **加微信导流**：关系确认后看导流入口是否展示。

**验收点**：7 步无报错；`users`/`pairs`/`events` 集合有新文档；streak 按北京时间（+8）计（M7.1 已修）。

## 4. 受限邀请归因实测（降级项 · 仅验证接收端）

**现状（务必知会）：** 发送端分享卡片 UI 在个人账号下被封（`community.vue:52-55` 注释），且 M7.2 删 `invite.js` 后无一键生成卡片的代码。**接收端完整**：`App.vue:39-40` 存 `pendingInviter` → `auth.js:13` 登录上报 `inviteCode` → 服务端 `auth/index.js:39-44` 写 `invitedBy`。

**验证方法（任选）：**

- **法 A · DevTools 编译模式（最快，无需真机）**
  1. 工具「编译模式」→ 新增 → 启动参数填 `inviter=<A的OPENID>`。
  2. 编译（模拟 B 从分享进入）→ 走隐私/登录 → B 登录后查云库 `users` 中 B 的 `invitedBy` 是否 = A 的 OPENID。
- **法 B · 真机转发卡片（若可用）**
  1. A 真机把小程序转发给 B（好友对话卡片）。
  2. ⚠️ 当前 `onShareAppMessage` 未定义，卡片**默认不带 `?inviter=`** → 此路暂不通；待 M8.1 达标补回分享 path 后可用。
- **拿 OPENID**：DevTools「调试器 → Storage」搜 `rg_openid`；或云库 `users` 查 `_openid`。

> 验证目标：B 的 `invitedBy` 被正确归因 = A。这证明受限邀请 gate 链路可用，未来补分享 UI 即闭环。

## 5. 验收清单（Checklist）

- [ ] 隐私门禁：未同意跳 privacy 页，同意后不再弹
- [ ] 登录：auth 云函数写 users，openid 落本地
- [ ] 社区发帖成功，community 入口可见
- [ ] 匹配推荐出 `sharedTags`
- [ ] 游戏互动产生事件（events 集合有文档）
- [ ] 关系双向确认：A 发 → B 任意页收弹窗 → B 接受
- [ ] 加微信导流入口在确认后展示
- [ ] 受限邀请归因：B.invitedBy = A（编译模式验证）
- [ ] 控制台无红字、云函数日志无 500
- [ ] streak 跨北京时间 00:00 不算断（M7.1）

## 6. 已知限制 / 遇错处理

| 现象 | 原因 | 处理 |
|---|---|---|
| 打开循环跳 privacy | 未点同意 / storage 清了 | 重新点「同意并继续」 |
| 云函数 48001 | 个人号调 `msgSecCheck` | 当前 `USE_WX_SECURITY=false` 不应触发；若触发是代码误改，回退常量 |
| 分享卡片无 inviter | 个人号分享封禁 + invite.js 已删 | 已知缺口，用编译模式验证归因（§4 法 A） |
| 真机打不开 | 非体验者/开发者 | 公众平台加成员 |
| 预览次数用尽 | 个人号限制 | 改用「真机调试」或上传体验版 |

## 7. 后续（你侧）

1. 实测反馈问题 → 我修。
2. 资质就绪后回复「M8.1 达标」→ 我补 M8.3（flip 常量 + 部署 safety + 真审验收）+ 复原 `onShareAppMessage` 分享卡片 → 提交审核上架。

---
**下一步**：按 §3 走主链路、§4 法 A 验归因。要我把本指南提交进 git 吗？
