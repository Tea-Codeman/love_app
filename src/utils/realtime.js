// src/utils/realtime.js —— 游戏状态弱实时同步（F4 弱实时 T1 已决）
// 优先用云数据库 watch 近实时订阅 games 文档；若环境安全规则限制跨用户读（默认规则常见），
// 自动降级为轮询 getGame（秒级），保证双端状态一致。客户端只读经云函数，不直写。
import { initCloud } from './cloud'
import { callFunction } from './request'

/**
 * 启动对局状态同步
 * @param {string} gameId
 * @param {{onUpdate:Function, onError?:Function}} cb onUpdate(gameDoc)
 * @returns {{stop:Function}}
 */
export function startGameSync(gameId, cb) {
  initCloud()
  let stopped = false
  let watcher = null
  let timer = null

  const poll = async () => {
    if (stopped) return
    const r = await callFunction('game', { action: 'getGame', gameId })
    if (r.ok && r.data && r.data.game && !stopped) cb.onUpdate(r.data.game)
  }

  // 尝试 watch（微信基础库支持 doc.watch）；失败或受限则靠轮询兜底
  // #ifdef MP-WEIXIN
  try {
    const db = wx.cloud.database()
    watcher = db.collection('games').doc(gameId).watch({
      onChange: (snap) => {
        const d = snap && snap.docs && snap.docs[0]
        if (d && !stopped) cb.onUpdate(d)
      },
      onError: () => {
        if (!timer && !stopped) timer = setInterval(poll, 1500)
      }
    })
  } catch (e) {
    watcher = null
  }
  // #endif

  if (!watcher) timer = setInterval(poll, 1500)
  poll() // 立即拉一次，避免首屏空白

  return {
    stop() {
      stopped = true
      if (watcher && watcher.close) {
        try { watcher.close() } catch (e) {}
      }
      if (timer) clearInterval(timer)
    }
  }
}
