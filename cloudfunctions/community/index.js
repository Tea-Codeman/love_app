// cloudfunctions/community/index.js —— F2 社区（话题广场 + 信息流）
// 动作：listTopics（自动播种种子话题）/ listPosts（分页 + 话题筛选，仅过审帖）
// 注意：topics / posts 集合需在 CloudBase 控制台手动创建（与 users 同）。
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command
const TOPICS_COL = 'topics'
const POSTS_COL = 'posts'
const COMMENTS_COL = 'comments'
const BLOCKS_COL = 'blocks'

// 种子话题（冷启动分类，非 UGC 假数据）
const SEED_TOPICS = [
  { name: '心动初遇', description: '第一次遇见 TA 的瞬间' },
  { name: '约会灵感', description: '去哪玩？吃什么？' },
  { name: '情感树洞', description: '那些说不出口的小情绪' },
  { name: '兴趣同好', description: '电影 / 音乐 / 旅行 / 美食' },
  { name: '成长日记', description: '一个人也要闪闪发光' }
]

// 首次调用且集合为空时播种（幂等）
async function ensureSeedTopics() {
  const c = await db.collection(TOPICS_COL).count()
  if (c.total === 0) {
    await db.collection(TOPICS_COL).add({
      data: SEED_TOPICS.map(t => ({ ...t, postCount: 0, createdAt: Date.now() }))
    })
  }
}

async function listTopics() {
  await ensureSeedTopics()
  const res = await db.collection(TOPICS_COL).orderBy('postCount', 'desc').limit(50).get()
  return { code: 0, data: { topics: res.data } }
}

// 当前用户拉黑的人（用于信息流过滤）
async function getBlockedIds(OPENID) {
  if (!OPENID) return []
  try {
    const r = await db.collection(BLOCKS_COL).where({ blockerId: OPENID }).get()
    return (r.data || []).map(b => b.blockedId)
  } catch (e) {
    return []
  }
}
//社区帖子list
async function listPosts({ page = 0, pageSize = 10, topicId = '' } = {}, OPENID) {
  const where = { auditStatus: 'pass' }
  if (topicId) where.topicId = topicId
  const blocked = await getBlockedIds(OPENID)
  if (blocked.length) where.userId = _.nin(blocked)
  const res = await db.collection(POSTS_COL)
    .where(where)
    .orderBy('createdAt', 'desc')
    .skip(Math.max(0, page) * pageSize)
    .limit(pageSize)
    .get()
    
  return { code: 0, data: { posts: res.data, hasMore: res.data.length === pageSize } }
}

// 点赞 / 取消点赞（幂等切换）
async function likePost({ postId }, OPENID) {
  if (!postId) return { code: 400, message: '缺少 postId' }
  const post = await db.collection(POSTS_COL).doc(postId).get()
  const likes = (post.data && post.data.likes) || []
  const liked = likes.includes(OPENID)
  const update = liked
    ? { likes: _.pull(OPENID) }
    : { likes: _.push(OPENID) }
  await db.collection(POSTS_COL).doc(postId).update({ data: update })
  return { code: 0, data: { liked: !liked, likeCount: liked ? likes.length - 1 : likes.length + 1 } }
}

// 评论：先审后发
async function addComment({ postId, content }, OPENID) {
  if (!postId) return { code: 400, message: '缺少 postId' }
  const text = (content || '').trim()
  if (!text) return { code: 400, message: '评论不能为空' }
  if (text.length > 200) return { code: 400, message: '评论不超过 200 字' }

  const safetyRes = await cloud.callFunction({ name: 'safety', data: { action: 'checkText', content: text } })
  const sr = safetyRes && safetyRes.result && safetyRes.result.data
  if (!sr || !sr.pass) return { code: 400, message: (sr && sr.reason) || '评论未通过审核' }

  let author = { nickname: '' }
  const u = await db.collection('users').where({ openid: OPENID }).get()
  if (u.data && u.data[0]) author.nickname = u.data[0].nickname || ''

  const comment = {
    postId,
    userId: OPENID,
    nickname: author.nickname,
    content: text,
    auditStatus: 'pass',
    createdAt: Date.now()
  }
  const add = await db.collection(COMMENTS_COL).add({ data: comment })
  await db.collection(POSTS_COL).doc(postId).update({ data: { commentCount: _.inc(1) } }).catch(() => {})
  return { code: 0, data: { comment: { ...comment, _id: add._id } } }
}

