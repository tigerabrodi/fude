import { describe, expect, it } from 'vitest'
import { fuzzyFilter } from '../src/fuzzy-filter'
import type { MentionItem } from '../src/types'

function createItem(id: string, searchValue: string): MentionItem {
  return { id, searchValue, label: searchValue }
}

describe('fuzzyFilter', () => {
  const items: Array<MentionItem> = [
    createItem('1', 'use-image-drag.ts'),
    createItem('2', 'serializer.ts'),
    createItem('3', 'cursor-utils.ts'),
    createItem('4', 'smart-textbox.tsx'),
  ]

  it('returns all items in original order for empty query', () => {
    expect(fuzzyFilter('', items).map((item) => item.id)).toEqual([
      '1',
      '2',
      '3',
      '4',
    ])
    expect(fuzzyFilter('   ', items).map((item) => item.id)).toEqual([
      '1',
      '2',
      '3',
      '4',
    ])
  })

  it('matches direct substring case-insensitively', () => {
    const serResults = fuzzyFilter('SER', items).map((item) => item.id)
    expect(serResults[0]).toBe('2')
    expect(serResults).toContain('1')

    expect(fuzzyFilter('textbox', items).map((item) => item.id)).toEqual(['4'])
  })

  it('supports non-contiguous subsequence matching', () => {
    // c u t matches c(ursor)-u(tils)-t(s)
    expect(fuzzyFilter('cut', items).map((item) => item.id)).toEqual(['3'])
  })

  it('returns empty array when no items match', () => {
    expect(fuzzyFilter('zzzz', items)).toEqual([])
  })

  it('prefers direct includes before subsequence matches', () => {
    const ranked = fuzzyFilter('srt', [
      createItem('a', 'srt-file.ts'),
      createItem('b', 'serializer.ts'),
      createItem('c', 'smart-textbox.tsx'),
    ])

    expect(ranked[0]?.id).toBe('a')
    expect(ranked.map((item) => item.id)).toContain('b')
    expect(ranked.map((item) => item.id)).toContain('c')
  })

  it('keeps input order for equivalent-score matches', () => {
    const ranked = fuzzyFilter('ab', [
      createItem('a', 'ab-foo'),
      createItem('b', 'ab-bar'),
    ])

    expect(ranked.map((item) => item.id)).toEqual(['a', 'b'])
  })
})
