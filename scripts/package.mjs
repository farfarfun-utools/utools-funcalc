import { createHash } from 'node:crypto'
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync, gunzipSync } from 'node:zlib'
import { createPackage, extractFile } from '@electron/asar'

// 普通 UPX 是 gzip(ASAR)，不是 ZIP 改扩展名；不生成官方签名或加密 UPXS。
export async function packPlugin(pluginDirectory, outputFile) {
  const temporary = await mkdtemp(join(tmpdir(), 'funcalc-upx-'))
  try {
    const source = join(temporary, 'plugin')
    await mkdir(source)
    for (const name of ['plugin.json', 'preload.js', 'logo.png', 'dist']) {
      await cp(join(pluginDirectory, name), join(source, name), { recursive: true })
    }
    const manifestBytes = await readFile(join(source, 'plugin.json'))
    const manifest = JSON.parse(manifestBytes.toString('utf8'))
    const archive = join(temporary, 'plugin.asar')
    await createPackage(source, archive)
    const bytes = gzipSync(await readFile(archive), { level: 9 })
    const verified = join(temporary, 'verified.asar')
    await writeFile(verified, gunzipSync(bytes))
    if (!extractFile(verified, 'plugin.json').equals(manifestBytes)) throw new Error('UPX 清单校验失败')
    for (const name of [manifest.main, manifest.preload, manifest.logo]) {
      if (typeof name !== 'string' || !extractFile(verified, normalize(name)).length) throw new Error('UPX 缺少入口、preload 或图标')
    }
    await writeFile(outputFile, bytes)
    return bytes
  } finally {
    await rm(temporary, { recursive: true, force: true })
  }
}

if (import.meta.main) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  const plugin = join(root, 'utools')
  const { version } = JSON.parse(await readFile(join(plugin, 'plugin.json'), 'utf8'))
  const name = `utools-funcalc-${version}.upx`
  const bytes = await packPlugin(plugin, join(root, name))
  await writeFile(join(root, 'SHA256SUMS'), `${createHash('sha256').update(bytes).digest('hex')}  ${name}\n`)
  process.stdout.write(`${name}\n`)
}
