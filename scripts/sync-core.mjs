// scripts/sync-core.mjs —— 把共享内核同步到各云函数目录
//
// 背景：CloudBase 云函数各自独立打包，无法 require('../growth/xxx') 或
// require('../metrics/xxx')，所以每个用到的函数目录里必须各放一份同内容副本。
// 手工复制必然漂移，故用脚本兜底。
//
// 用法：npm run sync:core
// 约定：唯一可编辑的源头是 MANIFEST 里的 src，其余目录的副本一律被覆盖。
//      （早期本脚本只同步 growth-core，M4.1 起改为清单驱动，同时同步 metrics-core。）

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')

// 清单：src = 唯一源头（相对 cloudfunctions/），file = 目标目录内的文件名，targets = 需要副本的云函数
const MANIFEST = [
  {
    src: 'growth/growth-core.js',
    file: 'growth-core.js',
    targets: ['game', 'chat', 'match']
  },
  {
    src: 'metrics/metrics-core.js',
    file: 'metrics-core.js',
    targets: ['growth', 'game', 'chat', 'match', 'safety', 'auth']
  }
]

let changed = 0
let missing = 0

for (const item of MANIFEST) {
  const srcPath = join(root, 'cloudfunctions', item.src)
  if (!existsSync(srcPath)) {
    console.error(`[sync:core] 找不到源头文件：${item.src}`)
    missing++
    continue
  }
  const src = readFileSync(srcPath, 'utf8')

  for (const dir of item.targets) {
    const dest = join(root, 'cloudfunctions', dir, item.file)
    const before = existsSync(dest) ? readFileSync(dest, 'utf8') : null
    if (before === src) {
      console.log(`[sync:core] ${dir}/${item.file} 已是最新`)
      continue
    }
    writeFileSync(dest, src, 'utf8')
    changed++
    console.log(`[sync:core] ${dir}/${item.file} ` + (before === null ? '已创建' : '已更新'))
  }
}

if (missing) process.exit(1)

console.log(
  changed === 0
    ? '[sync:core] 全部一致，无改动。'
    : `[sync:core] 同步完成（${changed} 个副本）。改动的是云函数代码，需重新部署对应函数才生效。`
)
