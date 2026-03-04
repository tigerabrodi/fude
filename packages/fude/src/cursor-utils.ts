import { MENTION_ID_ATTR } from './serializer'

/**
 * Insert a chip span at the given range, replacing any selected content
 * (e.g. the @query text). Appends an empty text node after the chip so
 * the cursor can be placed after it, then moves the cursor there.
 *
 * Used by the mention dropdown (step 4) when the user picks an item.
 */
export function insertChipAtRange(
  range: Range,
  chipSpan: HTMLSpanElement
): void {
  range.deleteContents()
  range.insertNode(chipSpan)

  // Insert an empty text node after the chip for cursor placement
  const spacer = document.createTextNode('')
  chipSpan.after(spacer)

  // Move cursor into the spacer text node
  const selection = document.getSelection()
  if (selection) {
    const newRange = document.createRange()
    newRange.setStart(spacer, 0)
    newRange.collapse(true)
    selection.removeAllRanges()
    selection.addRange(newRange)
  }
}

/**
 * Check if the cursor is immediately after a chip span.
 *
 * Returns the chip span if found, null otherwise.
 *
 * Cursor positions that count as "after a chip":
 *  - At offset 0 of a text node whose previousSibling is a chip
 *  - In an empty text node whose previousSibling is a chip
 */
export function getChipBeforeCursor(): HTMLSpanElement | null {
  const selection = document.getSelection()
  if (!selection || selection.rangeCount === 0) return null

  const range = selection.getRangeAt(0)
  if (!range.collapsed) return null

  const { startContainer, startOffset } = range

  // Cursor is in a text node at offset 0 → check previousSibling
  if (startContainer.nodeType === Node.TEXT_NODE && startOffset === 0) {
    const prev = startContainer.previousSibling
    if (prev && isChipSpan(prev)) {
      return prev as HTMLSpanElement
    }
  }

  // Cursor is at a child offset inside an element (e.g. the editor div) →
  // check the node before the offset position
  if (startContainer.nodeType === Node.ELEMENT_NODE && startOffset > 0) {
    const prev = startContainer.childNodes[startOffset - 1]
    if (prev && isChipSpan(prev)) {
      return prev as HTMLSpanElement
    }
  }

  return null
}

// ---------------------------------------------------------------------------
// Highlight utilities
// ---------------------------------------------------------------------------

const HIGHLIGHTED_ATTR = 'data-highlighted'

/** Mark a chip span as highlighted (for first-backspace visual indicator). */
export function highlightChip(chip: HTMLSpanElement): void {
  chip.setAttribute(HIGHLIGHTED_ATTR, 'true')
}

/** Remove highlight from a chip span. */
export function unhighlightChip(chip: HTMLSpanElement): void {
  chip.removeAttribute(HIGHLIGHTED_ATTR)
}

/** Check if a chip span is currently highlighted. */
export function isChipHighlighted(chip: HTMLSpanElement): boolean {
  return chip.hasAttribute(HIGHLIGHTED_ATTR)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isChipSpan(node: Node): boolean {
  return (
    node.nodeType === Node.ELEMENT_NODE &&
    (node as HTMLElement).hasAttribute(MENTION_ID_ATTR)
  )
}
