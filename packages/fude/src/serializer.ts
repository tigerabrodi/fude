import type { Segment } from './types'
import type { MentionStore } from './mention-store'

/** The data attribute we put on chip spans to identify them as mentions. */
export const MENTION_ID_ATTR = 'data-mention-id'

// ---------------------------------------------------------------------------
// serialize  (DOM → Segments)
// ---------------------------------------------------------------------------

/**
 * Walk the direct childNodes of a contentEditable element and produce
 * an array of Segments that represents the same content.
 *
 * The algorithm uses a text accumulator: text nodes and <br> elements
 * append to the accumulator. When we hit a chip span (or the end of
 * the children), we flush the accumulator as a TextSegment and move on.
 *
 * This naturally merges adjacent text nodes — browsers sometimes split
 * text into multiple nodes, but we always produce one TextSegment per
 * "run" of text.
 */
export function serialize(
  element: HTMLElement,
  store: MentionStore
): Array<Segment> {
  const segments: Array<Segment> = []

  // Accumulates text content across adjacent text nodes and <br>s.
  // Flushed as a single TextSegment when we encounter a chip or finish.
  let pendingText = ''

  /** Push accumulated text as a TextSegment if non-empty, then reset. */
  function flushText(): void {
    if (pendingText.length > 0) {
      segments.push({ type: 'text', value: pendingText })
      pendingText = ''
    }
  }

  for (const node of element.childNodes) {
    // --- Plain text ---
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? ''
      // Skip empty text nodes (browsers insert these between elements)
      if (text.length > 0) {
        pendingText += text
      }
      continue
    }

    // --- Element nodes ---
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement

      // <br> → newline character, folded into the text accumulator
      if (el.tagName === 'BR') {
        pendingText += '\n'
        continue
      }

      // Chip span → flush any pending text, then emit MentionSegment
      const mentionId = el.getAttribute(MENTION_ID_ATTR)
      if (mentionId) {
        const item = store.get(mentionId)

        // Defensive: if the store somehow doesn't have this item, skip it.
        // This shouldn't happen in normal flow, but a library should not crash.
        if (!item) continue

        flushText()
        segments.push({ type: 'mention', item })
        continue
      }
    }

    // Everything else (comments, unknown elements) is silently ignored.
  }

  // Don't forget any trailing text after the last chip
  flushText()

  return segments
}

// ---------------------------------------------------------------------------
// deserialize  (Segments → DOM)
// ---------------------------------------------------------------------------

/**
 * Convert an array of Segments into a DocumentFragment ready to be
 * inserted into the contentEditable div.
 *
 * - TextSegments become text nodes (with <br> elements for newlines).
 * - MentionSegments become chip spans carrying `data-mention-id`.
 *   The full item is also registered in the store so future serialize
 *   calls can reconstruct the MentionSegment.
 *
 * Note: at this stage (step 1) chip spans contain the searchValue as
 * placeholder text. Step 3 will upgrade them to React roots that render
 * the full label/icon JSX.
 */
export function deserialize(
  segments: Array<Segment>,
  store: MentionStore
): DocumentFragment {
  const fragment = document.createDocumentFragment()

  for (const segment of segments) {
    if (segment.type === 'text') {
      // Newlines in text need to become <br> elements in the DOM,
      // otherwise the browser renders them as spaces.
      appendTextWithLineBreaks(fragment, segment.value)
      continue
    }

    if (segment.type === 'mention') {
      // Register the item so the serializer can look it up later by id
      store.set(segment.item)

      const chip = createChipSpan(segment.item.id)
      fragment.appendChild(chip)
      continue
    }
  }

  return fragment
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create the raw chip span that represents a mention in the DOM.
 *
 * Key attributes:
 *  - `data-mention-id`: lets the serializer identify this as a mention
 *  - `contentEditable="false"`: makes the chip behave as an atomic
 *    inline element — the cursor skips over it rather than entering it
 *
 * In step 3 this span will become a React root for rendering the full
 * chip UI (icon, label, delete button). For now it's a bare span.
 */
export function createChipSpan(id: string): HTMLSpanElement {
  const span = document.createElement('span')
  span.setAttribute(MENTION_ID_ATTR, id)
  span.contentEditable = 'false'
  return span
}

/**
 * Append text content to a parent node, converting `\n` characters
 * into <br> elements so line breaks render correctly in the DOM.
 *
 * "hello\nworld" → text("hello"), <br>, text("world")
 */
function appendTextWithLineBreaks(
  parent: DocumentFragment | HTMLElement,
  text: string
): void {
  const lines = text.split('\n')

  for (let i = 0; i < lines.length; i++) {
    // Insert a <br> before every line except the first
    if (i > 0) {
      parent.appendChild(document.createElement('br'))
    }

    // Only create a text node if the line has content
    // (avoids empty text nodes for trailing newlines)
    if (lines[i].length > 0) {
      parent.appendChild(document.createTextNode(lines[i]))
    }
  }
}
