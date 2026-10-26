import { validName, type Value, type Variables } from './math'

export interface Entry {
  id: string
  expression: string
  value: Value
  createdAt: number
}

export interface Notebook {
  version: 1
  revision: number
  entries: Entry[]
  variables: Variables
}

export function emptyNotebook(): Notebook {
  return { version: 1, revision: 0, entries: [], variables: {} }
}

function validValue(value: unknown): value is Value {
  const number = (item: unknown): item is string => typeof item === 'string' && item.length <= 128 && /^-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(item)
  if (number(value)) return true
  if (!Array.isArray(value) || !value.length || value.length > 16) return false
  if (value.every(number)) return true
  const width = Array.isArray(value[0]) ? value[0].length : 0
  return width > 0 && width <= 16 && value.every(row => Array.isArray(row) && row.length === width && row.every(number))
}

function validNotebook(state: Notebook): boolean {
  return state.version === 1 && Number.isSafeInteger(state.revision) && state.revision >= 0
    && Array.isArray(state.entries) && state.entries.every(entry => entry && typeof entry.id === 'string'
      && typeof entry.expression === 'string' && entry.expression.length <= 500
      && Number.isFinite(entry.createdAt) && entry.createdAt >= 0 && entry.createdAt <= 8640000000000000 && validValue(entry.value))
    && !!state.variables && typeof state.variables === 'object' && !Array.isArray(state.variables)
    && Object.entries(state.variables).every(([name, value]) => (name === 'ans' || validName(name)) && validValue(value))
}

export function openNotebook(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('funcalc-notebook', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('notebook')
    request.onsuccess = () => {
      request.result.onversionchange = () => request.result.close()
      resolve(request.result)
    }
    request.onerror = () => reject(new Error('无法打开本机历史库，请检查磁盘空间和存储权限'))
    request.onblocked = () => reject(new Error('请关闭另一个算有所得窗口后重试'))
  })
}

export function readNotebook(db: IDBDatabase): Promise<Notebook> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('notebook', 'readonly')
    const request = transaction.objectStore('notebook').get('state')
    transaction.oncomplete = () => {
      const state = request.result as Notebook | undefined
      if (state && !validNotebook(state)) {
        reject(new Error('历史数据格式无法读取，已停止写入以保护原记录'))
      } else resolve(state ?? emptyNotebook())
    }
    transaction.onabort = () => reject(new Error('读取历史失败，请重新载入'))
  })
}

// 历史与变量在同一事务提交；失败保留原记录，多窗口修改则拒绝覆盖。
export function saveNotebook(db: IDBDatabase, next: Notebook): Promise<Notebook> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('notebook', 'readwrite')
    const store = transaction.objectStore('notebook')
    const request = store.get('state')
    let message = '保存失败，请检查磁盘空间；原记录没有被覆盖'
    const saved = { ...next, revision: next.revision + 1 }
    request.onsuccess = () => {
      if ((request.result?.revision ?? 0) !== next.revision) {
        message = '历史已在另一个窗口更新，请重新载入后再计算'
        transaction.abort()
        return
      }
      try {
        store.put(saved, 'state')
      } catch {
        transaction.abort()
      }
    }
    transaction.oncomplete = () => resolve(saved)
    transaction.onabort = () => reject(new Error(message))
  })
}
