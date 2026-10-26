const fs = require('node:fs')
let pending = null
let onEnter = null

utools.onPluginEnter(action => {
  if (onEnter) onEnter(action)
  else pending = action
})

window.funcalc = {
  saveExport(text) {
    const target = utools.showSaveDialog({
      title: '导出算有所得 FunCalc 历史与变量',
      defaultPath: `funcalc-${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    })
    if (!target) return false
    fs.writeFileSync(target, text, 'utf8')
    return true
  },
  onEnter(callback) {
    onEnter = callback
    if (pending) {
      callback(pending)
      pending = null
    }
  },
}
