// 云函数：auth —— F1 微信登录 + 资料（M0.2 / M0.3）
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const users = db.collection('users')

// M4.1 F9 埋点：共享内核，本进程内直接写 events。
// ⚠️ 绝不用 cloud.callFunction 调 metrics —— 跨函数调用会丢失 OPENID（BUG-1）。
const metrics = require('./metrics-core')
const metricsCtx = { db }

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) return { code: 401, message: 'no openid' }
  const action = (event && event.action) || 'login'

  // 登录：按 openid 首次建档 / 再次读取
  // 注意：云函数内 add 不会自动注入 _openid（仅客户端直写会），故显式存储 openid 并据此查询，
  // 避免“每次登录新建重复用户”和“updateProfile 匹配 0 行导致不更新”两个 bug。
  if (action === 'login') {
    const r = await users.where({ openid: OPENID }).get()
    let user = r.data && r.data[0]
    if (!user) {
      const newUser = {
        openid: OPENID,
        nickname: '',
        avatarUrl: '',
        gender: 0,
        age: 0,
        city: '',
        interestTags: [],
        bio: '',
        mbti: '',
        invitedBy: '',
        online: true,
        createdAt: db.serverDate()
      }
      // 邀请归因（T2）：消耗邀请码，写入邀请人 openid
      const code = event && event.inviteCode
      if (code) {
        try {
          const inv = await db.collection('invites').where({ code }).get()
          if (inv.data && inv.data[0] && !inv.data[0].invitedUserId) {
            newUser.invitedBy = inv.data[0].inviterId
            await db.collection('invites').doc(inv.data[0]._id).update({ data: { invitedUserId: OPENID } })
          }
        } catch (e) {}
      }
      const doc = await users.add({ data: newUser })
      user = (await users.doc(doc._id).get()).data
    }
    return { code: 0, data: { openid: OPENID, user } }
  }

  // 读取资料
  if (action === 'getProfile') {
    const r = await users.where({ openid: OPENID }).get()
    return { code: 0, data: { user: (r.data && r.data[0]) || null } }
  }

  // 更新资料（服务端校验）
  if (action === 'updateProfile') {
    const patch = sanitizeProfile((event && event.profile) || {})
    if (!patch) return { code: 400, message: '资料非法' }
    await users.where({ openid: OPENID }).update({ data: patch })
    const r = await users.where({ openid: OPENID }).get()
    const user = (r.data && r.data[0]) || null

    // M4.1 F9 埋点（plan-m4.md 决策 1：凡有云函数的动作一律服务端入桩）。
    // 规划里 `mbti_completed` 写的是 auth.updateProfile（服务端），`profile_completed` 写的是
    // 「前端资料保存成功」；但资料保存本来就走本函数，服务端入桩更可信 → 两个都在这里上报。
    // 埋点失败静默，绝不影响资料保存结果。
    if (user) {
      if (patch.mbti) {
        metrics.track(metricsCtx, {
          openid: OPENID,
          eventName: 'mbti_completed',
          props: { mbti: patch.mbti }
        }).catch(() => {})
      }
      // 「资料完整」定义：撮合打分真正依赖的四项齐全 —— 昵称 / 头像 / 性别 / 年龄。
      // （city、bio、interestTags 属加分项，不作为完成门槛；口径写死，否则漏斗不可复算）
      if (isProfileComplete(user)) {
        metrics.track(metricsCtx, {
          openid: OPENID,
          eventName: 'profile_completed'
        }).catch(() => {})
      }
    }

    return { code: 0, data: { user } }
  }

  // 设置在线状态（F-new）：用户在「设置」页手动切换在线/离线。
  // 离线后不会出现在他人推荐（recommend 服务端按 online 过滤），但自身功能不受影响。
  if (action === 'setOnline') {
    const v = !!(event && event.online)
    await users.where({ openid: OPENID }).update({ data: { online: v } })
    return { code: 0, data: { online: v } }
  }

  // 获取指定用户的在线状态（F-new）：供聊天页显示对方「在线/离线」。
  // 未设置 online 字段的存量用户按「在线」处理（与 recommend 过滤口径一致：缺省即在线）。
  if (action === 'getStatus') {
    const targetId = event && event.targetId
    if (!targetId) return { code: 400, message: '缺少 targetId' }
    try {
      const r = await users.where({ openid: targetId }).field({ online: true }).limit(1).get()
      const u = r.data && r.data[0]
      const online = u ? (u.online !== false) : false
      return { code: 0, data: { online } }
    } catch (e) {
      return { code: 0, data: { online: false } }
    }
  }

  return { code: 404, message: 'unknown action: ' + action }
}

// MBTI 合法类型（16 种四字母组合）。服务端强校验，防止前端写入任意字符串。
// 与前端 src/utils/mbti.js 的 MBTI_ROLES 类型集合一致（前端那份用于角色卡展示）。
const MBTI_TYPES = [
  'INTJ', 'INTP', 'ENTJ', 'ENTP', 'INFJ', 'INFP', 'ENFJ', 'ENFP',
  'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ', 'ISTP', 'ISFP', 'ESTP', 'ESFP'
]

// 资料完整度口径（M4.1）：撮合打分真正依赖的四项齐全即算完成 —— 昵称 / 头像 / 性别 / 年龄。
// city / bio / interestTags 属加分项，不作门槛。口径一旦改动，漏斗历史不可复算，改前先改 plan-m4.md。
function isProfileComplete(u) {
  if (!u) return false
  return !!(u.nickname && u.avatarUrl && u.gender && Number(u.age) > 0)
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
  // 0 视为“未填”，保留 0；仅在 1–17 / 61+ 越界时夹取到 [18,60]
  if (Number.isInteger(p.age)) out.age = (p.age === 0 ? 0 : Math.min(60, Math.max(18, p.age)))
  if (typeof p.city === 'string') out.city = p.city.trim().slice(0, 30)
  if (Array.isArray(p.interestTags)) {
    out.interestTags = p.interestTags
      .filter(t => typeof t === 'string')
      .map(t => t.slice(0, 12))
      .slice(0, 10)
  }
  if (typeof p.bio === 'string') out.bio = p.bio.trim().slice(0, 100)
  // MBTI：仅接受 16 种合法类型（统一大写），空串或非法值直接丢弃，不会误清空已存类型
  if (typeof p.mbti === 'string') {
    const t = p.mbti.trim().toUpperCase()
    if (MBTI_TYPES.includes(t)) out.mbti = t
  }
  // 微信号（M3.4）：仅在 S4 解锁后展示给对方，平时不对外暴露。
  // 微信官方规则：6–20 位、字母开头、仅字母/数字/-/_。非法值直接丢弃（不误清空已存值）。
  if (typeof p.wechatId === 'string') {
    const w = p.wechatId.trim()
    if (/^[a-zA-Z][-_a-zA-Z0-9]{5,19}$/.test(w)) out.wechatId = w
  }
  // 微信二维码图（可选）：必须是 http(s) 链接，避免写入任意字符串后被当图片渲染
  if (typeof p.wechatQrUrl === 'string') {
    const u = p.wechatQrUrl.trim()
    if (/^https?:\/\/\S+$/.test(u)) out.wechatQrUrl = u.slice(0, 500)
  }
  return out
}
