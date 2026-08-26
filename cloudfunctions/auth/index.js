// 云函数：auth —— F1 微信登录 + 资料（M0.2 / M0.3）
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const users = db.collection('users')

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) return { code: 401, message: 'no openid' }
  const action = (event && event.action) || 'login'

  // 登录：按 openid 首次建档 / 再次读取
  if (action === 'login') {
    const r = await users.where({ _openid: OPENID }).get()
    let user = r.data && r.data[0]
    if (!user) {
      const doc = await users.add({
        data: {
          nickname: '',
          avatarUrl: '',
          gender: 0,
          age: 0,
          city: '',
          interestTags: [],
          bio: '',
          createdAt: db.serverDate()
        }
      })
      user = (await users.doc(doc._id).get()).data
    }
    return { code: 0, data: { openid: OPENID, user } }
  }

  // 读取资料
  if (action === 'getProfile') {
    const r = await users.where({ _openid: OPENID }).get()
    return { code: 0, data: { user: (r.data && r.data[0]) || null } }
  }

  // 更新资料（服务端校验）
  if (action === 'updateProfile') {
    const patch = sanitizeProfile((event && event.profile) || {})
    if (!patch) return { code: 400, message: '资料非法' }
    await users.where({ _openid: OPENID }).update({ data: patch })
    const r = await users.where({ _openid: OPENID }).get()
    return { code: 0, data: { user: (r.data && r.data[0]) || null } }
  }

  return { code: 404, message: 'unknown action: ' + action }
}

// 服务端白名单校验：仅允许约定字段 + 范围/长度约束（最小必要 + 防注入）
function sanitizeProfile(p) {
  if (!p || typeof p !== 'object') return null
  const out = {}
  if (typeof p.nickname === 'string') {
    const s = p.nickname.trim().slice(0, 20)
    if (s.length > 0) out.nickname = s
  }
  if (typeof p.avatarUrl === 'string') out.avatarUrl = p.avatarUrl.slice(0, 500)
  if ([0, 1, 2].includes(p.gender)) out.gender = p.gender
  if (Number.isInteger(p.age)) out.age = Math.min(60, Math.max(18, p.age))
  if (typeof p.city === 'string') out.city = p.city.trim().slice(0, 30)
  if (Array.isArray(p.interestTags)) {
    out.interestTags = p.interestTags
      .filter(t => typeof t === 'string')
      .map(t => t.slice(0, 12))
      .slice(0, 10)
  }
  if (typeof p.bio === 'string') out.bio = p.bio.trim().slice(0, 100)
  return out
}
