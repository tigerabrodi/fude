import { useEffect, useRef } from 'react'
import { ChipContent } from './chip-content'
import { ChipRootManager } from './chip-root-manager'
import {
  getChipBeforeCursor,
  highlightChip,
  unhighlightChip,
} from './cursor-utils'
import { MentionStore } from './mention-store'
import { normalizeSegments } from './normalize-segments'
import { segmentsEqual } from './segments-equal'
import {
  deserialize,
  MENTION_ID_ATTR,
  serialize,
  stripChipSentinels,
} from './serializer'
import type { Segment, SmartTextboxProps } from './types'

function trimTrailingNewlines(segments: Array<Segment>): Array<Segment> {
  if (segments.length === 0) return segments
  const last = segments[segments.length - 1]
  if (last.type !== 'text') return segments
  const trimmed = last.value.replace(/\n+$/, '')
  if (trimmed === '') return segments.slice(0, -1)
  return [...segments.slice(0, -1), { type: 'text', value: trimmed }]
}

/**
 * Check whether a value array represents "empty" content
 * (no segments, or a single empty text segment).
 */
function isEmpty(value: SmartTextboxProps['value']): boolean {
  if (value.length === 0) return true
  if (
    value.length === 1 &&
    value[0].type === 'text' &&
    value[0].value.trim() === ''
  ) {
    return true
  }
  return false
}

function isRemovablePostChipArtifact(node: Node): boolean {
  if (node.nodeType === Node.TEXT_NODE) {
    return stripChipSentinels(node.textContent ?? '').trim().length === 0
  }

  if (node.nodeType === Node.ELEMENT_NODE) {
    const element = node as HTMLElement
    if (element.tagName === 'BR') return true
    if (element.hasAttribute(MENTION_ID_ATTR)) return false
    return isPlaceholderWrapper(element)
  }

  return false
}

function isPlaceholderWrapper(element: HTMLElement): boolean {
  if (!element.firstChild) return true

  for (const child of element.childNodes) {
    if (child.nodeType === Node.COMMENT_NODE) continue
    if (!isRemovablePostChipArtifact(child)) {
      return false
    }
  }

  return true
}

function collapseBoundaryDoubleSpace(marker: Comment): void {
  const prevNode = marker.previousSibling
  const nextNode = marker.nextSibling
  if (
    !prevNode ||
    !nextNode ||
    prevNode.nodeType !== Node.TEXT_NODE ||
    nextNode.nodeType !== Node.TEXT_NODE
  ) {
    return
  }

  const prevText = prevNode.textContent ?? ''
  const nextText = nextNode.textContent ?? ''
  if (!prevText.endsWith(' ') || !nextText.startsWith(' ')) return

  const collapsed = nextText.slice(1)
  if (collapsed.length > 0) {
    nextNode.textContent = collapsed
  } else {
    nextNode.remove()
  }
}

