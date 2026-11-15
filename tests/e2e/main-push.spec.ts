import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'

test('主搜索框预览结果并复制，不保存历史', async ({ page }) => {
  const manifest = JSON.parse(readFileSync(new URL('../../utools/plugin.json', import.meta.url), 'utf8')) as {
    features: { code: string; mainPush?: boolean; cmds: { match?: string }[] }[]
  }
  const feature = manifest.features.find(item => item.code === 'quick-calc')
  expect(feature?.mainPush).toBe(true)
  const match = new RegExp(feature?.cmds[0]?.match ?? '')
  expect(match.test('0.1 + 0.2')).toBe(true)
  expect(match.test('price * 2')).toBe(false)
  await page.addInitScript({ content: `
    window.utools = {
      onMainPush(push, select) { this.push = push; this.select = select },
      copyText(text) { this.copied = text; return true },
      hideMainWindow() { this.hidden = true; return true }
    }
  ` })
  await page.goto('/')
  const result = await page.evaluate(() => {
    const host = window.utools as typeof window.utools & {
      push: (action: { code: string; type: 'regex'; payload: string }) => { text: string }[]
      select: (action: { code: string; option?: { text: string } }) => boolean
      copied: string
      hidden: boolean
    }
    const matches = host.push({ code: 'quick-calc', type: 'regex', payload: '0.1 + 0.2' })
    const invalid = host.push({ code: 'quick-calc', type: 'regex', payload: '1 / 0' })
    host.select({ code: 'quick-calc', option: { text: matches[0].text } })
    return { matches, invalid, copied: host.copied, hidden: host.hidden }
  })
  expect(result).toEqual({ matches: [{ text: '0.3', title: '选择后复制结果' }], invalid: [], copied: '0.3', hidden: true })
  await expect(page.locator('.history-card')).toHaveCount(0)
})
