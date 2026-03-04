// @vitest-environment happy-dom

import { beforeEach, describe, expect, it } from 'vitest'
import {
  getChipBeforeCursor,
  highlightChip,
  insertChipAtRange,
  isChipHighlighted,
  unhighlightChip,
} from '../src/cursor-utils'
import { MENTION_ID_ATTR } from '../src/serializer'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeChipSpan(id: string): HTMLSpanElement {
  const span = document.createElement('span')
  span.setAttribute(MENTION_ID_ATTR, id)
  span.contentEditable = 'false'
  return span
}

function setCursorAt(node: Node, offset: number): void {
  const range = document.createRange()
  range.setStart(node, offset)
  range.collapse(true)
  const selection = document.getSelection()!
  selection.removeAllRanges()
  selection.addRange(range)
}

// ---------------------------------------------------------------------------
// getChipBeforeCursor
// ---------------------------------------------------------------------------

describe('getChipBeforeCursor', () => {
  let div: HTMLDivElement

  beforeEach(() => {
    div = document.createElement('div')
    document.body.appendChild(div)
  })

  it('returns chip when cursor is at offset 0 of text node after chip', () => {
    const chip = makeChipSpan('1')
    const textNode = document.createTextNode('hello')
    div.appendChild(chip)
    div.appendChild(textNode)

    setCursorAt(textNode, 0)

    expect(getChipBeforeCursor()).toBe(chip)
  })

  it('returns null when cursor is mid-text', () => {
    const chip = makeChipSpan('1')
    const textNode = document.createTextNode('hello')
    div.appendChild(chip)
    div.appendChild(textNode)

    setCursorAt(textNode, 3)

    expect(getChipBeforeCursor()).toBeNull()
  })

  it('returns chip when cursor is in empty text node after chip', () => {
    const chip = makeChipSpan('1')
    const spacer = document.createTextNode('')
    div.appendChild(chip)
    div.appendChild(spacer)

    setCursorAt(spacer, 0)

    expect(getChipBeforeCursor()).toBe(chip)
  })

  it('returns null when no chip before cursor', () => {
    const textNode = document.createTextNode('hello')
    div.appendChild(textNode)

    setCursorAt(textNode, 0)

    expect(getChipBeforeCursor()).toBeNull()
  })

  it('returns null when no selection', () => {
    document.getSelection()!.removeAllRanges()
    expect(getChipBeforeCursor()).toBeNull()
  })

  it('returns chip when cursor is at element offset after chip', () => {
    const chip = makeChipSpan('1')
    div.appendChild(chip)

    // Cursor at child offset 1 inside div (after the chip)
    setCursorAt(div, 1)

    expect(getChipBeforeCursor()).toBe(chip)
  })
})

// ---------------------------------------------------------------------------
// insertChipAtRange
// ---------------------------------------------------------------------------

describe('insertChipAtRange', () => {
  let div: HTMLDivElement

  beforeEach(() => {
    div = document.createElement('div')
    document.body.appendChild(div)
  })

  it('inserts chip and empty text node, cursor ends after spacer', () => {
    const textNode = document.createTextNode('hello @query world')
    div.appendChild(textNode)

    // Select "@query" (indices 6-12)
    const range = document.createRange()
    range.setStart(textNode, 6)
    range.setEnd(textNode, 12)

    const chip = makeChipSpan('1')
    insertChipAtRange(range, chip)

    // DOM should be: "hello " + chip + "" + " world"
    expect(div.childNodes.length).toBe(4)
    expect(div.childNodes[0].textContent).toBe('hello ')
    expect(
      (div.childNodes[1] as HTMLElement).getAttribute(MENTION_ID_ATTR)
    ).toBe('1')
    // Empty text node spacer
    expect(div.childNodes[2].nodeType).toBe(Node.TEXT_NODE)
    expect(div.childNodes[2].textContent).toBe('')
    expect(div.childNodes[3].textContent).toBe(' world')

    // Cursor should be in the spacer
    const selection = document.getSelection()!
    expect(selection.rangeCount).toBe(1)
    expect(selection.getRangeAt(0).startContainer).toBe(div.childNodes[2])
  })

  it('replaces selected content with chip', () => {
    const textNode = document.createTextNode('@mention')
    div.appendChild(textNode)

    const range = document.createRange()
    range.setStart(textNode, 0)
    range.setEnd(textNode, 8)

    const chip = makeChipSpan('2')
    insertChipAtRange(range, chip)

    // The @mention text is gone, replaced by chip + spacer
    const chipEl = div.querySelector(`[${MENTION_ID_ATTR}]`)
    expect(chipEl).not.toBeNull()
    expect(chipEl!.getAttribute(MENTION_ID_ATTR)).toBe('2')
  })
})

// ---------------------------------------------------------------------------
// Highlight utilities
// ---------------------------------------------------------------------------

describe('highlight utilities', () => {
  it('toggles data-highlighted attribute', () => {
    const chip = makeChipSpan('1')

    expect(isChipHighlighted(chip)).toBe(false)

    highlightChip(chip)
    expect(isChipHighlighted(chip)).toBe(true)
    expect(chip.getAttribute('data-highlighted')).toBe('true')

    unhighlightChip(chip)
    expect(isChipHighlighted(chip)).toBe(false)
    expect(chip.hasAttribute('data-highlighted')).toBe(false)
  })
})
