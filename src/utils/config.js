// src/utils/config.js —— 功能开关（feature flags）
//
// 用法：搁置某功能时把对应开关置 false，入口即隐藏；恢复时置回 true。
// 设计约定：开关只控制「入口显隐」，**不删除页面代码、不动 pages.json 路由**
// （路由保留，深链接/扫码仍可直达，便于内部测试与将来一键恢复）。
//
// 当前状态：
// - community：已开启（true）。M6.4 正式提交（2026-08-30，原为用户真机测试所改）。
//   说明：个人主体 + 社交类目资质尚未就绪，仅 DevTools 可跑；正式上架前需先过资质（M7）。
//   关联：开启后社区入口可见、拉黑入口可用；match.recommend 仍依赖 blocks 过滤（已有黑名单生效）。

export const FEATURES = {
  community: true
}
