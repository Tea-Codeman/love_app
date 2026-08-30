// cloudfunctions/chat/index.js —— F6 轻聊导流（M3.3）
// 架构（plan-m3.md §1 已定）：
//   1. **先审后发**：发消息前调用 safety.checkText，不过审直接拒（auditStatus 只会有 pass）
//   2. **S1 解锁**：成长值 < 12（未到 S1）不能聊天，引导先一起玩
//   3. **有效互聊 +2**：当「本条消息是对对方上一条消息的回复」时结算一次成长值（+2，含 streak）
//   4. 黑名单双向拦截：任一方向拉黑都禁止发消息
// 动作：send（发消息）/ list（拉历史）/ contact（S4 解锁联系方式）
// 复用而非重写：审核走 safety 云函数、成长值走 growth 云函数，避免规则两份漂移。
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command
const MESSAGES_COL = 'messages'
const BLOCKS_COL = 'blocks'
const USERS_COL = 'users'

// S1 门槛成长值（与 growth/index.js 的 STAGE_THRESHOLDS.S1 一致）
const MIN_CHAT_GROWTH = 12
// S4 门槛成长值：达到后才解锁联系方式
const MIN_CONTACT_GROWTH = 150
// 单条消息长度上限（与 safety.localCheckText 的 500 字保持一致）
const MAX_LEN = 500
// 【2026-08-30 BUG-1 修复】成长规则统一走共享内核 ./growth-core.js（与 growth/game 同源）。
// 改规则请改 cloudfunctions/growth/growth-core.js，再跑 `npm run sync:core` 同步到本目录。
const core = require('./growth-core')
const growthCtx = { db, _ }
const { pairKeyOf } = core

// M4.1 F9 埋点：共享内核，本进程内直接写 events。
// ⚠️ 绝不用 cloud.callFunction 调 metrics —— 跨函数调用会丢失 OPENID（BUG-1）。
const metrics = require('./metrics-core')
const metricsCtx = { db }

// 一轮「有效互聊」的成长值增量（唯一定义处在 growth-core.js）
const CHAT_GROWTH = core.CHAT_GROWTH

// 双向拉黑检测：任一方向拉黑都不能发消息（与 match.recommend 的过滤口径一致）
async function isBlockedEitherWay(a, b) {
  try {
    const r = await db.collection(BLOCKS_COL)
      .where(_.or([
        { blockerId: a, blockedId: b },
        { blockerId: b, blockedId: a }
      ]))
      .limit(1)
      .get()
    return !!(r.data && r.data.length)
  } catch (e) {
    return false   // blocks 集合不可用时放行，不因安全组件故障阻断聊天
  }
}

async function getPair(OPENID, peerId) {
  try {
    return await core.readPair(growthCtx, OPENID, peerId)
  } catch (e) {
    return null
  }
}

// 先审后发：复用 safety 云函数，避免违规词表在两处各维护一份
async function audit(content) {
  try {
    const r = await cloud.callFunction({
      name: 'safety',
      data: { action: 'checkText', content }
    })
    const res = (r && r.result) || {}
    // code 0 且 pass 为真才算通过；其余一律判定不通过（fail-closed）
    return { pass: res.code === 0 && res.data && res.data.pass === true, reason: (res.data && res.data.reason) || res.message || '内容未通过审核' }
  } catch (e) {
    return { pass: false, reason: '内容审核服务暂不可用，请稍后再试' }
  }
}

// 成长值累加：直接在本进程内写 pairs（共享内核，含 streak 结算），失败不影响消息已发出的事实。
// ⚠️ 绝不再 cloud.callFunction 到 growth —— 跨函数调用时被调用方的 getWXContext().OPENID 恒为
//    undefined（端用户身份不自动透传），成长值会被写进 "<openid>|undefined" 的幽灵 pair，
//    且失败被吞、主流程不报错。详见 growth-core.js 头部说明（BUG-1）。
// 返回内核原始结果（含 `applied.stageFrom/stageTo`，供 M4.1 埋点判断阶段跃迁）；失败返回 null。
async function addGrowth(OPENID, peerId, delta, reason) {
  try {
    const res = await core.addGrowth(growthCtx, { openid: OPENID, peerId, delta, reason })
    if (res.code !== 0) {
      console.error('[chat.addGrowth] 成长累加失败：', res.message)
      return null
    }
    return res
  } catch (e) {
    console.error('[chat.addGrowth] 异常：', (e && e.message) || e)
    return null
  }
}

