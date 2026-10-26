import { type Value, type Variables } from './math'

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

export function openNotebook(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('funcalc-notebook', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('notebook')
    request.onsuccess = () => {
      request.result.onversionchange = () => request.result.close()
      resolve(request.result)
    }
    request.onerror = () => reject(new Error('无法打开本机历史库，请检查磁盘空间和存储权限'))
    request.onblocked = () => reject(new Error('请关闭另一个 FunCalc 窗口后重试'))
  })
}

export function readNotebook(db: IDBDatabase): Promise<Notebook> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('notebook', 'readonly')
    const request = transaction.objectStore('notebook').get('state')
    transaction.oncomplete = () => {
      const state = request.result as Notebook | undefined
      if (state && (state.version !== 1 || !Array.isArray(state.entries) || !state.variables || !Number.isInteger(state.revision))) {
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
