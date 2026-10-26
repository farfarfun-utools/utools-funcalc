import { describe, expect, test } from 'vitest'
import { calculate, expressionTex, valueTex, valueText } from '../src/lib/math'

describe('实数计算', () => {
  test.each([
    ['0.1 + 0.2', '0.3'], ['(128 + 64) * 0.85', '163.2'],
    ['2 + 3 * 4', '14'], ['2^3^2', '512'], ['-2^2', '-4'],
    ['sqrt(81)', '9'], ['50%', '0.5'], ['200 * 10%', '20'],
    ['（2 + 3）× 4 ÷ 2', '10'], ['1e3 + 2', '1002'],
  ])('%s = %s', (expression, result) => expect(calculate(expression, {}).value).toBe(result))

  test('变量与上次结果独立于传入状态，失败不改变变量', () => {
    const first = calculate('price = 128', {})
    expect(calculate('price * 3', first.variables).value).toBe('384')
    expect(calculate('ans + 2', first.variables).value).toBe('130')
    expect(() => calculate('price = 1 / 0', first.variables)).toThrow()
    expect(first.variables.price).toBe('128')
  })

  test.each(['1 / 0', 'sqrt(-1)', 'a + 1', 'x = y = 3', 'f(x) = x + 1', 'import("x")', 'evaluate("2+2")', 'a.constructor', 'pi = 4', 'ans = 2', 'ones(100000000)', '2^1001', '2^(2^20)', '2; 3'])('拒绝无效或不支持的表达式 %s', expression => {
    expect(() => calculate(expression, {})).toThrow()
  })
})

describe('矩阵与公式', () => {
  const matrix = calculate('A = [1, 2; 3, 4]', {})
  test('矩阵乘法与逐元素乘法', () => {
    expect(calculate('A * A', matrix.variables).value).toEqual([['7', '10'], ['15', '22']])
    expect(calculate('A .* A', matrix.variables).value).toEqual([['1', '4'], ['9', '16']])
  })
  test('行列式、逆矩阵、转置', () => {
    expect(calculate('det(A)', matrix.variables).value).toBe('-2')
    expect(calculate('inv(A)', matrix.variables).value).toEqual([['-2', '1'], ['1.5', '-0.5']])
    expect(calculate('transpose(A)', matrix.variables).value).toEqual([['1', '3'], ['2', '4']])
  })
  test('向量变量可用于点积', () => {
    const vector = calculate('v = [1, 2, 3]', {})
    expect(calculate('dot(v, v)', vector.variables).value).toBe('14')
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