export function SmartTextbox({
  value,
  onChange,
  onSubmit,
  placeholder,
  multiline,
  className,
  style,
  classNames,
  styles,
  defaultTagIcon,
  defaultTagDeleteIcon,
}: SmartTextboxProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const storeRef = useRef(new MentionStore())
  const chipManagerRef = useRef(new ChipRootManager())
  const highlightedChipRef = useRef<HTMLSpanElement | null>(null)

  function setCaretVisible(visible: boolean): void {
    const editor = editorRef.current
    if (!editor) return
    editor.style.caretColor = visible ? '' : 'transparent'
  }

  // ---------------------------------------------------------------------------
  // Chip rendering
  // ---------------------------------------------------------------------------

  /**
   * Scan the editor for chip spans and mount/re-render React content in each.
   *
   * WARNING: If consumers pass inline objects for `styles` or `classNames`
   * (e.g. `styles={{ tag: { ... } }}`), every render creates new references,
   * causing all chips to re-render on every keystroke. Not a v1 blocker but
   * consumers should memoize these props for best performance.
   */
  function renderAllChips(): void {
    const editor = editorRef.current
    if (!editor) return

    const store = storeRef.current
    const chipManager = chipManagerRef.current
    const chips = editor.querySelectorAll<HTMLSpanElement>(
      `[${MENTION_ID_ATTR}]`
    )

    for (const chip of chips) {
      const id = chip.getAttribute(MENTION_ID_ATTR)
      if (!id) continue

      const item = store.get(id)
      if (!item) continue

      const isHighlighted = chip === highlightedChipRef.current

      chipManager.mount(
        chip,
        <ChipContent
          item={item}
          classNames={classNames}
          styles={styles}
          defaultTagIcon={defaultTagIcon}
          defaultTagDeleteIcon={defaultTagDeleteIcon}
          highlighted={isHighlighted}
          onDelete={handleDeleteChip}
        />
      )
    }
  }

  /**
   * Delete a chip: unmount its React root, remove from store, remove
   * the chip span and its trailing empty text node sibling from DOM,
   * then re-serialize and fire onChange.
   */
  function handleDeleteChip(id: string): void {
    const editor = editorRef.current
    if (!editor) return

    // Find the chip span by id in the current DOM
    const chip = editor.querySelector<HTMLSpanElement>(
      `[${MENTION_ID_ATTR}="${id}"]`
    )
    if (!chip) return

    deleteChipSpan(chip)
  }

  function deleteChipSpan(chip: HTMLSpanElement): void {
    const editor = editorRef.current
    if (!editor) return

    const chipManager = chipManagerRef.current
    const store = storeRef.current
    const id = chip.getAttribute(MENTION_ID_ATTR)

    // Unmount React root
    chipManager.unmount(chip)

    // Remove from store
    if (id) store.delete(id)

    // Marker preserves the exact deletion boundary across normalize().
    const marker = document.createComment('chip-delete-caret-marker')
    chip.before(marker)

    // Remove immediate artifacts after the chip (sentinel, placeholder text, brs, wrappers).
    let sibling = chip.nextSibling
    while (sibling && isRemovablePostChipArtifact(sibling)) {
      const next = sibling.nextSibling
      sibling.remove()
      sibling = next
    }

    // Remove chip span from DOM
    chip.remove()

    // Merge adjacent text nodes left by the removal to prevent visual artifacts
    editor.normalize()
    collapseBoundaryDoubleSpace(marker)

    // Clear highlight ref
    if (highlightedChipRef.current === chip) {
      highlightedChipRef.current = null
    }
    setCaretVisible(true)

    // Place cursor where the chip was:
    // 1) start of next text 2) end of previous text 3) end of editor.
    const sel = document.getSelection()
    if (sel) {
      const range = document.createRange()
      const nextNode = marker.nextSibling
      const prevNode = marker.previousSibling

      if (nextNode && nextNode.nodeType === Node.TEXT_NODE) {
        range.setStart(nextNode, 0)
      } else if (prevNode && prevNode.nodeType === Node.TEXT_NODE) {
        range.setStart(prevNode, prevNode.textContent?.length ?? 0)
      } else if (marker.parentNode) {
        const parent = marker.parentNode
        const offset = Array.prototype.indexOf.call(parent.childNodes, marker)
        range.setStart(parent, Math.max(0, offset))
      } else if (editor.lastChild) {
        range.setStartAfter(editor.lastChild)
      } else {
        range.setStart(editor, 0)
      }
      range.collapse(true)
      sel.removeAllRanges()
      sel.addRange(range)
    }
    marker.remove()

    // Re-serialize and fire onChange
    const segments = normalizeSegments(serialize(editor, store))

    // Strip trailing newlines that are browser artifacts from chip deletion.
    // Only done here — during normal typing, trailing newlines are legitimate.
    const cleaned = trimTrailingNewlines(segments)
    onChange(cleaned)
  }

  // ---------------------------------------------------------------------------
  // Highlight management
  // ---------------------------------------------------------------------------

  function clearHighlight(): void {
    setCaretVisible(true)

    if (highlightedChipRef.current) {
      unhighlightChip(highlightedChipRef.current)

      // Re-render the chip without highlight
      const chip = highlightedChipRef.current
      const id = chip.getAttribute(MENTION_ID_ATTR)
      const item = id ? storeRef.current.get(id) : null

      if (item) {
        chipManagerRef.current.mount(
          chip,
          <ChipContent
            item={item}
            classNames={classNames}
            styles={styles}
            defaultTagIcon={defaultTagIcon}
            defaultTagDeleteIcon={defaultTagDeleteIcon}
            highlighted={false}
            onDelete={handleDeleteChip}
          />
        )
      }

      highlightedChipRef.current = null
    }
  }

  // ---------------------------------------------------------------------------
  // Sync effect — reconcile props.value with the DOM
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return

    const store = storeRef.current
    const chipManager = chipManagerRef.current

    // Serialize the current DOM state to compare with incoming value
    const currentSegments = normalizeSegments(serialize(editor, store))

    // Guard: if DOM already matches, skip the rebuild to preserve cursor
    if (segmentsEqual(currentSegments, value)) {
      // Still render chips for prop updates (classNames, styles, etc.)
      renderAllChips()
      return
    }

    // Different — clear and rebuild
    chipManager.unmountAll()
    store.clear()
    editor.textContent = ''
    const fragment = deserialize(value, store)
    editor.appendChild(fragment)
    renderAllChips()

    // Reset highlight on value change
    highlightedChipRef.current = null

    syncHeight()
  })

  // ---------------------------------------------------------------------------
  // Cleanup on unmount
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const store = storeRef.current
    const chipManager = chipManagerRef.current
    return () => {
      chipManager.unmountAll()
      store.clear()
    }
  }, [])

  // ---------------------------------------------------------------------------
  // Auto-grow (multiline only)
  // ---------------------------------------------------------------------------
  function syncHeight(): void {
    if (!multiline) return
    const editor = editorRef.current
    if (!editor) return

    editor.style.height = 'auto'
    editor.style.height = editor.scrollHeight + 'px'
  }

  // ---------------------------------------------------------------------------
  // Input handler — serialize DOM on every change
  // ---------------------------------------------------------------------------
  function handleInput(): void {
    clearHighlight()

    const editor = editorRef.current
    if (!editor) return

    const segments = normalizeSegments(serialize(editor, storeRef.current))
    onChange(segments)
    syncHeight()
  }

  // ---------------------------------------------------------------------------
  // Key down — backspace + submit logic
  // ---------------------------------------------------------------------------
  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>): void {
    // --- Backspace: two-press chip deletion ---
    if (e.key === 'Backspace') {
      if (highlightedChipRef.current) {
        // Second press → delete the highlighted chip
        e.preventDefault()
        deleteChipSpan(highlightedChipRef.current)
        return
      }

      const editor = editorRef.current
      if (!editor) return

      const chipBefore = getChipBeforeCursor(editor)
      if (chipBefore) {
        // First press → highlight the chip
        e.preventDefault()
        highlightedChipRef.current = chipBefore
        highlightChip(chipBefore)
        setCaretVisible(false)

        // Re-render with highlighted=true
        const id = chipBefore.getAttribute(MENTION_ID_ATTR)
        const item = id ? storeRef.current.get(id) : null
        if (item) {
          chipManagerRef.current.mount(
            chipBefore,
            <ChipContent
              item={item}
              classNames={classNames}
              styles={styles}
              defaultTagIcon={defaultTagIcon}
              defaultTagDeleteIcon={defaultTagDeleteIcon}
              highlighted
              onDelete={handleDeleteChip}
            />
          )
        }
        return
      }
    } else {
      // Any non-Backspace key → clear highlight
      clearHighlight()
    }

    // --- Submit logic ---
    if (!onSubmit) return

    const isEnter = e.key === 'Enter'
    if (!isEnter) return

    if (!multiline) {
      // Single-line: Enter submits
      e.preventDefault()
      const editor = editorRef.current
      if (!editor) return
      const segments = normalizeSegments(serialize(editor, storeRef.current))
      onSubmit(segments)
    } else if (e.metaKey || e.ctrlKey) {
      // Multiline: Cmd/Ctrl+Enter submits
      e.preventDefault()
      const editor = editorRef.current
      if (!editor) return
      const segments = normalizeSegments(serialize(editor, storeRef.current))
      onSubmit(segments)
    }
    // Multiline + plain Enter → let browser insert newline
  }

  // ---------------------------------------------------------------------------
  // Click + Blur handlers — clear highlight
  // ---------------------------------------------------------------------------
  function handleClick(): void {
    clearHighlight()
  }

  function handleBlur(): void {
    clearHighlight()
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  const rootClassName = [className, classNames?.root].filter(Boolean).join(' ')
  const inputClassName = classNames?.input || undefined

  const isPlaceholderVisible = isEmpty(value)

  return (
    <div
      className={rootClassName || undefined}
      style={{
        ...style,
        ...styles?.root,
      }}
    >
      <div style={{ position: 'relative' }}>
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline={multiline || undefined}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onClick={handleClick}
          onBlur={handleBlur}
          className={inputClassName}
          style={{
            outline: 'none',
            whiteSpace: multiline ? 'pre-wrap' : 'nowrap',
            overflowX: multiline ? undefined : 'hidden',
            wordBreak: multiline ? 'break-word' : undefined,
            ...styles?.input,
          }}
        />
        {isPlaceholderVisible && (
          <div
            aria-hidden
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              opacity: 0.5,
              ...styles?.input,
            }}
          >
            {placeholder}
          </div>
        )}
      </div>
    </div>
  )
}