async function send({ peerId, content, type = 'text' } = {}, OPENID) {
  if (!OPENID) return { code: 401, message: '未登录' }
  if (!peerId) return { code: 400, message: '缺少 peerId' }
  if (peerId === OPENID) return { code: 400, message: '不能和自己聊天' }
  const text = String(content || '').trim()
  if (!text) return { code: 400, message: '消息不能为空' }
  if (text.length > MAX_LEN) return { code: 400, message: '消息过长（最多 ' + MAX_LEN + ' 字）' }

  // 1) 黑名单双向拦截
  if (await isBlockedEitherWay(OPENID, peerId)) {
    return { code: 403, message: '无法给该用户发消息' }
  }

  // 2) S1 门禁：关系未到 S1（成长值 < 12）不允许轻聊
  const pair = await getPair(OPENID, peerId)
  const growthValue = Number(pair && pair.growthValue) || 0
  if (growthValue < MIN_CHAT_GROWTH) {
    return {
      code: 403,
      message: '关系还不够熟，再一起玩几局就能聊天啦',
      data: { needGrowth: MIN_CHAT_GROWTH - growthValue, growthValue }
    }
  }

  // 3) 先审后发
  const a = await audit(text)
  if (!a.pass) {
    // M4.1：`message_sent`（auditPassed=false）—— 未过审的消息**不会落库**，
    // 这里是内容安全违规率的唯一观测点（先审后发下，入库的消息必然是 pass）。
    // props 只放布尔，绝不带消息正文（隐私红线）。
    metrics.track(metricsCtx, {
      openid: OPENID,
      eventName: 'message_sent',
      pairId: pairKeyOf(OPENID, peerId),
      props: { auditPassed: false }
    }).catch(() => {})
    return { code: 403, message: a.reason, data: { auditFailed: true } }
  }

  // 4) 有效互聊判定：对方上一条消息是我要回复的对象 → 本轮互聊成立
  //    自然的幂等：我连发多条时，最后一条仍是「我发的」，不会重复计分。
  const pairKey = pairKeyOf(OPENID, peerId)
  let lastFromPeer = false
  let isFirstMessage = true
  try {
    const last = await db.collection(MESSAGES_COL)
      .where({ pairKey })
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get()
    const m = last.data && last.data[0]
    lastFromPeer = !!(m && m.senderId === peerId)
    isFirstMessage = !m
  } catch (e) {
    lastFromPeer = false
    isFirstMessage = true
  }

  const now = Date.now()
  const add = await db.collection(MESSAGES_COL).add({
    data: {
      pairKey,
      senderId: OPENID,
      receiverId: peerId,
      content: text,
      type,
      auditStatus: 'pass',   // 未过审的已在上面直接拒绝，不会落库
      createdAt: now
    }
  })

  // M4.1：`message_sent`（auditPassed=true）+ 首次通过 S1 门禁时补 `chat_unlocked`（S1 转化漏斗）。
  // 「首次」= 本 pair 此前一条消息都没有 —— 也就是第一次真正踩过 S1 门禁。
  metrics.track(metricsCtx, {
    openid: OPENID,
    eventName: 'message_sent',
    pairId: pairKey,
    props: { auditPassed: true }
  }).catch(() => {})
  if (isFirstMessage) {
    metrics.track(metricsCtx, {
      openid: OPENID,
      eventName: 'chat_unlocked',
      pairId: pairKey,
      props: { growthValue }
    }).catch(() => {})
  }

  // 5) 互聊结算（+2，含 streak）。失败不影响消息本身
  let rewarded = false
  if (lastFromPeer) {
    const res = await addGrowth(OPENID, peerId, CHAT_GROWTH, '一轮有效互聊')
    rewarded = !!res
    // M4.1：`pair_stage_changed`（SC1 阶段分布）。仅阶段真的跃迁时才写。
    if (res && res.data && res.data.applied) {
      metrics.trackIfStageChanged(metricsCtx, {
        openid: OPENID,
        pairId: pairKey,
        applied: res.data.applied
      }).catch(() => {})
    }
  }

  return {
    code: 0,
    data: {
      msgId: add._id,
      createdAt: now,
      rewarded,
      growth: rewarded ? CHAT_GROWTH : 0
    }
  }
}

