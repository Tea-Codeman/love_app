// scripts/sync-growth-core.mjs —— 把成长共享内核同步到各云函数目录
//
// 背景：CloudBase 云函数各自独立打包，无法 require('../growth/growth-core')，
// 所以每个用到的函数目录里必须各放一份同内容副本。手工复制必然漂移，故用脚本兜底。
//
// 用法：npm run sync:core
// 约定：唯一可编辑的源头是 cloudfunctions/growth/growth-core.js，其余目录的副本一律被覆盖。

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const SRC = join(root, 'cloudfunctions', 'growth', 'growth-core.js')
const TARGETS = ['game', 'chat', 'match']

if (!existsSync(SRC)) {
  console.error('[sync:core] 找不到源头文件：' + SRC)
  process.exit(1)
}

const src = readFileSync(SRC, 'utf8')
let changed = 0

for (const dir of TARGETS) {
  const dest = join(root, 'cloudfunctions', dir, 'growth-core.js')
  const before = existsSync(dest) ? readFileSync(dest, 'utf8') : null
  if (before === src) {
    console.log(`[sync:core] ${dir}/growth-core.js 已是最新`)
    continue
  }
  writeFileSync(dest, src, 'utf8')
  changed++
  console.log(`[sync:core] ${dir}/growth-core.js ` + (before === null ? '已创建' : '已更新'))
}

console.log(
  changed === 0
    ? '[sync:core] 全部一致，无改动。'
    : `[sync:core] 同步完成（${changed} 个目录）。改动的是云函数代码，需重新部署对应函数才生效。`
)
