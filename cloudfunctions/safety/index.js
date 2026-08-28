// cloudfunctions/safety/index.js —— F8 内容安全 / 举报 / 拉黑（M1.2 / M1.4）
// 动作：checkText / checkImage（内容审核）
//       report（举报入队）/ block（拉黑，去重写入）
//       listBlocks（黑名单列表，一次 join users 取昵称头像）/ unblock（解除拉黑）
// 架构约定：**过滤只能由服务端执行**。拉黑是安全机制，若改成由前端传列表给后端过滤，
// 客户端传空数组即可绕过，防骚扰能力会完全失效。前端只负责"显示"黑名单。
// 原型期：本地关键词/规则分类器兜底（USE_WX_SECURITY=false）。
// 企业主体 + 社交类目资质就绪后，将 USE_WX_SECURITY 置 true，
// 即切换为微信官方内容安全 API（cloud.openapi.security.msgSecCheck / mediaCheckAsync），业务代码无需改动。
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

const USE_WX_SECURITY = false

// 示例违规词（原型样本，仅用于验证"不过审→不发"链路；真实判定由微信官方 API 完成）
const BLOCKLIST = ['代开发票', '涉黄', '赌博', '诈骗', '违规样例', '广告加微']

function localCheckText(content) {
  if (!content || !content.trim()) return { pass: false, reason: '内容为空' }
  const text = content.trim()
  if (text.length > 500) return { pass: false, reason: '内容过长' }
  for (const w of BLOCKLIST) {
    if (text.includes(w)) return { pass: false, reason: '包含违规词：' + w }
  }
  return { pass: true }
}

async function wxCheckText(content) {
  const res = await cloud.openapi.security.msgSecCheck({ content })
  // 微信 errCode 0 = 通过；87014 = 违规
  return { pass: res.errCode === 0, reason: res.errCode === 0 ? '' : '微信内容安全判定违规' }
}

async function wxCheckImage(mediaUrl) {
  const ctx = cloud.getWXContext()
  const res = await cloud.openapi.security.mediaCheckAsync({
    media_url: mediaUrl,
    media_type: 2,
    openid: ctx.OPENID
  })
  return { pass: !res || res.errCode === 0, reason: '' }
}

// 举报：进入待处置队列（reports 集合）
async function report(event, OPENID) {
  const { targetType, targetId, reason } = event
  if (!targetType || !targetId) return { code: 400, message: '缺少举报目标' }
  await db.collection('reports').add({
    data: {
      reporterId: OPENID,
      targetType,
      targetId,
      reason: (reason || '').trim().slice(0, 200),
      status: 'pending',
      createdAt: Date.now()
    }
  })
  return { code: 0, data: { ok: true } }
}

// 拉黑：写入 blocks，去重；被拉黑方在匹配/互动/信息流中被过滤
async function block(event, OPENID) {
  const { targetId } = event
  if (!targetId || targetId === OPENID) return { code: 400, message: '无效目标' }
  const ex = await db.collection('blocks').where({ blockerId: OPENID, blockedId: targetId }).get()
  if (!(ex.data && ex.data.length)) {
    await db.collection('blocks').add({
      data: { blockerId: OPENID, blockedId: targetId, createdAt: Date.now() }
    })
  }
  return { code: 0, data: { ok: true } }
}

// 黑名单列表：查自己的 blocks，再一次性 join users 取昵称头像（2 次查询，非 N+1）
async function listBlocks({ limit = 100 } = {}, OPENID) {
  if (!OPENID) return { code: 401, message: '未登录' }
  const size = Math.min(100, Math.max(1, Number(limit) || 100))
  // 上限保护：默认 get() 会截断在 100 条，这里显式限制保证行为可预期
  const r = await db.collection('blocks')
    .where({ blockerId: OPENID })
    .orderBy('createdAt', 'desc')
    .limit(size)
    .get()
  const rows = r.data || []
  if (!rows.length) return { code: 0, data: { blocks: [] } }

  const ids = rows.map(b => b.blockedId)
  const us = await db.collection('users')
    .where({ openid: _.in(ids) })
    .field({ openid: true, nickname: true, avatarUrl: true })
    .get()
  const map = {}
  ;(us.data || []).forEach(u => { map[u.openid] = u })

  return {
    code: 0,
    data: {
      blocks: rows.map(b => {
        const u = map[b.blockedId]
        return {
          userId: b.blockedId,
          nickname: (u && u.nickname) || '已注销用户',
          avatarUrl: (u && u.avatarUrl) || '',
          missing: !u,               // 被拉黑者已不存在于 users（测试号/注销）
          createdAt: b.createdAt
        }
      })
    }
  }
}

// 解除拉黑：必须按 blockerId 限定为调用者本人。
// 云函数以管理员权限运行，若不过滤 blockerId，任何人都能删掉别人的拉黑记录。
async function unblock(event, OPENID) {
  const { targetId } = event
  if (!OPENID) return { code: 401, message: '未登录' }
  if (!targetId) return { code: 400, message: '缺少目标' }
  const r = await db.collection('blocks')
    .where({ blockerId: OPENID, blockedId: targetId })
    .remove()
  const removed = (r && r.stats && r.stats.removed) || 0
  return { code: 0, data: { removed } }
}

exports.main = async (event = {}) => {
  const action = event.action
  const OPENID = cloud.getWXContext().OPENID
  try {
    if (action === 'checkText') {
      const r = USE_WX_SECURITY ? await wxCheckText(event.content) : localCheckText(event.content)
      return { code: 0, data: r }
    }
    if (action === 'checkImage') {
      // 原型期无 CV 能力，图片默认通过；切官方 API 后走 mediaCheckAsync
      const r = USE_WX_SECURITY ? await wxCheckImage(event.mediaUrl) : { pass: true }
      return { code: 0, data: r }
    }
    if (action === 'report') return await report(event, OPENID)
    if (action === 'block') return await block(event, OPENID)
    if (action === 'listBlocks') return await listBlocks(event, OPENID)
    if (action === 'unblock') return await unblock(event, OPENID)
    return { code: 404, message: 'unknown action: ' + action }
  } catch (e) {
    return { code: -1, message: (e && e.message) || 'safety error' }
  }
}
