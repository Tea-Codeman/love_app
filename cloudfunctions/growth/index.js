// cloudfunctions/growth/index.js —— F5 关系成长累加（M3.1）
// 架构（plan-m3.md §1 已定，不重议）：
//   1. `pairs` 为权威累计源：每对用户一条，pairKey = sorted(openidA, openidB).join('|')
//   2. 成长值只增不减：一律 db.command.inc(正数)，delta<=0 一律拒绝
//   3. 阶段由 growthValue 读时派生（S0–S4），pairs.stage 仅作缓存冗余、任何读路径都不得依赖
//   4. 阈值 12/40/90/150 为初值，M4.3 用 F9 校准
// 动作：getPair（读，不建）/ addGrowth（累加，含 streak）/ listPairs（我的所有关系）
//
// 【2026-08-30 BUG-1 修复】成长规则已下沉到共享内核 ./growth-core.js。
// 本文件只保留 action 路由与只读接口；改规则一律改 growth-core.js，再跑 `npm run sync:core`。
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command
const PAIRS_COL = 'pairs'

const core = require('./growth-core')
const ctx = { db, _ }
const { pairKeyOf, withStage } = core

// M4.1 F9 埋点：共享内核，本进程内直接写 events。
// ⚠️ 绝不用 cloud.callFunction 调 metrics —— 跨函数调用会丢失 OPENID（BUG-1）。
const metrics = require('./metrics-core')
const metricsCtx = { db }

async function getPair({ peerId } = {}, OPENID) {
  if (!peerId) return { code: 400, message: '缺少 peerId' }
  const pair = await core.readPair(ctx, OPENID, peerId)
  // 读不写：无关系时返回零值 pair，前端按 S0 渲染
  if (!pair) {
    return {
      code: 0,
      data: {
        pair: withStage({
          pairKey: pairKeyOf(OPENID, peerId),
          userA: OPENID,
          userB: peerId,
          growthValue: 0,
          firstGameDone: false,
          gameCount: 0,
          tacitTotal: 0,
          lastGameAt: 0,
          lastInteractionAt: 0,
          milestones: [],
          exists: false
        })
      }
    }
  }
  return { code: 0, data: { pair: withStage(Object.assign({}, pair, { exists: true })) } }
}

async function listPairs({}, OPENID) {
  const mine = await db.collection(PAIRS_COL)
    .where(_.or([{ userA: OPENID }, { userB: OPENID }]))
    .orderBy('updatedAt', 'desc')
    .limit(50)
    .get()
  const rows = (mine.data || []).map(p => withStage(Object.assign({}, p, { exists: true })))

  // 一次性补齐对方资料（昵称/头像/MBTI），避免前端逐条查 users（N+1）。
  // 查不到资料的（已注销等）降级为「未知用户」，不阻断列表。
  const peerIds = [...new Set(rows.map(p => (p.userA === OPENID ? p.userB : p.userA)).filter(Boolean))]
  const profiles = {}
  for (let i = 0; i < peerIds.length; i += 20) {
    const ids = peerIds.slice(i, i + 20)
    try {
      const u = await db.collection('users')
        .where({ openid: _.in(ids) })
        .field({ openid: true, nickname: true, avatarUrl: true, mbti: true })
        .get()
      ;(u.data || []).forEach(x => {
        profiles[x.openid] = { nickname: x.nickname || '', avatarUrl: x.avatarUrl || '', mbti: x.mbti || '' }
      })
    } catch (e) {
      // 该批查不到就保持为空，前端按「未知用户」渲染
    }
  }

  const pairs = rows.map(p => {
    const peerId = p.userA === OPENID ? p.userB : p.userA
    return Object.assign({}, p, {
      peerId,
      peer: profiles[peerId] || { nickname: '未知用户', avatarUrl: '', mbti: '' }
    })
  })
  return { code: 0, data: { pairs } }
}

// 累加成长值（只增不减）+ 顺带结算 streak。
// 直接在本进程内写 pairs —— 不再 callFunction 转一手（跨函数调用会丢 OPENID，见 growth-core.js 头部说明）。
async function addGrowth({ peerId, delta, reason, skipStreak } = {}, OPENID) {
  const res = await core.addGrowth(ctx, { openid: OPENID, peerId, delta, reason, skipStreak })
  // M4.1：`pair_stage_changed`（SC1 阶段分布）。仅阶段真的跃迁时才写；失败静默。
  if (res.code === 0 && res.data && res.data.applied && peerId) {
    metrics.trackIfStageChanged(metricsCtx, {
      openid: OPENID,
      pairId: pairKeyOf(OPENID, peerId),
      applied: res.data.applied
    }).catch(() => {})
  }
  return res
}

// M4.4 SC4 双边邀请确认：A 发起邀请 → B 收到 → B 同意/拒绝，超时自动失效。
// 上报 relation_confirmed 只在「B 同意」这一刻触发（详见 acceptConfirmInvite）。
async function sendConfirmInvite({ peerId } = {}, OPENID) {
  return await core.sendConfirmInvite(ctx, { openid: OPENID, peerId })
}

async function acceptConfirmInvite({ peerId } = {}, OPENID) {
  const res = await core.acceptConfirmInvite(ctx, { openid: OPENID, peerId })
  // 同意成功才上报 relation_confirmed（SC4 分子，pair 维度，pairId 与方向无关）。失败静默。
  if (res.code === 0 && res.data && res.data.accepted) {
    metrics.track(metricsCtx, {
      openid: OPENID,
      eventName: 'relation_confirmed',
      pairId: pairKeyOf(OPENID, peerId)
    }).catch(() => {})
  }
  return res
}

async function rejectConfirmInvite({ peerId } = {}, OPENID) {
  return await core.rejectConfirmInvite(ctx, { openid: OPENID, peerId })
}

async function cancelConfirmInvite({ peerId } = {}, OPENID) {
  return await core.cancelConfirmInvite(ctx, { openid: OPENID, peerId })
}

exports.main = async (event = {}) => {
  const action = event.action
  const OPENID = cloud.getWXContext().OPENID
  try {
    if (action === 'getPair') return await getPair(event, OPENID)
    if (action === 'listPairs') return await listPairs(event, OPENID)
    if (action === 'addGrowth') return await addGrowth(event, OPENID)
    if (action === 'sendConfirmInvite') return await sendConfirmInvite(event, OPENID)
    if (action === 'acceptConfirmInvite') return await acceptConfirmInvite(event, OPENID)
    if (action === 'rejectConfirmInvite') return await rejectConfirmInvite(event, OPENID)
    if (action === 'cancelConfirmInvite') return await cancelConfirmInvite(event, OPENID)
    return { code: 404, message: 'unknown action: ' + action }
  } catch (e) {
    const msg = (e && e.message) || 'growth error'
    console.error('[growth.main] 未捕获异常 action=' + action + ' :', msg)
    if (/not exist|does not exist|no such collection/i.test(msg)) {
      return { code: 500, message: '数据库集合未创建：请在 CloudBase 控制台（与云函数同一环境）创建 pairs 集合' }
    }
    return { code: -1, message: msg }
  }
}
