# 上架 Playbook（未来公开上架切换清单）

> 适用前提：v1 当前定位为**个人自用小工具，不公开上架**（2026-08-31 用户决策）。本清单是**未来资质就绪后**公开上架的标准操作，目标是把切换成本压到最低。
> 配套优化：O1 开关外置（`server_config.launch.useWxSecurity`）、O4 隐私版本+强制重同意、O2 图像异步回调（待补）、O6 分享/邀请入口（待恢复）。

## 0. 一句话结论

公开上架 = 用户侧资质就绪 + 控制台翻 1 个开关（O1，免重部署）+ 补图像异步回调（O2）+ 恢复分享入口（O6）+ 隐私备案。文本真审无需改业务代码。

## 1. 前置依赖（用户侧 · 微信公众平台）

- [ ] **M8.1 资质**：账号升级企业/个体工商户主体（个人主体通常无法授社交类目）。
- [ ] **社交类目**：小程序类目选「社交-婚恋交友」并通过资质审核。
- [ ] **内容安全权限**：开通 `cloud.openapi.security.msgSecCheck` / `mediaCheckAsync`（通常需企业主体）。
- 完成后**通知 Agent 核验**：调用 `safety.checkText` 送一段违规文本，确认返回非 `48001`（权限就绪），再继续。

## 2. 切换步骤（按顺序）

### 步骤 1 · 翻内容安全开关（O1 · 免重部署）
- CloudBase 控制台 → 数据库 → `server_config` 集合 → 文档 `_id: launch`。
- 将字段 `useWxSecurity` 由 `false` 改为 `true`。
- **无需改代码、无需重部署**：`safety` 函数以 60s TTL 内存缓存读取该文档，控制台改后至多 1 分钟内生效。
- （可选）为立即生效，重部署一次 `safety` 即可；O1 设计上不强制。

### 步骤 2 · 补图像异步回调（O2 · 必补，公开上架前）
- 当前 `checkImage` 在 `useWxSecurity=true` 时走 `wxCheckImage`（`mediaCheckAsync`），但 **`mediaCheckAsync` 是异步的，返回值不等于判定结果**，当前实现不正确。
- 需新增一个回调云函数（或 `safety` 内 `action: 'imageCallback'`），接收微信异步推送的审核结果，按 `mediaId`/`traceId` 标记内容（reports/内容集合），并联动拦截。
- 接步骤 1 开关后自动生效。社区有图片，**真上架前必须补**，否则图片未经真审。

### 步骤 3 · 文本真审验收（M8.3）
- 构造违规文本（如样本违规词）→ `checkText` 应返回 `pass:false`（拒发）。
- 构造正常文本 → 应 `pass:true`（放行）。
- 确认全程无 `48001`（步骤 1 前置已核验）。

### 步骤 4 · 恢复分享/邀请入口（O6 · 产品决策）
- 个人账号下微信禁止转发，`community.vue` 的 `onShareAppMessage` 已移除、`src/utils/invite.js` 已删（M7.2）。
- 企业资质就绪后：重新加回 `onShareAppMessage`（分享卡片带 `?inviter=`）+ 邀请码生成逻辑（恢复 invite.js 或等价实现）。
- 受限邀请（预览二维码）转为公开裂变。

### 步骤 5 · 隐私备案
- `src/pages/privacy/privacy.vue` 第 32 行运营邮箱 `loveapp-privacy@example.com` 替换为**真实运营邮箱**。
- 在微信公众平台按要求提交隐私协议/备案。
- 政策有重大变更时**提升 `PRIVACY_VERSION`**（`src/utils/storage.js`，当前 `1.0.0`）→ `App.vue` 入口自动比对版本，落后用户强制重弹门禁（O4 已就绪）。

### 步骤 6 · 提交审核 + 上架
- 微信公众平台「提交审核」→ 过审后发布。
- 灰度建议：先小流量，观察 `reports`/`events` 真审数据正常后再全量。

## 3. 验证清单（Checklist）

- [ ] 资质三项就绪 + Agent 核验 msgSecCheck 非 48001
- [ ] `server_config.launch.useWxSecurity = true`（O1）
- [ ] 图像异步回调已接（O2），图片经真审
- [ ] 文本真审验收 PASS（违规拒/正常放，无 48001，M8.3）
- [ ] 分享/邀请入口恢复（O6）
- [ ] 隐私真实邮箱 + 备案；`PRIVACY_VERSION` 机制可用（O4）
- [ ] 提交审核过审 + 发布

## 4. 回滚

- 任一步异常：将 `server_config.launch.useWxSecurity` 改回 `false` → 1 分钟内回落本地关键词兜底（O1 设计即为此），无需改代码/重部署。
- 分享入口如需收回：再次移除 `onShareAppMessage`（回到受限邀请）。

## 5. 当前已就绪（自用期即受益）

- O1：`server_config` 集合 + `launch` 文档已建（默认值 `useWxSecurity:false, requireInvite:false`）。
- O4：隐私版本机制已上线（当前 `1.0.0`）。
- M8.2 隐私正式文案、M8.4 复合索引：已落地。
- 主链路（社区→游戏→关系→加微信）：M0–M7 真机验收 PASS，配对不经分享。
