import { describe, expect, it } from 'vitest'
import { normalizeSegments } from '../src/normalize-segments'
import type { MentionItem, Segment } from '../src/types'

function createItem(id: string, name: string): MentionItem {
  return { id, searchValue: name, label: name }
}

describe('normalizeSegments', () => {
  it('returns [] for empty input', () => {
    expect(normalizeSegments([])).toEqual([])
  })

  it('collapses a lone newline text segment to []', () => {
    // This is what the serializer produces for a browser <br> placeholder.
    const segments: Array<Segment> = [{ type: 'text', value: '\n' }]
    expect(normalizeSegments(segments)).toEqual([])
  })

  it('collapses whitespace-only text segment to []', () => {
    const segments: Array<Segment> = [{ type: 'text', value: '  \n\n  ' }]
    expect(normalizeSegments(segments)).toEqual([])
  })

  it('preserves real text content', () => {
    const segments: Array<Segment> = [{ type: 'text', value: 'hello' }]
    expect(normalizeSegments(segments)).toEqual(segments)
  })

  it('preserves text with leading newline', () => {
    const segments: Array<Segment> = [{ type: 'text', value: '\nhello' }]
    expect(normalizeSegments(segments)).toEqual(segments)
  })

  it('preserves mention-only segments', () => {
    const segments: Array<Segment> = [
      { type: 'mention', item: createItem('1', 'file.ts') },
    ]
    expect(normalizeSegments(segments)).toEqual(segments)
  })

  it('preserves multi-segment arrays even with whitespace text', () => {
    // Multiple segments — not a lone whitespace artifact
    const segments: Array<Segment> = [
      { type: 'text', value: '\n' },
      { type: 'mention', item: createItem('1', 'file.ts') },
    ]
    expect(normalizeSegments(segments)).toEqual(segments)
  })
})
