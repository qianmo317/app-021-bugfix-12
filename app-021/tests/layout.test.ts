import { describe, expect, it } from 'vitest'
import { buildSeatIndex, buildSeats, hasAisleAccess, middleColSet, positionScore } from '../src/lib/layout'
import type { LayoutConfig } from '../src/types'

const layout: LayoutConfig = { rows: 3, cols: 6, aisles: [2], mode: 'rows', doorSide: 'right' }

describe('座位布局', () => {
  it('生成行列齐全的座位并自动标注', () => {
    const seats = buildSeats(layout)
    expect(seats).toHaveLength(18)
    const r0c0 = seats.find((s) => s.id === 'r0c0')!
    expect(r0c0.tags).toContain('front')
    expect(r0c0.tags).toContain('window') // 门在右，窗在左
    const r2c5 = seats.find((s) => s.id === 'r2c5')!
    expect(r2c5.tags).toContain('back')
    expect(r2c5.tags).toContain('door')
    const r1c2 = seats.find((s) => s.id === 'r1c2')!
    expect(r1c2.tags).toContain('middle')
    expect(r1c2.tags).toContain('aisle') // 过道在 col2|col3 之间
    const r1c3 = seats.find((s) => s.id === 'r1c3')!
    expect(r1c3.tags).toContain('aisle')
  })

  it('门与窗固定在设置的一侧：doorSide=left 时门在左、窗在右', () => {
    const left: LayoutConfig = { ...layout, doorSide: 'left' }
    const byId = new Map(buildSeats(left).map((s) => [s.id, s]))
    for (let r = 0; r < left.rows; r++) {
      const doorSeat = byId.get(`r${r}c0`)!
      expect(doorSeat.tags).toContain('door')
      expect(doorSeat.tags).not.toContain('window')
      const windowSeat = byId.get(`r${r}c${left.cols - 1}`)!
      expect(windowSeat.tags).toContain('window')
      expect(windowSeat.tags).not.toContain('door')
    }
    // 改回 right：门回到最右列
    const right = new Map(buildSeats(layout).map((s) => [s.id, s]))
    expect(right.get('r0c5')!.tags).toContain('door')
    expect(right.get('r0c0')!.tags).toContain('window')
  })

  it('靠过道唯一规矩：首末列与过道旁都算，标记与判定一致', () => {
    const seats = buildSeats(layout) // 3×6，过道在 col2|col3
    const byId = new Map(seats.map((s) => [s.id, s]))
    // 首末列（两侧边缘）
    expect(byId.get('r1c0')!.tags).toContain('aisle')
    expect(byId.get('r1c5')!.tags).toContain('aisle')
    // 过道旁
    expect(byId.get('r1c2')!.tags).toContain('aisle')
    expect(byId.get('r1c3')!.tags).toContain('aisle')
    // 其余列不靠过道
    expect(byId.get('r1c1')!.tags).not.toContain('aisle')
    expect(byId.get('r1c4')!.tags).not.toContain('aisle')
    // hasAisleAccess 与座位标记是同一套结论
    for (const s of seats) expect(hasAisleAccess(layout, s)).toBe(s.tags.includes('aisle'))
    // 无过道配置时仍有首末列
    const noAisle: LayoutConfig = { ...layout, aisles: [] }
    const edgeOnly = buildSeats(noAisle).filter((s) => s.tags.includes('aisle'))
    expect(edgeOnly).toHaveLength(noAisle.rows * 2)
    // 小组围坐模式同样适用（边缘列便于进出）
    const groups: LayoutConfig = { rows: 2, cols: 4, aisles: [], mode: 'groups', doorSide: 'left' }
    const gSeats = buildSeats(groups)
    expect(gSeats.filter((s) => s.tags.includes('aisle'))).toHaveLength(4)
  })

  it('位置分：越靠前、越靠中间分数越低', () => {
    const seats = buildSeats(layout)
    const byId = new Map(seats.map((s) => [s.id, s]))
    expect(positionScore(byId.get('r0c2')!, layout)).toBeLessThan(positionScore(byId.get('r2c0')!, layout))
    expect(positionScore(byId.get('r1c2')!, layout)).toBeLessThan(positionScore(byId.get('r1c0')!, layout))
    expect(positionScore(byId.get('r0c2')!, layout)).toBeCloseTo(positionScore(byId.get('r0c3')!, layout), 10)
  })

  it('中间列集合：居中连续块', () => {
    expect(middleColSet(layout)).toEqual(new Set([2, 3]))
    expect(middleColSet({ ...layout, cols: 5 })).toEqual(new Set([1, 2, 3]))
    expect(middleColSet({ ...layout, cols: 8 })).toEqual(new Set([2, 3, 4, 5]))
  })

  it('同桌 = 同排相邻且中间无过道', () => {
    const seats = buildSeats(layout)
    const idx = buildSeatIndex(seats, layout)
    const idOf = (r: number, c: number) => r * 6 + c
    // r1: c0-c1 相邻同桌；c1 与 c2 之间无过道（过道在 c2|c3）
    expect(idx.deskmates[idOf(1, 0)]).toContain(idOf(1, 1))
    expect(idx.deskmates[idOf(1, 1)]).toContain(idOf(1, 2))
    // 过道隔开 c2 与 c3
    expect(idx.deskmates[idOf(1, 2)]).not.toContain(idOf(1, 3))
    expect(idx.deskmates[idOf(1, 3)]).not.toContain(idOf(1, 2))
    // 前后不是同桌
    expect(idx.deskmates[idOf(1, 1)]).not.toContain(idOf(0, 1))
  })

  it('小组围坐模式：同组成员互为同桌', () => {
    const g: LayoutConfig = { rows: 2, cols: 4, aisles: [], mode: 'groups', doorSide: 'left' }
    const idx = buildSeatIndex(buildSeats(g), g)
    const g1 = idx.deskmates[0] // r0c0 → G1
    expect(g1).toHaveLength(3) // r0c1, r1c0, r1c1
  })
})
