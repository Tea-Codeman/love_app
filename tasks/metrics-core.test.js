// tasks/metrics-core.test.js —— M4.1 埋点共享内核单元测试（本地跑，不进云函数包）
// 用法：node tasks/metrics-core.test.js
// 用 mock db 替换 wx-server-sdk，覆盖：白名单 / PII 拦截 / 限流 / 阶段跃迁 / 写失败静默 / 时区。
// 对应 plan-m4.md §6「事件白名单 / props 校验 / 限流 → Unit」与「埋点不阻断业务」。

const path = require('path')
const core = require(path.join(__dirname, '..', 'cloudfunctions', 'metrics', 'metrics-core.js'))

function makeDb(opts = {}) {
  const writes = []
  return {
    writes,
    collection(name) {
      return {
        add({ data }) {
          if (opts.failOnAdd) return Promise.reject(new Error('mock: events 集合不可写'))
          writes.push({ col: name, data })
          return Promise.resolve({ _id: 'mock' + writes.length })
        }
      }
    }
  }
}

let pass = 0
let fail = 0
function check(name, cond, extra) {
  if (cond) {
    pass++
    console.log('  ✅ ' + name)
  } else {
    fail++
    console.log('  ❌ ' + name + (extra ? '  → ' + extra : ''))
  }
}

;(async () => {
  console.log('【1】白名单与必填校验')
  {
    const db = makeDb()
    const r = await core.track({ db }, { openid: 'u1', eventName: 'not_a_real_event' })
    check('白名单外事件被拒', r.code === 400 && db.writes.length === 0)
  }
  {
    const db = makeDb()
    const r = await core.track({ db }, { eventName: 'app_open' })
    check('缺少 openid 被拒（BUG-1 护栏）', r.code === 401 && db.writes.length === 0)
  }
  {
    const db = makeDb()
    const r = await core.track({ db }, { openid: 'u1', eventName: 'game_done' })
    check('关系维度事件缺 pairId 被拒', r.code === 400 && db.writes.length === 0)
  }
  {
    const db = makeDb()
    await core.track({ db }, { openid: 'u1', eventName: 'app_open' })
    check('用户维度事件不需 pairId', db.writes.length === 1 && db.writes[0].data.pairId === '')
  }

  console.log('【2】props 白名单与 PII 拦截')
  {
    const db = makeDb()
    await core.track(
      { db },
      {
        openid: 'u1',
        eventName: 'message_sent',
        pairId: 'a|b',
        props: { auditPassed: true, content: '这是我的手机号13800138000', secret: 'x' }
      }
    )
    const p = db.writes[0].data.props
    check('只保留白名单键 auditPassed', JSON.stringify(p) === '{"auditPassed":true}', JSON.stringify(p))
  }
  {
    const db = makeDb()
    await core.track(
      { db },
      { openid: 'u1', eventName: 'report_created', props: { targetType: 'post', reason: '他骂我，微信号 abc123' } }
    )
    const p = db.writes[0].data.props
    check('举报理由（自由文本/PII）被丢弃', p.reason === undefined && p.targetType === 'post', JSON.stringify(p))
  }
  {
    const db = makeDb()
    await core.track({ db }, { openid: 'u1', eventName: 'recommend_view', props: { count: { a: 1 } } })
    check('对象类型的值被丢弃', JSON.stringify(db.writes[0].data.props) === '{}')
  }
  {
    const db = makeDb()
    const big = 'x'.repeat(2000)
    await core.track({ db }, { openid: 'u1', eventName: 'report_created', props: { targetType: big } })
    check('超 1KB 的 props 整包丢弃', JSON.stringify(db.writes[0].data.props) === '{}')
  }

  console.log('【3】限流（同一用户同一事件）')
  {
    // ⚠️ 限流表是内核的**进程内共享 Map**，每个用例必须用全新 openid，否则会串味。
    const db = makeDb()
    const uid = 'rate-' + Date.now()
    let ok = 0
    for (let i = 0; i < core.RATE_MAX_PER_WINDOW + 10; i++) {
      const r = await core.track({ db }, { openid: uid, eventName: 'app_open' })
      if (r.code === 0) ok++
    }
    check(
      `窗口内最多写 ${core.RATE_MAX_PER_WINDOW} 条`,
      ok === core.RATE_MAX_PER_WINDOW && db.writes.length === core.RATE_MAX_PER_WINDOW,
      'ok=' + ok
    )
  }

  console.log('【4】阶段跃迁只在真的变了才上报')
  {
    const db = makeDb()
    await core.trackIfStageChanged({ db }, {
      openid: 'u1', pairId: 'a|b', applied: { stageFrom: 'S1', stageTo: 'S1', growthValue: 20 }
    })
    check('阶段未变 → 不写', db.writes.length === 0)
  }
  {
    const db = makeDb()
    await core.trackIfStageChanged({ db }, {
      openid: 'u1', pairId: 'a|b', applied: { stageFrom: 'S1', stageTo: 'S2', growthValue: 41 }
    })
    const d = db.writes[0] && db.writes[0].data
    check(
      '阶段跃迁 → 写 pair_stage_changed 且带 from/to/growthValue',
      d && d.eventName === 'pair_stage_changed' && d.props.from === 'S1' && d.props.to === 'S2' && d.props.growthValue === 41
    )
  }

  console.log('【5】埋点绝不阻断业务')
  {
    // 同样要用全新 openid，否则先被限流挡住（429）根本走不到写入那一步
    const db = makeDb({ failOnAdd: true })
    let threw = false
    let r
    try {
      r = await core.track({ db }, { openid: 'failwrite-' + Date.now(), eventName: 'app_open' })
    } catch (e) {
      threw = true
    }
    check('events 写失败不抛异常', !threw && r && r.code === -1, r && 'code=' + r.code)
  }
  {
    const db = makeDb({ failOnAdd: true })
    let threw = false
    try {
      await core.trackIfStageChanged({ db }, {
        openid: 'u1', pairId: 'a|b', applied: { stageFrom: 'S1', stageTo: 'S2', growthValue: 41 }
      })
    } catch (e) {
      threw = true
    }
    check('trackIfStageChanged 写失败不抛异常', !threw)
  }
  {
    // 限流 Map 已污染，换事件名验证批量接口
    const db = makeDb()
    const r = await core.trackMany({ db }, [
      { openid: 'u2', eventName: 'game_join', pairId: 'a|b' },
      { openid: 'u2', eventName: 'bad_event', pairId: 'a|b' },
      { openid: 'u2', eventName: 'game_done', pairId: 'a|b', props: { tacitCount: 4, rounds: 5 } }
    ])
    check('批量：逐条独立，坏的不影响好的', r.ok === 2 && r.failed === 1 && db.writes.length === 2)
  }

  console.log('【6】day 字段按 Asia/Shanghai 计算')
  {
    // 2026-08-30 02:33 CST = 2026-08-29 18:33 UTC
    const ts = Date.parse('2026-08-29T18:33:00.000Z')
    check('凌晨 02:33(CST) 归到 2026-08-30', core.dayOfCST(ts) === '2026-08-30', core.dayOfCST(ts))
    const ts2 = Date.parse('2026-08-29T15:59:00.000Z') // 23:59 CST 08-29
    check('前夜 23:59(CST) 归到 2026-08-29', core.dayOfCST(ts2) === '2026-08-29', core.dayOfCST(ts2))
  }

  console.log('')
  console.log(fail === 0 ? `全部通过（${pass} 项）` : `${pass} 通过 / ${fail} 失败`)
  process.exit(fail === 0 ? 0 : 1)
})()
