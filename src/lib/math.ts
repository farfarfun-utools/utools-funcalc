import { all, create, type AssignmentNode, type FunctionNode, type MathNode, type OperatorNode, type SymbolNode } from 'mathjs'

const math = create(all, { number: 'BigNumber', precision: 40, predictable: true })
export type Value = string | string[] | string[][]
export type Variables = Record<string, Value>
export const FUNCTIONS = ['sqrt', 'abs', 'exp', 'log', 'log10', 'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'round', 'floor', 'ceil', 'min', 'max', 'sum', 'mean', 'det', 'inv', 'transpose', 'trace', 'norm', 'dot', 'cross', 'dotMultiply', 'dotDivide']
const constants = ['pi', 'e', 'tau']
const allowedNodes = new Set(['ConstantNode', 'SymbolNode', 'OperatorNode', 'ParenthesisNode', 'ArrayNode', 'FunctionNode', 'AssignmentNode'])
const allowedOperators = new Set(['+', '-', '*', '/', '^', '%', '.*', './', '.^'])

export function validName(name: string): boolean {
  return /^[A-Za-z][A-Za-z0-9_]{0,31}$/.test(name) && ![...FUNCTIONS, ...constants, 'constructor', 'prototype', 'ans'].includes(name)
}

function parse(expression: string): MathNode {
  if (!expression.trim()) throw new Error('先输入一个表达式')
  if (expression.length > 500) throw new Error('表达式最多 500 个字符，请拆成几步计算')
  const normalized = expression.replace(/[×÷−（）]/g, character => ({ '×': '*', '÷': '/', '−': '-', '（': '(', '）': ')' })[character]!)
  const root = math.parse(normalized)
  let count = 0
  root.traverse(node => {
    if (++count > 160) throw new Error('表达式过于复杂，请拆成几步计算')
    if (!allowedNodes.has(node.type)) throw new Error('暂不支持这种语法；每次输入一个表达式或变量赋值')
    if (node.type === 'AssignmentNode') {
      const assignment = node as AssignmentNode
      if (node !== root || assignment.index || !validName(assignment.name)) throw new Error('变量名请使用字母开头的英文、数字或下划线，且不要使用保留名称')
    }
    if (node.type === 'OperatorNode' && !allowedOperators.has((node as OperatorNode).op)) throw new Error('暂不支持这个运算符')
    if (node.type === 'FunctionNode' && !FUNCTIONS.includes((node as FunctionNode).fn.name)) throw new Error(`不支持函数 ${(node as FunctionNode).fn.name}`)
    if (node.type === 'SymbolNode' && ['constructor', 'prototype', '__proto__'].includes((node as SymbolNode).name)) throw new Error('不支持这个名称')
  })
  return root
}

function scalar(value: unknown): string {
  if (typeof value !== 'number' && !math.isBigNumber(value)) throw new Error('当前只支持实数、向量和二维矩阵')
  const number = math.bignumber(value)
  if (!number.isFinite()) throw new Error('结果不是有限实数，请检查除零或函数的取值范围')
  return number.isZero() ? '0' : number.toSignificantDigits(40).toString()
}

function encode(value: unknown): Value {
  if (math.isMatrix(value)) value = value.toArray()
  if (!Array.isArray(value)) return scalar(value)
  if (!value.length || value.length > 16) throw new Error('向量最多 16 项，矩阵最大 16 × 16')
  if (!Array.isArray(value[0])) return value.map(scalar)
  const columns = value[0].length
  if (!columns || columns > 16 || value.some(row => !Array.isArray(row) || row.length !== columns)) throw new Error('矩阵每一行的列数须一致，最大 16 × 16')
  return value.map(row => row.map(scalar))
}

function decode(value: Value) {
  if (typeof value === 'string') return math.bignumber(value)
  return math.matrix(value.map(row => typeof row === 'string' ? math.bignumber(row) : row.map(item => math.bignumber(item))))
}

export function expressionTex(expression: string): string {
  return parse(expression).toTex({ parenthesis: 'auto', implicit: 'show' })
}

export function valueText(value: Value): string {
  if (typeof value === 'string') return value
  return `[${value.map(row => typeof row === 'string' ? row : row.join(', ')).join(Array.isArray(value[0]) ? '; ' : ', ')}]`
}

export function valueTex(value: Value): string {
  if (typeof value === 'string') return math.parse(value).toTex()
  const rows = Array.isArray(value[0]) ? value as string[][] : [value as string[]]
  return `\\begin{bmatrix}${rows.map(row => row.map(item => valueTex(item)).join(' & ')).join(' \\\\ ')}\\end{bmatrix}`
}

export function valueSize(value: Value): string {
  if (typeof value === 'string') return '实数'
  return Array.isArray(value[0]) ? `${value.length} × ${value[0].length} 矩阵` : `${value.length} 维向量`
}

export function calculate(expression: string, variables: Variables): { value: Value; variables: Variables } {
  const root = parse(expression)
  const scope = new Map(Object.entries(variables).map(([name, value]) => [name, decode(value)]))
  const powers: OperatorNode[] = []
  root.traverse(node => {
    if (node.type === 'OperatorNode' && ['^', '.^'].includes((node as OperatorNode).op)) powers.push(node as OperatorNode)
  })
  for (const power of powers.reverse()) {
    const exponent = encode(power.args[1].compile().evaluate(scope))
    if (typeof exponent !== 'string' || math.bignumber(exponent).abs().gt(1000)) throw new Error('幂指数须为绝对值不超过 1000 的实数')
  }
  root.traverse(node => {
    if (node.type === 'ArrayNode') encode(node.compile().evaluate(scope))
  })
  const value = encode(root.compile().evaluate(scope))
  const next: Variables = { ...variables, ans: value }
  if (root.type === 'AssignmentNode') {
    const name = (root as AssignmentNode).name
    if (!(name in variables) && Object.keys(variables).filter(key => key !== 'ans').length >= 64) throw new Error('最多保留 64 个变量，请先删除不再使用的变量')
    next[name] = value
  }
  return { value, variables: next }
}

export function errorText(error: unknown): string {
  const text = error instanceof Error ? error.message : '计算失败，请检查表达式'
  if (text.includes('Undefined symbol')) return text.replace('Undefined symbol', '未定义变量')
  if (/dimension|Dimension/.test(text)) return '矩阵尺寸不匹配，请检查行数、列数和运算方式'
  if (/singular|determinant is zero/i.test(text)) return '这个矩阵不可逆，行列式为 0'
  if (/Unexpected|expected|Value expected/.test(text)) return `表达式格式有误：${text}`
  return text
}
