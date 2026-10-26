<script setup lang="ts">
import logoUrl from '../utools/logo.png'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, toRaw, watch } from 'vue'
import MathFormula from './MathFormula.vue'
import { calculate, errorText, expressionTex, valueSize, valueTex, valueText } from './lib/math'
import { emptyNotebook, openNotebook, readNotebook, saveNotebook, type Entry, type Notebook } from './lib/storage'

const notebook = ref(emptyNotebook())
const expression = ref('')
const query = ref('')
const error = ref('')
const notice = ref('')
const ready = ref(false)
const busy = ref(false)
const help = ref(false)
const limit = ref(30)
const input = ref<HTMLTextAreaElement>()
const mainPane = ref<HTMLElement>()
const search = ref<HTMLInputElement>()
const clearDialog = ref<HTMLDialogElement>()
const deleted = ref<Entry>()
const theme = ref<'system' | 'light' | 'dark'>('system')
let db: IDBDatabase | undefined
let noticeTimer: ReturnType<typeof setTimeout> | undefined

const preview = computed(() => {
  if (!expression.value.trim()) return ''
  try { return expressionTex(expression.value) } catch { return '' }
})
const filtered = computed(() => {
  const keyword = query.value.trim().toLowerCase()
  return notebook.value.entries.filter(entry => !keyword || `${entry.expression} ${valueText(entry.value)}`.toLowerCase().includes(keyword))
})
const variables = computed(() => Object.entries(notebook.value.variables))
const examples = [
  { title: '日常计算', expression: '(128 + 64) * 0.85', note: '括号、百分比、精确小数' },
  { title: '定义变量', expression: 'price = 128', note: '存下常用数值，接着计算' },
  { title: '矩阵运算', expression: 'A = [1, 2; 3, 4]', note: '分号换行，逗号分列' },
]
const functions = ['sqrt(2)', 'sin(pi / 6)', 'det(A)', 'inv(A)', 'transpose(A)', 'A * A', 'A .* A']
const dateFormat = new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })

watch(query, () => { limit.value = 30 })
watch(expression, () => { if (ready.value) error.value = '' })
watch(theme, value => {
  document.documentElement.dataset.theme = value
  try { localStorage.setItem('funcalc-theme', value) } catch { /* 偏好保存失败不影响计算。 */ }
})

function notify(text: string) {
  notice.value = text
  clearTimeout(noticeTimer)
  noticeTimer = setTimeout(() => { notice.value = '' }, 3000)
}

async function focusInput(select = false) {
  await nextTick()
  input.value?.focus()
  if (select) input.value?.select()
}

async function load() {
  if (busy.value) return
  busy.value = true
  try {
    db ??= await openNotebook()
    notebook.value = await readNotebook(db)
    ready.value = true
    error.value = ''
  } catch (cause) {
    ready.value = false
    error.value = errorText(cause)
  } finally { busy.value = false }
}

async function persist(next: Notebook): Promise<boolean> {
  if (!db || !ready.value || busy.value) return false
  busy.value = true
  try {
    // IndexedDB 不能克隆 Vue Proxy；提交普通数据，成功之后再替换界面状态。
    notebook.value = await saveNotebook(db, JSON.parse(JSON.stringify(next)) as Notebook)
    error.value = ''
    return true
  } catch (cause) {
    error.value = errorText(cause)
    return false
  } finally { busy.value = false }
}

async function submit() {
  if (!ready.value || busy.value || !expression.value.trim()) return
  clearTimeout(noticeTimer)
  notice.value = ''
  const source = expression.value.trim()
  try {
    const result = calculate(source, toRaw(notebook.value.variables))
    const entry: Entry = { id: crypto.randomUUID(), expression: source, value: result.value, createdAt: Date.now() }
    if (await persist({ ...notebook.value, variables: result.variables, entries: [entry, ...notebook.value.entries] })) {
      query.value = ''
      notify('已计算并保存')
      mainPane.value?.scrollTo({ top: 0 })
      if (expression.value.trim() === source) void focusInput(true)
    }
  } catch (cause) { error.value = errorText(cause) }
}

function useExpression(value: string) {
  expression.value = value
  void focusInput()
}

function insert(value: string) {
  const start = input.value?.selectionStart ?? expression.value.length
  const end = input.value?.selectionEnd ?? start
  expression.value = expression.value.slice(0, start) + value + expression.value.slice(end)
  void nextTick(() => {
    input.value?.focus()
    input.value?.setSelectionRange(start + value.length, start + value.length)
  })
}

function keydown(event: KeyboardEvent) {
  if (event.isComposing || event.keyCode === 229) return
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    void submit()
  } else if (event.key === 'ArrowUp' && !expression.value && notebook.value.entries[0]) {
    event.preventDefault()
    useExpression(notebook.value.entries[0].expression)
  }
}

function shortcut(event: KeyboardEvent) {
  if (event.isComposing) return
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault()
    search.value?.focus()
  }
}

