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
import { deserialize, MENTION_ID_ATTR, serialize } from './serializer'
import type { SmartTextboxProps } from './types'

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

    // Remove trailing empty text node sibling if present
    const next = chip.nextSibling
    if (next && next.nodeType === Node.TEXT_NODE && next.textContent === '') {
      next.remove()
    }

    // Remove chip span from DOM
    chip.remove()

    // Clear highlight ref
    if (highlightedChipRef.current === chip) {
      highlightedChipRef.current = null
    }

    // Re-serialize and fire onChange
    const segments = normalizeSegments(serialize(editor, store))
    onChange(segments)
  }

  // ---------------------------------------------------------------------------
  // Highlight management
  // ---------------------------------------------------------------------------

  function clearHighlight(): void {
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

      const chipBefore = getChipBeforeCursor()
      if (chipBefore) {
        // First press → highlight the chip
        e.preventDefault()
        highlightedChipRef.current = chipBefore
        highlightChip(chipBefore)

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
