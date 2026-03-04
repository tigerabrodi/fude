// @vitest-environment happy-dom

import { describe, it, expect, beforeEach } from 'vitest'
import { MentionStore } from '../src/mention-store'
import { serialize, deserialize, MENTION_ID_ATTR } from '../src/serializer'
import type { Segment, MentionItem } from '../src/types'

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/** Shorthand to create a MentionItem with just id and name (label = name). */
function createItem(id: string, name: string): MentionItem {
  return { id, searchValue: name, label: name }
}

/** Creates a chip span the same way the deserializer would — useful for serialize tests. */
function makeChipSpan(id: string): HTMLSpanElement {
  const span = document.createElement('span')
  span.setAttribute(MENTION_ID_ATTR, id)
  span.contentEditable = 'false'
  return span
}

// ---------------------------------------------------------------------------
// MentionStore
// ---------------------------------------------------------------------------

describe('MentionStore', () => {
  let store: MentionStore

  beforeEach(() => {
    store = new MentionStore()
  })

  it('stores and retrieves an item by id', () => {
    const item = createItem('1', 'file.ts')
    store.set(item)
    expect(store.get('1')).toBe(item)
  })

  it('returns undefined for unknown id', () => {
    expect(store.get('nope')).toBeUndefined()
  })

  it('deletes an item', () => {
    store.set(createItem('1', 'file.ts'))
    store.delete('1')
    expect(store.get('1')).toBeUndefined()
  })

  it('clears all items', () => {
    store.set(createItem('1', 'a.ts'))
    store.set(createItem('2', 'b.ts'))
    store.clear()
    expect(store.get('1')).toBeUndefined()
    expect(store.get('2')).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// serialize  (DOM → Segments)
// ---------------------------------------------------------------------------

describe('serialize', () => {
  let store: MentionStore
  let div: HTMLDivElement

  beforeEach(() => {
    store = new MentionStore()
    div = document.createElement('div')
  })

  it('returns empty array for empty element', () => {
    expect(serialize(div, store)).toEqual([])
  })

  it('serializes a single text node', () => {
    div.appendChild(document.createTextNode('hello world'))

    expect(serialize(div, store)).toEqual([
      { type: 'text', value: 'hello world' },
    ])
  })

  it('serializes a single chip span into a MentionSegment', () => {
    const item = createItem('1', 'file.ts')
    store.set(item)

    div.appendChild(makeChipSpan('1'))

    expect(serialize(div, store)).toEqual([{ type: 'mention', item }])
  })

  it('serializes text → chip → text (the typical case)', () => {
    const item = createItem('1', 'use-image-drag.ts')
    store.set(item)

    div.appendChild(document.createTextNode('lets fix '))
    div.appendChild(makeChipSpan('1'))
    div.appendChild(document.createTextNode(' and make it work'))

    expect(serialize(div, store)).toEqual([
      { type: 'text', value: 'lets fix ' },
      { type: 'mention', item },
      { type: 'text', value: ' and make it work' },
    ])
  })

  it('serializes adjacent chips with no text between them', () => {
    const a = createItem('1', 'a.ts')
    const b = createItem('2', 'b.ts')
    store.set(a)
    store.set(b)

    div.appendChild(makeChipSpan('1'))
    div.appendChild(makeChipSpan('2'))

    expect(serialize(div, store)).toEqual([
      { type: 'mention', item: a },
      { type: 'mention', item: b },
    ])
  })

  it('skips empty text nodes (browsers create these between elements)', () => {
    div.appendChild(document.createTextNode(''))
    div.appendChild(document.createTextNode('hello'))
    div.appendChild(document.createTextNode(''))

    expect(serialize(div, store)).toEqual([
      { type: 'text', value: 'hello' },
    ])
  })

  it('merges adjacent text nodes into one TextSegment', () => {
    // Browsers can split text into multiple adjacent text nodes.
    // The serializer should merge them so we get clean segments.
    div.appendChild(document.createTextNode('hello '))
    div.appendChild(document.createTextNode('world'))

    expect(serialize(div, store)).toEqual([
      { type: 'text', value: 'hello world' },
    ])
  })

  it('skips chip spans whose id is not in the store', () => {
    // Defensive: if the DOM gets into a weird state, don't crash.
    div.appendChild(makeChipSpan('ghost'))

    expect(serialize(div, store)).toEqual([])
  })

  it('handles <br> as a newline character', () => {
    div.appendChild(document.createTextNode('line one'))
    div.appendChild(document.createElement('br'))
    div.appendChild(document.createTextNode('line two'))

    expect(serialize(div, store)).toEqual([
      // BRs are folded into the surrounding text as \n
      { type: 'text', value: 'line one\nline two' },
    ])
  })

  it('handles <br> between chip and text', () => {
    const item = createItem('1', 'file.ts')
    store.set(item)

    div.appendChild(makeChipSpan('1'))
    div.appendChild(document.createElement('br'))
    div.appendChild(document.createTextNode('next line'))

    expect(serialize(div, store)).toEqual([
      { type: 'mention', item },
      { type: 'text', value: '\nnext line' },
    ])
  })
})

// ---------------------------------------------------------------------------
// deserialize  (Segments → DOM)
// ---------------------------------------------------------------------------

describe('deserialize', () => {
  let store: MentionStore

  beforeEach(() => {
    store = new MentionStore()
  })

  it('returns empty fragment for empty segments', () => {
    const fragment = deserialize([], store)
    expect(fragment.childNodes.length).toBe(0)
  })

  it('creates a text node for a TextSegment', () => {
    const segments: Array<Segment> = [{ type: 'text', value: 'hello' }]
    const fragment = deserialize(segments, store)

    expect(fragment.childNodes.length).toBe(1)
    expect(fragment.childNodes[0].nodeType).toBe(Node.TEXT_NODE)
    expect(fragment.childNodes[0].textContent).toBe('hello')
  })

  it('creates a chip span with the right attributes for a MentionSegment', () => {
    const item = createItem('1', 'file.ts')
    const fragment = deserialize([{ type: 'mention', item }], store)

    expect(fragment.childNodes.length).toBe(1)
    const chip = fragment.childNodes[0] as HTMLElement
    expect(chip.tagName).toBe('SPAN')
    expect(chip.getAttribute(MENTION_ID_ATTR)).toBe('1')
    expect(chip.contentEditable).toBe('false')
  })

  it('registers the mention item in the store', () => {
    const item = createItem('1', 'file.ts')
    deserialize([{ type: 'mention', item }], store)

    // The store should now know about this item so serialize can look it up.
    expect(store.get('1')).toBe(item)
  })

  it('builds correct DOM for mixed segments', () => {
    const item = createItem('1', 'file.ts')
    const segments: Array<Segment> = [
      { type: 'text', value: 'lets fix ' },
      { type: 'mention', item },
      { type: 'text', value: ' and make it work' },
    ]
    const fragment = deserialize(segments, store)

    expect(fragment.childNodes.length).toBe(3)
    expect(fragment.childNodes[0].textContent).toBe('lets fix ')
    expect(
      (fragment.childNodes[1] as HTMLElement).getAttribute(MENTION_ID_ATTR)
    ).toBe('1')
    expect(fragment.childNodes[2].textContent).toBe(' and make it work')
  })

  it('handles adjacent mentions', () => {
    const a = createItem('1', 'a.ts')
    const b = createItem('2', 'b.ts')
    const segments: Array<Segment> = [
      { type: 'mention', item: a },
      { type: 'mention', item: b },
    ]
    const fragment = deserialize(segments, store)

    // Both chips should be present as element children
    const chips = Array.from(fragment.childNodes).filter(
      (n): n is HTMLElement => n.nodeType === Node.ELEMENT_NODE
    )
    expect(chips.length).toBe(2)
    expect(chips[0].getAttribute(MENTION_ID_ATTR)).toBe('1')
    expect(chips[1].getAttribute(MENTION_ID_ATTR)).toBe('2')
  })

  it('converts newlines in text to <br> elements', () => {
    const segments: Array<Segment> = [
      { type: 'text', value: 'line one\nline two' },
    ]
    const fragment = deserialize(segments, store)

    // "line one" text node, <br>, "line two" text node
    expect(fragment.childNodes.length).toBe(3)
    expect(fragment.childNodes[0].textContent).toBe('line one')
    expect((fragment.childNodes[1] as HTMLElement).tagName).toBe('BR')
    expect(fragment.childNodes[2].textContent).toBe('line two')
  })
})

// ---------------------------------------------------------------------------
// Round-trip  (segments → DOM → segments should be identity)
// ---------------------------------------------------------------------------

describe('round-trip', () => {
  let store: MentionStore

  beforeEach(() => {
    store = new MentionStore()
  })

  /**
   * Helper: deserialize into a real div (like the component would),
   * then serialize back and compare.
   */
  function roundTrip(segments: Array<Segment>): Array<Segment> {
    const fragment = deserialize(segments, store)
    const div = document.createElement('div')
    div.appendChild(fragment)
    return serialize(div, store)
  }

  it('text only', () => {
    const segments: Array<Segment> = [
      { type: 'text', value: 'hello world' },
    ]
    expect(roundTrip(segments)).toEqual(segments)
  })

  it('text → mention → text', () => {
    const segments: Array<Segment> = [
      { type: 'text', value: 'fix ' },
      { type: 'mention', item: createItem('1', 'file.ts') },
      { type: 'text', value: ' please' },
    ]
    expect(roundTrip(segments)).toEqual(segments)
  })

  it('mention only (no surrounding text)', () => {
    const segments: Array<Segment> = [
      { type: 'mention', item: createItem('1', 'file.ts') },
    ]
    expect(roundTrip(segments)).toEqual(segments)
  })

  it('multiple mentions with text between', () => {
    const segments: Array<Segment> = [
      { type: 'text', value: 'refactor ' },
      { type: 'mention', item: createItem('1', 'a.ts') },
      { type: 'text', value: ' and ' },
      { type: 'mention', item: createItem('2', 'b.ts') },
      { type: 'text', value: ' to use hooks' },
    ]
    expect(roundTrip(segments)).toEqual(segments)
  })

  it('adjacent mentions (no text between)', () => {
    const segments: Array<Segment> = [
      { type: 'mention', item: createItem('1', 'a.ts') },
      { type: 'mention', item: createItem('2', 'b.ts') },
    ]
    expect(roundTrip(segments)).toEqual(segments)
  })

  it('multiline text', () => {
    const segments: Array<Segment> = [
      { type: 'text', value: 'line one\nline two\nline three' },
    ]
    expect(roundTrip(segments)).toEqual(segments)
  })
})
