import { describe, expect, it } from 'vitest'
import {
  aisleSeatCount,
  buildSeatIndex,
  buildSeats,
  isAisleSeat,
  middleColSet,
  normalizeSeats,
  positionScore,
} from '../src/lib/layout'
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

  it('门在左时门/窗标签整体翻转：标签、位置一一对应', () => {
    const right = buildSeats(layout) // 门在右
    const left = buildSeats({ ...layout, doorSide: 'left' })
    const rightById = new Map(right.map((s) => [s.id, s]))
    for (const s of left) {
      const mirrorCol = layout.cols - 1 - s.col
      const mirror = rightById.get(`r${s.row}c${mirrorCol}`)!
      // 镜像列上的 door/window 标签必须一致（左配置的左列 = 右配置的右列）
      expect(s.tags.includes('door')).toBe(mirror.tags.includes('door'))
      expect(s.tags.includes('window')).toBe(mirror.tags.includes('window'))
    }
    // 直接断言关键座位
    const leftById = new Map(left.map((s) => [s.id, s]))
    expect(leftById.get('r0c0')!.tags).toContain('door')
    expect(leftById.get('r0c0')!.tags).not.toContain('window')
    expect(leftById.get('r0c5')!.tags).toContain('window')
    expect(leftById.get('r0c5')!.tags).not.toContain('door')
  })

  it('靠过道判定：内部过道两侧 + 首末列，且门窗配置不影响', () => {
    // 内部过道 c2|c3 → c2、c3 靠过道；c0、c5 是教室边列也算
    for (const row of [0, 1, 2]) {
      expect(isAisleSeat(layout, row, 0)).toBe(true)
      expect(isAisleSeat(layout, row, 1)).toBe(false)
      expect(isAisleSeat(layout, row, 2)).toBe(true)
      expect(isAisleSeat(layout, row, 3)).toBe(true)
      expect(isAisleSeat(layout, row, 4)).toBe(false)
      expect(isAisleSeat(layout, row, 5)).toBe(true)
    }
    const seats = buildSeats(layout)
    const aisleSeats = seats.filter((s) => s.tags.includes('aisle'))
    expect(aisleSeats.length).toBe(aisleSeatCount(layout))
    // 3 行 × (c0,c2,c3,c5) = 12
    expect(aisleSeats.length).toBe(12)
    // 门在左时容量完全一致
    expect(aisleSeatCount({ ...layout, doorSide: 'left' })).toBe(12)
  })

  it('无内部过道时仍保留两边首末列，小组模式只认边列', () => {
    const rowsMode: LayoutConfig = { rows: 4, cols: 6, aisles: [], mode: 'rows', doorSide: 'right' }
    expect(aisleSeatCount(rowsMode)).toBe(8) // 4 行 × 2 边列
    const groups: LayoutConfig = { rows: 4, cols: 6, aisles: [2], mode: 'groups', doorSide: 'right' }
    // groups 模式下 aisles 配置不渲染过道，只有首末列算靠过道
    expect(isAisleSeat(groups, 0, 2)).toBe(false)
    expect(isAisleSeat(groups, 0, 3)).toBe(false)
    expect(isAisleSeat(groups, 0, 0)).toBe(true)
    expect(isAisleSeat(groups, 0, 5)).toBe(true)
    expect(aisleSeatCount(groups)).toBe(8)
  })

  it('normalizeSeats：旧数据的写死门窗/漏标过道被刷新，座位本体不变', () => {
    const stale = buildSeats(layout).map((s) => {
      if (s.col === 0) return { ...s, tags: s.tags.filter((t) => t !== 'window') }
      if (s.col === layout.cols - 1) return { ...s, tags: s.tags.filter((t) => t !== 'door') }
      if (s.col === 0 || s.col === layout.cols - 1) return s
      return s
    })
    const fixed = normalizeSeats({ ...layout, doorSide: 'left' }, stale)
    const byId = new Map(fixed.map((s) => [s.id, s]))
    expect(byId.get('r0c0')!.tags).toContain('door') // 门已翻到左
    expect(byId.get('r0c5')!.tags).toContain('window')
    expect(byId.get('r0c0')!.tags).toContain('aisle') // 边列补上靠过道
    expect(byId.get('r0c5')!.tags).toContain('aisle')
    // 座位数量与 id 不变
    expect(fixed.map((s) => s.id)).toEqual(stale.map((s) => s.id))
    // 维度不匹配时整体重建
    const rebuilt = normalizeSeats({ ...layout, rows: 4, cols: 4 }, stale)
    expect(rebuilt).toHaveLength(16)
  })
})
