import {
  CHIP_SENTINEL,
  MENTION_ID_ATTR,
  stripChipSentinels,
} from './serializer'

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

  // Always keep a caret target after the chip.
  const spacer = document.createTextNode(CHIP_SENTINEL)
  chipSpan.after(spacer)

  // Move cursor into the spacer text node
  const selection = document.getSelection()
  if (selection) {
    const newRange = document.createRange()
    newRange.setStart(spacer, spacer.textContent?.length ?? 0)
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
 * This uses a backward DOM walk bounded by the editor root to handle
 * browser placeholder shapes like `<div><br></div>` that appear around
 * contentEditable caret positions.
 */
export function getChipBeforeCursor(
  editor: HTMLElement
): HTMLSpanElement | null {
  const selection = document.getSelection()
  if (!selection || selection.rangeCount === 0) return null

  const range = selection.getRangeAt(0)
  if (!range.collapsed) return null

  if (!editor.contains(range.startContainer)) return null

  let node = getNodeBeforeCaret(range, editor)
  while (node && node !== editor) {
    if (isChipSpan(node)) {
      return node as HTMLSpanElement
    }
    if (!isIgnorableCursorArtifact(node)) {
      return null
    }
    node = previousNodeInEditor(node, editor)
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

function getNodeBeforeCaret(range: Range, editor: HTMLElement): Node | null {
  const { startContainer, startOffset } = range

  if (startContainer.nodeType === Node.TEXT_NODE) {
    const textNode = startContainer as Text
    const leftText = stripChipSentinels(
      (textNode.textContent ?? '').slice(0, startOffset)
    )

    // Real content to the left of the caret means we're not at a chip boundary.
    if (leftText.trim().length > 0) return null

    if (startOffset > 0) return textNode
    return previousNodeInEditor(textNode, editor)
  }

  if (startContainer.nodeType === Node.ELEMENT_NODE) {
    const element = startContainer as Element
    if (startOffset > 0) {
      const before = element.childNodes[startOffset - 1] ?? null
      return before ? rightmostDescendant(before) : null
    }
    return previousNodeInEditor(element, editor)
  }

  return previousNodeInEditor(startContainer, editor)
}

function previousNodeInEditor(node: Node, editor: HTMLElement): Node | null {
  if (node === editor) return null

  if (node.previousSibling) {
    return rightmostDescendant(node.previousSibling)
  }

  const parent = node.parentNode
  if (!parent) return null
  if (parent === editor) return editor
  if (editor.contains(parent)) return parent
  return null
}

function rightmostDescendant(node: Node): Node {
  let current = node
  while (current.lastChild && !isAtomicNode(current)) {
    current = current.lastChild
  }
  return current
}

function isIgnorableCursorArtifact(node: Node): boolean {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = stripChipSentinels(node.textContent ?? '')
    return text.trim().length === 0
  }

  if (node.nodeType === Node.ELEMENT_NODE) {
    const element = node as HTMLElement
    if (element.tagName === 'BR') return true
    if (isChipSpan(element)) return false
    return isPlaceholderWrapper(element)
  }

  return false
}

function isPlaceholderWrapper(element: HTMLElement): boolean {
  if (element.hasAttribute(MENTION_ID_ATTR)) return false
  if (!element.firstChild) return true

  for (const child of element.childNodes) {
    if (child.nodeType === Node.COMMENT_NODE) continue
    if (!isIgnorableCursorArtifact(child)) {
      return false
    }
  }

  return true
}

function isAtomicNode(node: Node): boolean {
  return (
    isChipSpan(node) ||
    (node.nodeType === Node.ELEMENT_NODE &&
      (node as HTMLElement).contentEditable === 'false')
  )
}