async function list({ peerId, limit = 50, since = 0 } = {}, OPENID) {
  if (!OPENID) return { code: 401, message: '未登录' }
  if (!peerId) return { code: 400, message: '缺少 peerId' }
  const n = Math.min(200, Math.max(1, Number(limit) || 50))
  const pairKey = pairKeyOf(OPENID, peerId)
  try {
    // 增量拉取：since > 0 时仅返回 createdAt 严格大于 since 的消息（轮询去重靠 _.gt，不会重复末条）。
    // 命中 {pairKey, createdAt} 复合索引（P0）；无 since 时退回全量，兼容首屏。
    const where = { pairKey }
    if (since) where.createdAt = _.gt(Number(since))
    const r = await db.collection(MESSAGES_COL)
      .where(where)
      .orderBy('createdAt', 'desc')
      .limit(n)
      .get()
    const messages = (r.data || [])
      .slice()
      .reverse()
      .map(m => ({
        msgId: m._id,
        content: m.content || '',
        type: m.type || 'text',
        senderId: m.senderId,
        mine: m.senderId === OPENID,
        createdAt: m.createdAt || 0
      }))
    return { code: 0, data: { messages } }
  } catch (e) {
    const msg = (e && e.message) || String(e)
    if (/not exist|does not exist|no such collection/i.test(msg)) {
      return { code: 500, message: '数据库集合未创建：请在 CloudBase 控制台创建 messages 集合' }
    }
    return { code: -1, message: '查询失败：' + msg }
  }
}

// 联系方式解锁（M3.4）：仅 S4（成长值 ≥150）可见，且任一方向拉黑即拒绝。
// 微信号只在这一个出口返回——recommend / getGame 等接口一律不带，避免隐私字段到处漏。
async function contact({ peerId } = {}, OPENID) {
  if (!OPENID) return { code: 401, message: '未登录' }
  if (!peerId) return { code: 400, message: '缺少 peerId' }
  if (await isBlockedEitherWay(OPENID, peerId)) {
    return { code: 403, message: '无法获取该用户联系方式' }
  }
  const pair = await getPair(OPENID, peerId)
  const growthValue = Number(pair && pair.growthValue) || 0
  if (growthValue < MIN_CONTACT_GROWTH) {
    return {
      code: 403,
      message: '还没到解锁的时候，再相处一阵子吧',
      data: { needGrowth: MIN_CONTACT_GROWTH - growthValue, growthValue }
    }
  }
  const u = await db.collection(USERS_COL).where({ openid: peerId }).limit(1).get()
  const user = (u.data && u.data[0]) || null
  if (!user) return { code: 404, message: '用户不存在' }

  // M4.1：`contact_unlocked`（**SC3 加微信转化**的分子）。
  // 幂等：每个 pair 仅在「首次解锁联系方式」时上报一次，避免重复点击/多次查看放大 SC3 分母。
  // 判重依据 = events 中该 pairId 是否已有 contact_unlocked（pairId 为双 openid 排序拼 `|`，与方向无关）。
  const pairKey = pairKeyOf(OPENID, peerId)
  let firstUnlock = true
  try {
    const prev = await db.collection('events')
      .where({ eventName: 'contact_unlocked', pairId })
      .limit(1)
      .get()
    firstUnlock = !(prev.data && prev.data.length)
  } catch (e) {
    firstUnlock = true // 查询失败保守上报，宁可多记不可漏记
  }
  if (firstUnlock) {
    // props 只带成长值 —— 微信号/昵称等 PII 一律不进 events。埋点失败静默。
    await metrics.track(metricsCtx, {
      openid: OPENID,
      eventName: 'contact_unlocked',
      pairId,
      props: { growthValue }
    }).catch(() => {})
  }

  return {
    code: 0,
    data: {
      nickname: user.nickname || '',
      avatarUrl: user.avatarUrl || '',
      wechatId: user.wechatId || '',
      wechatQrUrl: user.wechatQrUrl || ''
    }
  }
}

exports.main = async (event = {}) => {
  const action = event.action
  const OPENID = cloud.getWXContext().OPENID
  try {
    if (action === 'send') return await send(event, OPENID)
    if (action === 'list') return await list(event, OPENID)
    if (action === 'contact') return await contact(event, OPENID)
    return { code: 404, message: 'unknown action: ' + action }
  } catch (e) {
    const msg = (e && e.message) || 'chat error'
    console.error('[chat.main] 未捕获异常 action=' + action + ' :', msg)
    return { code: -1, message: msg }
  }
}
