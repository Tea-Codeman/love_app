// src/utils/config.js —— 功能开关（feature flags）
//
// 用法：搁置某功能时把对应开关置 false，入口即隐藏；恢复时置回 true。
// 设计约定：开关只控制「入口显隐」，**不删除页面代码、不动 pages.json 路由**
// （路由保留，深链接/扫码仍可直达，便于内部测试与将来一键恢复）。
//
// 当前状态：
// - community：已搁置（个人主体 + 社交类目资质未就绪；分享能力被封禁）。
//   关联说明见 HANDOFF.md「社区搁置决策」：隐藏后全应用将无拉黑入口，
//   而 match.recommend 仍依赖 blocks 过滤（已有黑名单生效，但无法新增）。

export const FEATURES = {
  community: false
}
