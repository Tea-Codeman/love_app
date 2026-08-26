// cloudfunctions/invite/index.js —— T2 邀请裂变（M1.5）
// 动作：generate（生成邀请码）/ consume（核销，供测试/前端显式核销；登录归因由 auth.login 直接处理）
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const INVITES_COL = 'invites'

function genCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase()
}

async function generate(OPENID) {
  const code = genCode()
  await db.collection(INVITES_COL).add({
    data: { inviterId: OPENID, code, invitedUserId: '', createdAt: Date.now() }
  })
  return { code: 0, data: { code } }
}

async function consume({ code }, OPENID) {
  if (!code) return { code: 400, message: '缺少邀请码' }
  const r = await db.collection(INVITES_COL).where({ code }).get()
  const inv = r.data && r.data[0]
  if (!inv) return { code: 404, message: '邀请码无效' }
  if (inv.invitedUserId) return { code: 400, message: '邀请码已使用' }
  if (inv.inviterId === OPENID) return { code: 400, message: '不能用自己的邀请码' }
  await db.collection(INVITES_COL).doc(inv._id).update({ data: { invitedUserId: OPENID } })
  return { code: 0, data: { inviterId: inv.inviterId } }
}

exports.main = async (event = {}) => {
  const action = event.action
  const OPENID = cloud.getWXContext().OPENID
  try {
    if (action === 'generate') return await generate(OPENID)
    if (action === 'consume') return await consume(event, OPENID)
    return { code: 404, message: 'unknown action: ' + action }
  } catch (e) {
    const msg = (e && e.message) || 'invite error'
    if (/not exist|does not exist|no such collection/i.test(msg)) {
      return { code: 500, message: '数据库集合未创建：请在 CloudBase 控制台（与云函数同一环境）创建 invites 集合' }
    }
    return { code: -1, message: msg }
  }
}
