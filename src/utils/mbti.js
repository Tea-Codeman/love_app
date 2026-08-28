// src/utils/mbti.js —— MBTI 测评题库、角色卡数据与计分
// 交互与数据结构对齐原型站「同频 · 恋爱小程序原型」：
// 12 题覆盖 EI / SN / TF / JP 四维度（各 3 题），每题两选项直接映射字母。

// 每题：dim=所属维度，a=选项文案，v=选项对应字母（与 a 一一对应）
export const MBTI_TEST = [
  { dim: 'EI', q: '周末你更想怎么过？', a: ['约朋友热闹一整天', '自己待着慢慢充电'], v: ['E', 'I'] },
  { dim: 'EI', q: '聚会里你通常是？', a: ['主动热场的人', '安静听多于说'], v: ['E', 'I'] },
  { dim: 'EI', q: '认识新朋友让你？', a: ['兴奋又充满能量', '有点消耗需要回血'], v: ['E', 'I'] },
  { dim: 'SN', q: '你更信任？', a: ['实际经验和细节', '直觉和可能性'], v: ['S', 'N'] },
  { dim: 'SN', q: '听故事你更在意？', a: ['发生了什么（事实）', '背后意味着什么'], v: ['S', 'N'] },
  { dim: 'SN', q: '计划旅行你偏好？', a: ['攻略做满再出发', '走到哪算到哪'], v: ['S', 'N'] },
  { dim: 'TF', q: '朋友找你吐槽，你先？', a: ['帮 TA 分析对错', '先共情陪着 TA'], v: ['T', 'F'] },
  { dim: 'TF', q: '做决定更靠？', a: ['逻辑和利弊', '感受和价值'], v: ['T', 'F'] },
  { dim: 'TF', q: '吵架时你更在意？', a: ['把道理说清楚', '别伤了感情'], v: ['T', 'F'] },
  { dim: 'JP', q: '截止日期前你？', a: ['提前搞定才踏实', '最后冲刺也有劲'], v: ['J', 'P'] },
  { dim: 'JP', q: '你的桌面通常？', a: ['整齐有秩序', '乱中有序随性'], v: ['J', 'P'] },
  { dim: 'JP', q: '约饭你更爱？', a: ['提前定好时间地点', '到时候看心情再定'], v: ['J', 'P'] }
]

// 16 型预设角色卡（color=主题色，tags=三个关键词，line=角色台词）
export const MBTI_ROLES = [
  { type: 'INTJ', name: '夜航', animal: '猫头鹰', color: '#5b6fb0', tags: '冷静·独立·谋略', line: '我先看清全局，再决定靠近谁。' },
  { type: 'INTP', name: '量子', animal: '水獭', color: '#4fb0a5', tags: '好奇·脑洞·较真', line: '别急着定义我，我还在迭代。' },
  { type: 'ENTJ', name: '将星', animal: '狮子', color: '#e0a23c', tags: '领袖·果断·目标感', line: '感情也要讲效率和方向。' },
  { type: 'ENTP', name: '火花', animal: '狐狸', color: '#e8743b', tags: '机敏·爱辩·点子王', line: '跟我吵一架，也许就心动了。' },
  { type: 'INFJ', name: '引灯', animal: '鹿', color: '#6fae8e', tags: '温柔·理想·洞察', line: '我想遇见一个灵魂同频的人。' },
  { type: 'INFP', name: '诗眠', animal: '兔', color: '#c98bd0', tags: '浪漫·敏感·共情', line: '世界很吵，只想和你安静待着。' },
  { type: 'ENFJ', name: '暖阳', animal: '金毛', color: '#f0b94e', tags: '治愈·鼓舞·照料者', line: '你的好，值得被好好对待。' },
  { type: 'ENFP', name: '泡泡', animal: '松鼠', color: '#f07aa8', tags: '活泼·自由·气氛组', line: '生活要有火花，爱情也是！' },
  { type: 'ISTJ', name: '磐石', animal: '熊', color: '#6b7f9e', tags: '靠谱·守序·稳定', line: '说到的，我都会做到。' },
  { type: 'ISFJ', name: '暖炉', animal: '羊', color: '#d9a86c', tags: '细心·守护·体贴', line: '把你照顾好，我就安心了。' },
  { type: 'ESTJ', name: '标尺', animal: '牛', color: '#a87c52', tags: '务实·条理·责任人', line: '承诺的事，按时按质交付。' },
  { type: 'ESFJ', name: '糖果', animal: '企鹅', color: '#6bb6e8', tags: '热心·周全·粘人', line: '你在不在，我都想黏着你。' },
  { type: 'ISTP', name: '匠隐', animal: '狼', color: '#5d6b78', tags: '冷静·动手·低调', line: '不多说，用行动证明。' },
  { type: 'ISFP', name: '晚风', animal: '猫', color: '#e8a9b0', tags: '艺术·随性·自在', line: '顺其自然，才最舒服。' },
  { type: 'ESTP', name: '疾风', animal: '豹', color: '#c4cf3c', tags: '行动·刺激·敢闯', line: '想就去追，别等。' },
  { type: 'ESFP', name: '星光', animal: '孔雀', color: '#3fb6c4', tags: '热闹·享受·吸睛', line: '有我在，就不会冷场。' }
]

// 计分：answers 为逐题所选字母数组（如 ['E','I','N',...]）
// 各维度取票数高者；平局时取前一个字母（E / S / T / J），与原型站一致。
export function calcMbti(answers) {
  const s = { E: 0, I: 0, S: 0, N: 0, T: 0, F: 0, J: 0, P: 0 }
  ;(answers || []).forEach(v => { if (v in s) s[v]++ })
  return (s.E >= s.I ? 'E' : 'I')
       + (s.S >= s.N ? 'S' : 'N')
       + (s.T >= s.F ? 'T' : 'F')
       + (s.J >= s.P ? 'J' : 'P')
}

// 取角色卡数据；未知类型回退到第一个，避免页面渲染 undefined
export function getRole(type) {
  return MBTI_ROLES.find(r => r.type === type) || MBTI_ROLES[0]
}
// 注：MBTI 参与撮合的"维度契合加分"只存在于服务端
// （cloudfunctions/match/index.js 的 scoreMbtiFit）——打分是权威逻辑，不放在客户端。
