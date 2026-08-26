// 云函数：ping —— CloudBase 连通性与身份自检（M0.1）
// 部署：微信开发者工具 → 云开发 → 云函数（右键上传），或 cloudbase CLI。
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async () => {
  const { OPENID, APPID, UNIONID } = cloud.getWXContext()
  return {
    code: 0,
    message: 'pong',
    data: {
      openid: OPENID,
      appid: APPID,
      unionid: UNIONID || '',
      ts: Date.now(),
      runtime: process.version
    }
  }
}
