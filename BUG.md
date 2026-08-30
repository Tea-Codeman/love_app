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
