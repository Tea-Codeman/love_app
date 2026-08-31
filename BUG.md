# BUG 记录

## 2026-08-30 Relation 页 onShow ReferenceError（已修复，commit 见下方）

### 现象
B 点击弹窗「去处理」跳转关系页后，调试控制台报：

```
ReferenceError: getOpenid is not defined
    at Proxy.onShow (weapp:///pages/relation/relation.js:39:19)
    ...
```

### 根因
M4.4b 重写 `src/pages/relation/relation.vue`（改为消费全局 store `confirmInvite.js`）时，
遗漏了 `import { getOpenid } from '../../utils/storage'`——`onShow` 里仍在调用 `getOpenid()`。

编译期 Vite 不做未定义全局引用的静态检查，因此 `build:mp-weixin` 一直是绿的；
只有运行到关系页 `onShow`（任何进入关系页的方式都会触发，不只是弹窗跳转）才抛 ReferenceError。

### 修复
`relation.vue` 补回 `import { getOpenid } from '../../utils/storage'`。
已全文件扫描确认无其它漏 import 引用；编译通过且产物含 getOpenid。

### 影响版本
`43a42f3`（M4.4b）与 `aee4416`（布局微调）两版均受影响；修复提交为后续 `fix(relation)` 提交。

## 2026-08-31 聊天记录下拉时重复拼接旧消息（已修复）

### 现象
聊天页下拉/消息更新时，已显示的聊天记录被重复追加到底部（同一条消息出现多次）。

### 根因
P1 增量轮询改造后，`loadMessages` 用 `this.messages.concat(incoming)` 追加，但：
1. **无 msgId 去重**：轮询（1.5s）与 `onSend` 发消息都会调 `loadMessages`，二者共享同一 `lastCreatedAt` 游标；当两次调用重叠（网络耗时 > 1.5s 或与发送撞车），会用相同的过期 `since` 各拉一份 `incoming` 并各追加一次 → 已显示消息被重复拼接。
2. 服务端 `_.gt(since)` 本身不重复末条，但前端不去重，所以并发拉取的重复直接进入数组。

### 修复
仅改 `src/pages/chat/chat.vue`（服务端 `chat/index.js` 不动）：
- `loadMessages` 追加时按 `msgId` 去重（`new Set` 比对），杜绝重复拼接。
- 加 `_fetching` 防并发守卫，避免两次拉取共享过期游标（同时省一次云函数调用）。
- `onSend` 改为乐观追加自己刚发的消息（服务端已返回 `msgId`/`createdAt`），不再等轮询回拉；轮询按 msgId 去重不会重复。

### 影响版本
P1 增量轮询提交 `688a00d` 起受影响；修复为后续 `fix(chat)` 提交。

## 2026-08-31 app.wxss 编译失败：WXSS 不支持 `*` 通配符选择器（已修复）

### 现象

启动小程序时 console 报：

```
[ WXSS 文件编译错误] ./app.wxss
./app.wxss(160:1): unexpected token `*`
  158 | /* 尊重减少动效偏好 */
  159 | @media (prefers-reduced-motion: reduce) {
> 160 | * { animation: none !important; transition: none !important;
      | ^
at files://dist\dev\mp-weixin\app.wxss#160(env: Windows,mp,2.02.2608060; lib: 3.17.2)
```

影响面不止「少一条规则」：`app.wxss` 是**整体编译失败**，全局样式全丢（工具类、色彩 token、关键帧全部失效），页面会大面积掉样式。

### 根因

UI 重设计时在 `src/App.vue` 末尾加了无障碍降级：

```css
@media (prefers-reduced-motion: reduce) {
  * { animation: none !important; transition: none !important; }
}
```

这一行踩了两个小程序限制：

1. **WXSS 不支持 `*` 通配符选择器**。微信官方 WXSS 支持的选择器只有 `.class` / `#id` / `element` / `element,element` / `::before` / `::after`；Skyline 的 WXSS 支持矩阵里「通配选择器 `* {}`」明确标记为 ×。编译器在第 160 行直接 `unexpected token '*'`。
2. **`prefers-reduced-motion` 在小程序里根本拿不到**。WebView 渲染层不支持 media query，Skyline 也仅支持 DarkMode。所以哪怕把 `*` 换成选择器列表，这条规则也永远不会生效。

**为什么构建一直是绿的**：WXSS 编译发生在微信开发者工具 / 真机侧，`build:mp-weixin` 只跑 Vite，不做 WXSS 选择器校验。这类问题只有在开发者工具里启动小程序时才暴露——和 2026-08-30 的 `getOpenid is not defined` 是同一类盲区（构建期不检查，运行期才炸）。

### 修复

`src/App.vue` 删除整段 `@media` 块，改留注释说明原因。

**没有改成「显式选择器列表」来保留效果**，理由：该媒体特性在小程序不生效，保留只是伪装成「已处理无障碍」的死代码，反而误导后来人。真要实现，应走 JS 侧读系统设置后给根节点加 class 统一关闭动画。

### 验证

- 全仓 `grep -E "^\s*\*\s*\{"` → 无通配选择器残留。
- `build:mp-weixin` EXIT=0；产物 `app.wxss` 已无 `prefers-reduced-motion` 规则、无 `*`。
- `dist/dev/mp-weixin/app.wxss` 已随 dev watch 重新生成，原 160 行位置只剩说明性注释。

### 影响版本

UI 重设计（`design-system/loveapp` + App.vue token 层）引入；发生在 v0.3.1 之后的工作树态，未进任何 tag。

---

### 同批审查发现并一并修复

| 问题 | 说明 | 处理 |
|---|---|---|
| 成长条标签与节点错位 | 节点按真实阈值定位（0/8/27/60/100%），标签却用 `flex:1` 均分（中心落在 10/30/50/70/90%），最大偏差 23 个百分点；且 S0/S1 仅差 8%，两个 4 字标签（约 72rpx）会重叠 | `growth-bar.vue` 节点改均匀排布（0/25/50/75/100%），标签绝对定位到节点位置，首尾贴边防溢出 |
| 成长条语义错位 | 填充按 `value/150` 直算，会出现「已到 S2 但填充条还没走到 S2 节点」 | 改分段线性映射：按阶段区间插值，保证成长值刚好达标时填充正好抵达该阶段节点 |
| 模板内复杂表达式 | 标签 `active` 用 `nodes.findIndex(...) >= nodes.findIndex(...)` 双重 `findIndex`，难读且每次渲染重复计算 | 简化为 `i <= curIdx`（语义完全等价）；编译产物由复杂表达式变为预计算布尔字段 |
| 死代码 | `pct` computed 模板未使用，其依赖的 `stageProgress` 导入随之无用 | 一并移除 |
| index.vue 底部遮挡 | 已挂固定 tab-bar（110rpx + 安全区），底部仅留 80rpx | 改 180rpx，与其余 4 个 tab 页一致 |