async function copy(text: string) {
  try {
    if (window.utools) {
      if (!window.utools.copyText(text)) throw new Error('复制失败，请重试')
    } else await navigator.clipboard.writeText(text)
    notify('已复制')
  } catch (cause) { error.value = errorText(cause) }
}

async function removeEntry(entry: Entry) {
  if (await persist({ ...notebook.value, entries: notebook.value.entries.filter(item => item.id !== entry.id) })) {
    deleted.value = entry
    notify('已删除记录')
  }
}

async function undoDelete() {
  if (!deleted.value) return
  const entries = [...notebook.value.entries, deleted.value].sort((a, b) => b.createdAt - a.createdAt)
  if (await persist({ ...notebook.value, entries })) deleted.value = undefined
}

async function removeVariable(name: string) {
  const next = { ...notebook.value.variables }
  delete next[name]
  if (await persist({ ...notebook.value, variables: next })) notify(`已删除变量 ${name}，历史结果保留`)
}

async function clearHistory() {
  if (await persist({ ...notebook.value, entries: [] })) {
    deleted.value = undefined
    clearDialog.value?.close()
    notify('已清空历史，变量仍保留')
  }
}

function exportHistory() {
  try {
    const text = JSON.stringify(notebook.value, null, 2)
    if (window.funcalc?.saveExport) {
      if (window.funcalc.saveExport(text)) notify('已导出历史与变量')
      return
    }
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `funcalc-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  } catch (cause) { error.value = errorText(cause) }
}

onMounted(async () => {
  try {
    const saved = localStorage.getItem('funcalc-theme')
    if (saved === 'light' || saved === 'dark') theme.value = saved
  } catch { /* 无偏好时跟随系统。 */ }
  window.addEventListener('keydown', shortcut)
  await load()
  window.funcalc?.onEnter(action => {
    if (action.code === 'calculate-selection' && typeof action.payload === 'string') expression.value = action.payload.slice(0, 500)
    window.utools?.setExpandHeight?.(620)
    void load().then(() => focusInput())
  })
  void focusInput()
})
onBeforeUnmount(() => {
  clearTimeout(noticeTimer)
  window.removeEventListener('keydown', shortcut)
  db?.close()
})
</script>

<template>
  <div class="app-shell">
    <header class="app-header">
      <div class="brand"><img class="brand-mark" :src="logoUrl" alt="" /><div><strong>算有所得</strong><span class="brand-caption">计算有迹可循</span></div></div>
      <div class="header-actions">
        <span class="local-badge"><span aria-hidden="true"></span>本机存储</span>
        <button class="quiet" :aria-expanded="help" @click="help = !help">使用指南</button>
        <select v-model="theme" aria-label="外观主题"><option value="system">跟随系统</option><option value="light">浅色</option><option value="dark">深色</option></select>
      </div>
    </header>

    <main class="workspace">
      <section ref="mainPane" class="main-pane" aria-label="计算笔记本">
        <div class="composer">
          <div class="section-heading"><label for="expression">开始计算</label><span>40 位有效数字 · 弧度制</span></div>
          <div class="input-box">
            <textarea id="expression" ref="input" v-model="expression" maxlength="500" rows="2" spellcheck="false" placeholder="输入表达式，例如 (128 + 64) × 0.85" aria-describedby="input-hint" @keydown="keydown"></textarea>
            <button class="calculate" :disabled="!ready || busy || !expression.trim()" @click="submit">{{ busy ? '处理中…' : '计算' }} <span aria-hidden="true">↵</span></button>
          </div>
          <div id="input-hint" class="input-hint"><span><kbd>Enter</kbd> 计算并保存 <span class="hint-divider">·</span> <kbd>↑</kbd> 空输入时取上一条</span><button class="text-button" @click="insert('[1, 2; 3, 4]')">插入矩阵</button></div>
          <div v-if="preview" class="preview"><span class="eyebrow">公式预览</span><MathFormula :tex="preview" :label="expression" /></div>
          <div v-if="error" class="error" role="alert"><span>{{ error }}</span><button :disabled="busy" @click="load">重新载入记录</button></div>
          <p v-else-if="!ready" class="muted" role="status">正在读取本机记录…</p>
        </div>

        <section v-if="help" class="help-panel" aria-label="使用指南">
          <div class="section-heading"><strong>一行表达式，一步计算</strong><button aria-label="关闭使用指南" @click="help = false">关闭</button></div>
          <p><code>price = 128</code> 定义变量；<code>price * 3</code> 使用变量；<code>ans</code> 引用上次结果。</p>
          <p><code>A = [1, 2; 3, 4]</code> 定义矩阵；<code>A * A</code> 矩阵乘法；<code>A .* A</code> 逐元素相乘。</p>
          <p>点击历史表达式重新编辑，回车按<strong>当前变量</strong>计算。旧结果不会改变。三角函数使用弧度，输入是数学表达式，LaTeX 用于显示与复制。</p>
          <div class="function-chips"><button v-for="item in functions" :key="item" @click="useExpression(item)">{{ item }}</button></div>
        </section>

        <div class="history-toolbar">
          <h1>计算历史 <span>{{ notebook.entries.length }}</span></h1>
          <div class="history-tools"><button :disabled="!ready || !notebook.entries.length" @click="exportHistory">导出</button><button :disabled="busy || !notebook.entries.length" @click="clearDialog?.showModal()">清空</button></div>
        </div>
        <div class="search-box"><svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4.5 4.5" /></svg><input ref="search" v-model="query" type="search" aria-label="搜索历史" placeholder="搜索表达式或结果"><kbd>⌘ / Ctrl K</kbd></div>

        <div v-if="!notebook.entries.length && ready" class="empty-state">
          <div class="empty-symbol" aria-hidden="true">x + y = ?</div>
          <h2>从一个想法，算到一个答案</h2>
          <p>每次计算都会留下记录，下次打开还能接着算。</p>
          <div class="examples"><button v-for="item in examples" :key="item.title" @click="useExpression(item.expression)"><strong>{{ item.title }} <span aria-hidden="true">↗</span></strong><code>{{ item.expression }}</code><span>{{ item.note }}</span></button></div>
        </div>
        <p v-else-if="!filtered.length && ready" class="no-results">没有匹配的记录，换个关键词试试。</p>
        <ol v-else class="history-list" aria-label="计算历史记录">
          <li v-for="(entry, index) in filtered.slice(0, limit)" :key="entry.id" class="history-card" :class="{ latest: index === 0 && !query }">
            <div class="entry-meta"><span>{{ index === 0 && !query ? '最近一次' : '计算记录' }}</span><time :datetime="new Date(entry.createdAt).toISOString()">{{ dateFormat.format(entry.createdAt) }}</time></div>
            <button class="entry-expression" :title="`重新编辑 ${entry.expression}，计算时使用当前变量`" @click="useExpression(entry.expression)">{{ entry.expression }}<span aria-hidden="true">↗</span></button>
            <div class="entry-result"><span class="equals" aria-hidden="true">=</span><MathFormula :tex="valueTex(entry.value)" :label="valueText(entry.value)" /></div>
            <div class="entry-actions"><span class="value-kind">{{ valueSize(entry.value) }}</span><button @click="copy(valueText(entry.value))">复制结果</button><button @click="copy(`${expressionTex(entry.expression)} = ${valueTex(entry.value)}`)">复制 LaTeX</button><button :disabled="busy" :aria-label="`删除记录 ${entry.expression}`" @click="removeEntry(entry)">删除</button></div>
          </li>
        </ol>
        <button v-if="filtered.length > limit" class="load-more" @click="limit += 30">再显示 30 条（剩余 {{ filtered.length - limit }} 条）</button>
      </section>

      <aside class="variables-pane" aria-label="变量">
        <div class="section-heading"><h2>变量</h2><span>{{ variables.length }}</span></div>
        <p class="sidebar-hint">保存常用数值，点击名称插入。</p>
        <div v-if="!variables.length" class="variable-empty"><span class="variable-icon" aria-hidden="true">x</span><p>给一个数起个名字</p><button class="text-button" @click="useExpression('price = 128')">试试 price = 128</button></div>
        <ul v-else class="variable-list">
          <li v-for="[name, value] in variables" :key="name">
            <div class="variable-head"><button class="variable-name" :title="`插入变量 ${name}`" @click="insert(name)">{{ name }}</button><button class="delete-variable" :disabled="busy" :aria-label="`删除变量 ${name}`" @click="removeVariable(name)">×</button></div>
            <span class="variable-type">{{ name === 'ans' ? '上次结果' : valueSize(value) }}</span>
            <MathFormula :tex="valueTex(value)" :label="valueText(value)" />
          </li>
        </ul>
        <div class="sidebar-note"><strong>保留的是当时的答案</strong><p>变量变化不会改写历史。重新计算会使用当前变量，并保存为新记录。</p></div>
      </aside>
    </main>

    <footer class="statusbar"><span role="status">{{ notice || (ready ? '历史与变量自动保存 · 无需联网' : '正在连接本机历史库') }}</span><button v-if="deleted" @click="undoDelete">撤销删除</button><span class="version">FunCalc 0.1</span></footer>
    <dialog ref="clearDialog" class="confirm-dialog" aria-labelledby="clear-title">
      <h2 id="clear-title">清空全部计算历史？</h2><p>将删除 {{ notebook.entries.length }} 条记录，变量会保留。此操作不可撤销，建议先导出。</p>
      <div class="dialog-actions"><button autofocus @click="clearDialog?.close()">取消</button><button class="danger" :disabled="busy" @click="clearHistory">确认清空</button></div>
    </dialog>
  </div>
</template>
