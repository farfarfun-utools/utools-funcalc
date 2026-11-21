import { describe, expect, test } from 'vitest'
import { calculate, calculateForAgent, expressionTex, validName, valueTex, valueText, type Variables } from '../src/lib/math'

describe('实数计算', () => {
  test('AI 一次性计算不依赖或修改笔记本变量', () => {
    expect(calculateForAgent('0.1 + 0.2')).toEqual({ result: '0.3', latex: '0.3' })
    expect(calculateForAgent('[1, 2; 3, 4] .* [2, 2; 2, 2]')).toEqual({
      result: '[2, 4; 6, 8]',
      latex: '\\begin{bmatrix}2 & 4 \\\\ 6 & 8\\end{bmatrix}',
    })
    expect(() => calculateForAgent('ans + 1')).toThrow('未定义')
    expect(() => calculateForAgent(null)).toThrow('表达式')
    expect(() => calculateForAgent(undefined)).toThrow('表达式')
    expect(() => calculateForAgent(123)).toThrow('表达式')
    expect(() => calculateForAgent('   ')).toThrow('先输入一个表达式')
    expect(() => calculateForAgent('1 / 0')).toThrow('有限实数')
  })
  test.each([
    ['0.1 + 0.2', '0.3'], ['(128 + 64) * 0.85', '163.2'],
    ['2 + 3 * 4', '14'], ['2^3^2', '512'], ['-2^2', '-4'],
    ['sqrt(81)', '9'], ['50%', '0.5'], ['200 * 10%', '20'],
    ['（2 + 3）× 4 ÷ 2', '10'], ['1e3 + 2', '1002'],
    ['round(sin(pi / 6), 10)', '0.5'], ['cos(0)', '1'], ['log10(1000)', '3'], ['round(tau, 2)', '6.28'],
  ])('%s = %s', (expression, result) => expect(calculate(expression, {}).value).toBe(result))

  test('变量与上次结果独立于传入状态，失败不改变变量', () => {
    const first = calculate('price = 128', {})
    expect(calculate('price * 3', first.variables).value).toBe('384')
    expect(calculate('ans + 2', first.variables).value).toBe('130')
    expect(() => calculate('price = 1 / 0', first.variables)).toThrow()
    expect(first.variables.price).toBe('128')
  })

  test('拒绝原型链属性作为变量名，且最多保留 64 个变量', () => {
    for (const name of ['toString', 'valueOf', 'hasOwnProperty', 'constructor', 'prototype', '__proto__']) {
      expect(validName(name)).toBe(false)
      expect(() => calculate(`${name} = 1`, {})).toThrow('变量名')
    }
    const full: Variables = {}
    for (let index = 0; index < 64; index++) full[`v${index}`] = String(index)
    full.ans = '63'
    expect(calculate('v0 = 99', full).variables.v0).toBe('99')
    expect(() => calculate('v64 = 1', full)).toThrow('64 个变量')
  })

  test.each(['1 / 0', 'sqrt(-1)', 'a + 1', 'x = y = 3', 'f(x) = x + 1', 'import("x")', 'evaluate("2+2")', 'a.constructor', 'pi = 4', 'ans = 2', 'ones(100000000)', '2^1001', '2^(2^20)', '2; 3'])('拒绝无效或不支持的表达式 %s', expression => {
    expect(() => calculate(expression, {})).toThrow()
  })
})

describe('矩阵与公式', () => {
  const matrix = calculate('A = [1, 2; 3, 4]', {})
  test('矩阵乘法、逐元素乘除与逐元素幂', () => {
    expect(calculate('A * A', matrix.variables).value).toEqual([['7', '10'], ['15', '22']])
    expect(calculate('A .* A', matrix.variables).value).toEqual([['1', '4'], ['9', '16']])
    expect(calculate('[4, 9] ./ [2, 3]', {}).value).toEqual(['2', '3'])
    expect(calculate('[2, 3] .^ [2, 3]', {}).value).toEqual(['4', '27'])
    expect(calculate('[1, 2; 3, 4] .^ [2, 3; 1, 2]', {}).value).toEqual([['1', '8'], ['3', '16']])
    expect(calculate('2 .^ [1, 2, 3]', {}).value).toEqual(['2', '4', '8'])
    expect(() => calculate('[2, 3] .^ [2, 1001]', {})).toThrow('幂指数')
    expect(() => calculate('[1, 2; 3, 4] .^ [1, 2; 3, -1001]', {})).toThrow('幂指数')
    expect(() => calculate('[2, 3] ^ [2, 3]', {})).toThrow('幂指数')
  })
  test('行列式、逆矩阵、转置、迹与统计函数', () => {
    expect(calculate('det(A)', matrix.variables).value).toBe('-2')
    expect(calculate('inv(A)', matrix.variables).value).toEqual([['-2', '1'], ['1.5', '-0.5']])
    expect(calculate('transpose(A)', matrix.variables).value).toEqual([['1', '3'], ['2', '4']])
    expect(calculate('trace(A)', matrix.variables).value).toBe('5')
    expect(calculate('sum([1, 2, 3])', {}).value).toBe('6')
    expect(calculate('mean([2, 4, 6])', {}).value).toBe('4')
    expect(calculate('min([3, 1, 2])', {}).value).toBe('1')
    expect(calculate('max([3, 1, 2])', {}).value).toBe('3')
  })
  test('向量变量可用于点积、叉积与范数', () => {
    const vector = calculate('v = [1, 2, 3]', {})
    expect(calculate('dot(v, v)', vector.variables).value).toBe('14')
    expect(calculate('cross([1, 0, 0], [0, 1, 0])', {}).value).toEqual(['0', '0', '1'])
    expect(calculate('norm([3, 4])', {}).value).toBe('5')
  })
  test('尺寸错误与奇异矩阵不保存', () => {
    expect(() => calculate('A * [1, 2, 3]', matrix.variables)).toThrow()
    expect(() => calculate('inv([1, 2; 2, 4])', {})).toThrow()
    expect(() => calculate(`[${Array(17).fill('1').join(',')}]`, {})).toThrow()
  })
  test('结果可重新输入，并生成可复制的 LaTeX', () => {
    const text = valueText(matrix.value)
    expect(calculate(text, {}).value).toEqual(matrix.value)
    expect(valueTex(matrix.value)).toBe('\\begin{bmatrix}1 & 2 \\\\ 3 & 4\\end{bmatrix}')
    expect(expressionTex('1 / 2')).toContain('frac')
    expect(expressionTex('sqrt(2)')).toContain('sqrt')
  })
})
