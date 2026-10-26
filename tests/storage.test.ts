import { IDBFactory } from 'fake-indexeddb'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { calculate } from '../src/lib/math'
import { emptyNotebook, openNotebook, readNotebook, saveNotebook, type Notebook } from '../src/lib/storage'

let db: IDBDatabase
beforeEach(async () => {
  vi.stubGlobal('indexedDB', new IDBFactory())
  db = await openNotebook()
})
afterEach(() => { db.close(); vi.unstubAllGlobals() })

function append(state: Notebook, expression: string): Notebook {
  const result = calculate(expression, state.variables)
  return { ...state, variables: result.variables, entries: [{ id: crypto.randomUUID(), expression, value: result.value, createdAt: Date.now() }, ...state.entries] }
}

test('重开数据库同时恢复变量和历史，修改变量不改写旧答案', async () => {
  let state = await saveNotebook(db, append(emptyNotebook(), 'price = 128'))
  state = await saveNotebook(db, append(state, 'price * 3'))
  await saveNotebook(db, append(state, 'price = 5'))
  db.close()
  db = await openNotebook()
  const restored = await readNotebook(db)
  expect(restored.variables.price).toBe('5')
  expect(restored.entries[1].value).toBe('384')
  expect(restored.entries).toHaveLength(3)
})

test('拒绝过期窗口覆盖，不丢失已提交历史', async () => {
  const first = await saveNotebook(db, append(emptyNotebook(), '1 + 2'))
  await expect(saveNotebook(db, append(emptyNotebook(), '4 + 5'))).rejects.toThrow('另一个窗口')
  expect(await readNotebook(db)).toEqual(first)
})

test('事务中止时历史和变量一起回滚', async () => {
  const first = await saveNotebook(db, append(emptyNotebook(), 'a = 3'))
  const original = db.transaction.bind(db)
  vi.spyOn(db, 'transaction').mockImplementation((...args) => {
    const transaction = original(...args)
    if (args[1] === 'readwrite') {
      const objectStore = transaction.objectStore.bind(transaction)
      vi.spyOn(transaction, 'objectStore').mockImplementation(name => {
        const store = objectStore(name)
        vi.spyOn(store, 'put').mockImplementation(() => { throw new DOMException('Disk full', 'QuotaExceededError') })
        return store
      })
    }
    return transaction
  })
  await expect(saveNotebook(db, append(first, 'a = 99'))).rejects.toThrow('保存失败')
  expect(await readNotebook(db)).toEqual(first)
})

test('清空历史不删除变量，不自动截断旧记录', async () => {
  const first = append(emptyNotebook(), 'a = 3')
  first.entries = Array.from({ length: 1100 }, (_, i) => ({ ...first.entries[0], id: String(i) }))
  const saved = await saveNotebook(db, first)
  expect((await readNotebook(db)).entries).toHaveLength(1100)
  await saveNotebook(db, { ...saved, entries: [] })
  expect((await readNotebook(db)).variables.a).toBe('3')
})

test('损坏的存档不会被当成空历史继续写入', async () => {
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction('notebook', 'readwrite')
    transaction.objectStore('notebook').put({ ...emptyNotebook(), variables: { x: '<script>' } }, 'state')
    transaction.oncomplete = () => resolve()
    transaction.onabort = () => reject(transaction.error)
  })
  await expect(readNotebook(db)).rejects.toThrow('停止写入')
})
