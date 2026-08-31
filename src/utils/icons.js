// src/utils/icons.js —— 线性图标（Lucide 风格，24x24，stroke 颜色可注入）
//
// 小程序里 emoji 不能当功能图标用（跨平台字形不一致、无法受设计令牌控制），
// 统一走「内联 SVG → data URI」，颜色由调用方注入，避免为每个状态准备多份切图。
// 注意：拼进 data URI 前必须 encodeURIComponent（'#' 等字符会截断 URI）。

const PATHS = {
  // 底部导航
  community: "<path d='M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.5-.8L3 21l1.9-5.5A8.38 8.38 0 0 1 4 11.5 8.5 8.5 0 0 1 12.5 3 8.38 8.38 0 0 1 21 11.5z'/>",
  match: "<path d='M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z'/>",
  relation: "<path d='M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1'/><path d='M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1'/>",
  profile: "<path d='M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2'/><circle cx='12' cy='7' r='4'/>",
  game: "<rect x='3' y='3' width='18' height='18' rx='4'/><circle cx='8.5' cy='8.5' r='1.5'/><circle cx='15.5' cy='15.5' r='1.5'/><circle cx='15.5' cy='8.5' r='1.5'/><circle cx='8.5' cy='15.5' r='1.5'/>",
  // 资料字段
  city: "<path d='M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z'/><circle cx='12' cy='10' r='3'/>",
  age: "<rect x='3' y='4' width='18' height='18' rx='2'/><path d='M16 2v4M8 2v4M3 10h18'/>",
  gender: "<circle cx='12' cy='12' r='9'/><path d='M12 7a5 5 0 0 1 0 10'/>",
  wechat: "<path d='M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.5-.8L3 21l1.9-5.5A8.38 8.38 0 0 1 4 11.5 8.5 8.5 0 0 1 12.5 3 8.38 8.38 0 0 1 21 11.5z'/>",
  sparkle: "<path d='M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z'/><path d='M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z'/>",
  pen: "<path d='M12 20h9'/><path d='M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z'/>",
  settings: "<circle cx='12' cy='12' r='3'/><path d='M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z'/>"
}

/**
 * 生成可换色的 SVG data URI
 * @param {string} name  PATHS 中的图标名，未知名返回空图形（不报错，避免整页崩）
 * @param {string} color 描边色，十六进制
 * @param {number} size  画布边长（px，渲染尺寸由组件 CSS 控制）
 */
// 微信小程序 <image> 组件对「URL-encoded SVG data URI」不渲染（官方社区确认，
// 只有 base64 编码的 data URI 能正常显示）。故这里统一输出 base64，
// SVG 内不预编码——base64 会对所有字符（含 #）一并转义，无需再 encodeURIComponent。
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
function b64encode(str) {
  let out = ''
  for (let i = 0; i < str.length; i += 3) {
    const c1 = str.charCodeAt(i) & 0xff
    const c2 = i + 1 < str.length ? str.charCodeAt(i + 1) & 0xff : NaN
    const c3 = i + 2 < str.length ? str.charCodeAt(i + 2) & 0xff : NaN
    const e1 = c1 >> 2
    const e2 = ((c1 & 3) << 4) | (isNaN(c2) ? 0 : c2 >> 4)
    const e3 = isNaN(c2) ? 64 : (((c2 & 15) << 2) | (isNaN(c3) ? 0 : c3 >> 6))
    const e4 = isNaN(c3) ? 64 : c3 & 63
    out += B64.charAt(e1) + B64.charAt(e2) + (e3 === 64 ? '=' : B64.charAt(e3)) + (e4 === 64 ? '=' : B64.charAt(e4))
  }
  return out
}

export function svgIcon(name, color = '#A89FA8', size = 48) {
  const svg =
    "<svg xmlns='http://www.w3.org/2000/svg' width='" +
    size +
    "' height='" +
    size +
    "' viewBox='0 0 24 24' fill='none' stroke='" +
    color +
    "' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'>" +
    (PATHS[name] || '') +
    '</svg>'
  return 'data:image/svg+xml;base64,' + b64encode(svg)
}
