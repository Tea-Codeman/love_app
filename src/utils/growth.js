// src/utils/growth.js —— F5 关系成长前端工具（M3.1/M3.2）
// 服务端是权威源（pairs 集合），本文件只做**展示层派生**：
// 阶段由 growthValue 读时计算，避免 pairs.stage 缓存漂移导致的显示不一致。
// 阈值必须与 cloudfunctions/growth/index.js 的 STAGE_THRESHOLDS 保持一致。

export const STAGE_THRESHOLDS = [
  { stage: 'S4', min: 150, label: '心动确认', desc: '已解锁联系方式' },
  { stage: 'S3', min: 90, label: '互相在意', desc: '只差一步就能加微信' },
  { stage: 'S2', min: 40, label: '渐入佳境', desc: '聊天越来越自然' },
  { stage: 'S1', min: 12, label: '初步破冰', desc: '已解锁轻聊' },
  { stage: 'S0', min: 0, label: '初相识', desc: '一起玩一局开始升温' }
]

// 成长值 → 阶段 key
export function stageOf(growthValue) {
  const v = Number(growthValue) || 0
  for (const t of STAGE_THRESHOLDS) {
    if (v >= t.min) return t.stage
  }
  return 'S0'
}

// 阶段元信息（找不到时回退 S0，保证渲染永不崩）
export function stageInfo(stage) {
  return STAGE_THRESHOLDS.find(t => t.stage === stage) || STAGE_THRESHOLDS[STAGE_THRESHOLDS.length - 1]
}

// 当前阶段内的进度百分比（0–100），用于进度条
export function stageProgress(growthValue) {
  const v = Number(growthValue) || 0
  const idx = STAGE_THRESHOLDS.findIndex(t => t.stage === stageOf(v))
  const cur = STAGE_THRESHOLDS[idx]              // 当前阶段（升序表中靠前的那个）
  const next = STAGE_THRESHOLDS[idx - 1]         // 下一阶段（阈值更高，在表中更靠前）
  if (!next) return 100                          // S4 已满级
  const span = next.min - cur.min
  if (span <= 0) return 100
  const pct = Math.floor(((v - cur.min) / span) * 100)
  return Math.max(0, Math.min(100, pct))
}

// 距离下一阶段还差多少成长值（S4 返回 0）
export function toNextStage(growthValue) {
  const v = Number(growthValue) || 0
  const cur = stageOf(v)
  const idx = STAGE_THRESHOLDS.findIndex(t => t.stage === cur)
  const next = STAGE_THRESHOLDS[idx - 1]
  if (!next) return 0
  return Math.max(0, next.min - v)
}

// 阶段顺序比较：a 是否达到 b（用于「S1 解锁轻聊」「S4 解锁联系方式」这类门禁判断）
export function reached(stage, target) {
  const order = ['S0', 'S1', 'S2', 'S3', 'S4']
  return order.indexOf(stage) >= order.indexOf(target)
}
