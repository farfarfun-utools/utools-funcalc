import { afterEach, expect, test } from 'vitest'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, normalize } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { extractFile, listPackage } from '@electron/asar'
import { packPlugin } from '../scripts/package.mjs'

const folders: string[] = []
afterEach(async () => {
  for (const folder of folders.splice(0)) await rm(folder, { recursive: true, force: true })
})

async function fixture() {
  const folder = await mkdtemp(join(tmpdir(), 'funcalc-package-test-'))
  folders.push(folder)
  const plugin = join(folder, 'plugin')
  await mkdir(join(plugin, 'dist', 'assets'), { recursive: true })
  const manifest = { pluginName: '算有所得', version: '0.1.1', main: 'dist/index.html', preload: 'preload.js', logo: 'logo.png' }
  const files = {
    'plugin.json': JSON.stringify(manifest),
    'preload.js': 'window.funcalc = {}',
    'logo.png': Buffer.from([0x89, 0x50, 0x4e, 0x47]),
    'dist/index.html': '<script src="./assets/app.js"></script>',
    'dist/assets/app.js': 'console.log("计算器")',
    'dist/assets/font.woff2': Buffer.from([0, 1, 2, 255]),
    'README.md': 'do not package source files',
  }
  for (const [name, contents] of Object.entries(files)) await writeFile(join(plugin, name), contents)
  return { folder, plugin, files }
}

test('UPX 是 gzip 压缩的 ASAR，清单在根目录，页面和离线资源可完整解出', async () => {
  const { folder, plugin, files } = await fixture()
  const output = join(folder, 'plugin.upx')
  await packPlugin(plugin, output)
  const bytes = await readFile(output)
  expect([...bytes.subarray(0, 3)]).toEqual([0x1f, 0x8b, 0x08])
  const archive = join(folder, 'decoded.asar')
  await writeFile(archive, gunzipSync(bytes))
  const names = listPackage(archive).map(name => name.replaceAll('\\', '/'))
  expect(names).toContain('/plugin.json')
  expect(names).not.toContain('/README.md')
  for (const [name, contents] of Object.entries(files)) {
    if (name === 'README.md') continue
    expect(extractFile(archive, normalize(name))).toEqual(Buffer.from(contents))
  }
})

test('入口文件缺失时拒绝生成假成功的 UPX', async () => {
  const { folder, plugin } = await fixture()
  await rm(join(plugin, 'dist', 'index.html'))
  const output = join(folder, 'plugin.upx')
  await expect(packPlugin(plugin, output)).rejects.toThrow()
  await expect(readFile(output)).rejects.toThrow()
})
