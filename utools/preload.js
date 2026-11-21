const fs = require('node:fs')
const MAX_EXPORT_BYTES = 20 * 1024 * 1024
let pending = null
let onEnter = null

utools.onPluginEnter(action => {
  if (onEnter) onEnter(action)
  else pending = action
})

window.funcalc = {
  saveExport(text) {
    if (typeof text !== 'string' || !text.length || Buffer.byteLength(text, 'utf8') > MAX_EXPORT_BYTES) {
      throw new Error('导出内容无效或超过 20 MB')
    }
    const target = utools.showSaveDialog({
      title: '导出算有所得 FunCalc 历史与变量',
      defaultPath: `funcalc-${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    })
    if (!target) return false
    try {
      fs.writeFileSync(target, text, 'utf8')
      return true
    } catch (error) {
      if (error && error.code === 'ENOSPC') throw new Error('导出失败：磁盘空间不足')
      if (error && (error.code === 'EACCES' || error.code === 'EPERM' || error.code === 'EROFS')) throw new Error('导出失败：没有写入该位置的权限')
      throw new Error('导出失败，请检查目标路径与磁盘空间')
    }
  },
  onEnter(callback) {
    if (typeof callback !== 'function') throw new TypeError('onEnter 需要传入回调函数')
    onEnter = callback
    if (pending) {
      const action = pending
      pending = null
      callback(action)
    }
    return () => {
      if (onEnter === callback) onEnter = null
    }
  },
}
