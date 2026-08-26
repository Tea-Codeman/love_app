// cloudfunctions/safety/index.js —— F8 内容安全 / 举报 / 拉黑（M1.2 / M1.4）
// 内容审核：checkText / checkImage
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
    return { code: 404, message: 'unknown action: ' + action }
  } catch (e) {
    return { code: -1, message: (e && e.message) || 'safety error' }
  }
}
