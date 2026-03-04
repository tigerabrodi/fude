// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest'
import { segmentsEqual } from '../src/segments-equal'
import type { MentionItem, Segment } from '../src/types'

function createItem(id: string, name: string): MentionItem {
  return { id, searchValue: name, label: name }
}

describe('segmentsEqual', () => {
  it('returns true for two empty arrays', () => {
    expect(segmentsEqual([], [])).toBe(true)
  })

  it('returns true for matching text segments', () => {
    const a: Array<Segment> = [{ type: 'text', value: 'hello' }]
    const b: Array<Segment> = [{ type: 'text', value: 'hello' }]
    expect(segmentsEqual(a, b)).toBe(true)
  })

  it('returns false for differing text segments', () => {
    const a: Array<Segment> = [{ type: 'text', value: 'hello' }]
    const b: Array<Segment> = [{ type: 'text', value: 'world' }]
    expect(segmentsEqual(a, b)).toBe(false)
  })

  it('returns true for matching mention segments (same id)', () => {
    const a: Array<Segment> = [
      { type: 'mention', item: createItem('1', 'file.ts') },
    ]
    const b: Array<Segment> = [
      { type: 'mention', item: createItem('1', 'file.ts') },
    ]
    expect(segmentsEqual(a, b)).toBe(true)
  })

  it('returns false for differing mention segments (different id)', () => {
    const a: Array<Segment> = [
      { type: 'mention', item: createItem('1', 'a.ts') },
    ]
    const b: Array<Segment> = [
      { type: 'mention', item: createItem('2', 'b.ts') },
    ]
    expect(segmentsEqual(a, b)).toBe(false)
  })

  it('returns false for length mismatch', () => {
    const a: Array<Segment> = [
      { type: 'text', value: 'hello' },
      { type: 'text', value: 'world' },
    ]
    const b: Array<Segment> = [{ type: 'text', value: 'hello' }]
    expect(segmentsEqual(a, b)).toBe(false)
  })

  it('returns false for type mismatch at same index', () => {
    const a: Array<Segment> = [{ type: 'text', value: 'hello' }]
    const b: Array<Segment> = [
      { type: 'mention', item: createItem('1', 'hello') },
    ]
    expect(segmentsEqual(a, b)).toBe(false)
  })

  it('returns true when mention ids match but labels differ', () => {
    // label is ReactNode — we only compare by id
    const a: Array<Segment> = [
      {
        type: 'mention',
        item: { id: '1', searchValue: 'a', label: 'Label A' },
      },
    ]
    const b: Array<Segment> = [
      {
        type: 'mention',
        item: { id: '1', searchValue: 'b', label: 'Label B' },
      },
    ]
    expect(segmentsEqual(a, b)).toBe(true)
  })

  it('handles mixed segments correctly', () => {
    const a: Array<Segment> = [
      { type: 'text', value: 'fix ' },
      { type: 'mention', item: createItem('1', 'file.ts') },
      { type: 'text', value: ' please' },
    ]
    const b: Array<Segment> = [
      { type: 'text', value: 'fix ' },
      { type: 'mention', item: createItem('1', 'file.ts') },
      { type: 'text', value: ' please' },
    ]
    expect(segmentsEqual(a, b)).toBe(true)
  })
})
