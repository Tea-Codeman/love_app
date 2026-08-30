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
