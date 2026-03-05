import { describe, expect, it } from 'vitest'
import { getPlainText } from '../src/get-plain-text'
import type { MentionItem, Segment } from '../src/types'

function createItem(id: string, searchValue: string): MentionItem {
  return { id, searchValue, label: searchValue }
}

describe('getPlainText', () => {
  it('returns empty string for empty input', () => {
    expect(getPlainText([])).toBe('')
  })

  it('returns text value for text-only segments', () => {
    const segments: Array<Segment> = [{ type: 'text', value: 'hello world' }]
    expect(getPlainText(segments)).toBe('hello world')
  })

  it('uses mention searchValue for mention-only segments', () => {
    const segments: Array<Segment> = [
      { type: 'mention', item: createItem('1', 'file.ts') },
    ]
    expect(getPlainText(segments)).toBe('file.ts')
  })

  it('joins mixed segments in order', () => {
    const segments: Array<Segment> = [
      { type: 'text', value: 'lets fix ' },
      { type: 'mention', item: createItem('1', 'use-image-drag.ts') },
      { type: 'text', value: ' and ship it' },
    ]

    expect(getPlainText(segments)).toBe(
      'lets fix use-image-drag.ts and ship it'
    )
  })

  it('preserves whitespace and newlines from text segments', () => {
    const segments: Array<Segment> = [
      { type: 'text', value: 'line 1\n' },
      { type: 'mention', item: createItem('2', 'README.md') },
      { type: 'text', value: '\n line 3' },
    ]

    expect(getPlainText(segments)).toBe('line 1\nREADME.md\n line 3')
  })

  it('ignores rich label JSX and still uses searchValue', () => {
    const segments: Array<Segment> = [
      {
        type: 'mention',
        item: {
          id: '3',
          searchValue: 'serializer.ts',
          label: 'Serializer UI Label',
        },
      },
    ]

    expect(getPlainText(segments)).toBe('serializer.ts')
  })
})