// 帖子详情：单次云函数调用内并行取「帖子 + 评论」，避免详情页发两次请求（两次冷启动叠加）。
// 性能优化（2026-08-27）：原 getPost + listComments 拆分为两个 action，导致跳转详情付两次调用/冷启动开销。
async function getPostDetail({ postId }) {
  console.log('========== getPostDetail 开始 ==========')
  console.log('postId:', postId)
  if (!postId) return { code: 400, message: '缺少 postId' }
  const timerKey = 'getPostDetail:' + postId
  console.time(timerKey)
  let post = null
  let comments = []
  let postErr = null
  try {
    const [postRes, commentRes] = await Promise.all([
      db.collection(POSTS_COL).doc(postId).get(),
      db.collection(COMMENTS_COL)
        .where({ postId, auditStatus: 'pass' })
        .orderBy('createdAt', 'asc')
        .limit(100)
        .get()
    ])
    if (postRes.data) post = postRes.data
    comments = commentRes.data || []
  } catch (e) {
    postErr = e
  }
  console.timeEnd(timerKey)
  if (!post) {
    const dbg = postErr ? (postErr.message || String(postErr)) : '帖子查询返回空'
    // 仅在“集合确实不存在”时给该提示；其余（含建索引后触发的真实错误）一律透传，避免误判
    console.error('[getPostDetail] 查询失败 postId=' + postId + ' :', dbg)
    if (/not exist|does not exist|no such collection/i.test(dbg)) {
      return { code: 500, message: '数据库集合未创建：请在 CloudBase 控制台（与 community 云函数同一环境）创建 posts 与 comments 集合' }
    }
    return { code: -1, message: '查询失败：' + dbg }
  }
  return { code: 0, data: { post, comments } }
}

// 发帖：先审后发。调 safety 云函数审核，过审才入库（auditStatus=pass）。
async function createPost(event, OPENID) {
  const text = (event.content || '').trim()
  if (!text) return { code: 400, message: '内容不能为空' }
  if (text.length > 500) return { code: 400, message: '内容不超过 500 字' }
  if (!event.topicId) return { code: 400, message: '请选择话题' }

  // 先审后发：文本过 safety
  const safetyRes = await cloud.callFunction({ name: 'safety', data: { action: 'checkText', content: text } })
  const sr = safetyRes && safetyRes.result && safetyRes.result.data
  if (!sr || !sr.pass) {
    return { code: 400, message: (sr && sr.reason) || '内容未通过审核' }
  }

  // 作者资料 denormalize（昵称/头像），便于信息流直出
  let author = { nickname: '', avatarUrl: '' }
  const u = await db.collection('users').where({ openid: OPENID }).get()
  if (u.data && u.data[0]) {
    author = { nickname: u.data[0].nickname || '', avatarUrl: u.data[0].avatarUrl || '' }
  }

  // 话题名
  let topicName = ''
  try {
    const t = await db.collection(TOPICS_COL).doc(event.topicId).get()
    if (t && t.data) topicName = t.data.name
  } catch (e) {}

  const post = {
    userId: OPENID,
    topicId: event.topicId,
    topicName,
    nickname: author.nickname,
    avatarUrl: author.avatarUrl,
    content: text,
    images: Array.isArray(event.images) ? event.images.slice(0, 9) : [],
    likes: [],
    commentCount: 0,
    auditStatus: 'pass',
    createdAt: Date.now()
  }
  const add = await db.collection(POSTS_COL).add({ data: post })
  // 话题计数 +1
  await db.collection(TOPICS_COL).doc(event.topicId).update({ data: { postCount: _.inc(1) } }).catch(() => {})
  return { code: 0, data: { post: { ...post, _id: add._id } } }
}

exports.main = async (event = {}) => {
  const action = event.action
  const OPENID = cloud.getWXContext().OPENID
  try {
    if (action === 'listTopics') return await listTopics()
    if (action === 'listPosts') return await listPosts(event, OPENID)
    if (action === 'createPost') return await createPost(event, OPENID)
    if (action === 'likePost') return await likePost(event, OPENID)
    if (action === 'addComment') return await addComment(event, OPENID)
    if (action === 'getPostDetail') return await getPostDetail(event)
    return { code: 404, message: 'unknown action: ' + action }
  } catch (e) {
    const msg = (e && e.message) || 'community error'
    console.error('[community.main] 未捕获异常 action=' + action + ' :', msg)
    if (/not exist|does not exist|no such collection/i.test(msg)) {
      return { code: 500, message: '数据库集合未创建：请在 CloudBase 控制台（与云函数同一环境）创建对应集合' }
    }
    return { code: -1, message: msg }
  }
}
