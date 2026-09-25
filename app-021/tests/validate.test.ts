import { describe, expect, it } from 'vitest'
import { validateClass } from '../src/lib/validate'
import { hasAisleAccess } from '../src/lib/layout'
import { makeClass } from './helpers'

describe('配置校验：靠过道容量与排座同一套规矩', () => {
  it('容量提示 = 首末列 + 过道旁座位数', () => {
    const cls = makeClass({ rows: 2, cols: 4, aisles: [], weeks: 2 })
    // 无过道：首末列 2 列 × 2 行 = 4 个靠过道座位
    const cap = cls.seats.filter((s) => hasAisleAccess(cls.layout, s)).length
    expect(cap).toBe(4)
    for (let i = 0; i < 4; i++) cls.students[i].special = ['mobility']
    expect(validateClass(cls).join()).not.toContain('靠过道')
    // 第 5 名行动不便学生超出容量，提示中的容量数与实际可用数一致
    cls.students[4].special = ['mobility']
    expect(validateClass(cls).join()).toContain('超过靠过道座位容量 4 个')
  })

  it('固定座位校验：末列也算靠过道', () => {
    const cls = makeClass({ rows: 2, cols: 4, aisles: [], weeks: 2 })
    cls.students[0].special = ['mobility']
    cls.students[0].fixedSeatId = 'r0c3' // 末列
    expect(validateClass(cls)).toHaveLength(0)
    cls.students[0].fixedSeatId = 'r0c1' // 中间列
    expect(validateClass(cls).join()).toContain('不靠过道')
  })
})
