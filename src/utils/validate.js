// src/utils/validate.js —— 客户端资料校验（与 auth 云函数服务端白名单一致，M0.3）
// 仅做 UX 友好提示；最终以服务端 sanitize 为准（不信任前端）。
export function validateProfile(form) {
  const errors = []
  if (form.nickname && form.nickname.trim().length > 20) errors.push('昵称不超过 20 字')
  if (form.age != null && form.age !== '') {
    const a = Number(form.age)
    if (!Number.isInteger(a) || a < 18 || a > 60) errors.push('年龄需在 18–60 之间')
  }
  if (form.city && form.city.trim().length > 30) errors.push('城市不超过 30 字')
  if (form.bio && form.bio.trim().length > 100) errors.push('签名不超过 100 字')
  if (Array.isArray(form.interestTags) && form.interestTags.length > 10) errors.push('兴趣标签最多 10 个')
  return { ok: errors.length === 0, errors }
}
