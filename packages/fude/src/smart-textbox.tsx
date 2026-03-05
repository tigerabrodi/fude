import { useEffect, useRef } from 'react'
import { ChipContent } from './chip-content'
import { ChipRootManager } from './chip-root-manager'
import {
  getChipBeforeCursor,
  highlightChip,
  insertChipAtRange,
  unhighlightChip,
} from './cursor-utils'
import { MentionStore } from './mention-store'
import { normalizeSegments } from './normalize-segments'
import { segmentsEqual } from './segments-equal'
import {
  CHIP_SENTINEL,
  createChipSpan,
  deserialize,
  MENTION_ID_ATTR,
  serialize,
  stripChipSentinels,
} from './serializer'
import { useSmartTextboxGhost } from './smart-textbox-ghost'
import { useSmartTextboxMentions } from './smart-textbox-mentions'
import {
  GhostTextOverlay,
  MentionDropdownPortal,
} from './smart-textbox-overlays'
import {
  collapseBoundaryDoubleSpace,
  isEmpty,
  isRemovablePostChipArtifact,
  normalizePastedPlainText,
  startsWithWhitespace,
  trimTrailingNewlines,
} from './smart-textbox-utils'
import type { MentionItem, SmartTextboxProps } from './types'

const DEFAULT_AUTOCOMPLETE_DELAY = 300
const DEFAULT_TRAILING_LENGTH = 300

export function SmartTextbox({
  value,
  onChange,
  onFetchMentions,
  onFetchSuggestions,
  autocompleteDelay = DEFAULT_AUTOCOMPLETE_DELAY,
  trailingLength = DEFAULT_TRAILING_LENGTH,
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
  const wrapperRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<HTMLDivElement>(null)
  const storeRef = useRef(new MentionStore())
  const chipManagerRef = useRef(new ChipRootManager())
  const highlightedChipRef = useRef<HTMLSpanElement | null>(null)
  const focusFromPointerRef = useRef(false)
  const deferredHeightSyncIdRef = useRef<number | null>(null)
  const isComposingRef = useRef(false)
  const pendingChipManagerUnmountsRef = useRef<
    Array<{ manager: ChipRootManager; timeoutId: number }>
  >([])
  const pendingPasteCommitRef = useRef(false)
  const clearGhostStateRef = useRef<(invalidateRequest?: boolean) => void>(
    () => {
      // placeholder until ghost controller is initialized
    }
  )

  function setCaretVisible(visible: boolean): void {
    const editor = editorRef.current
    if (!editor) return
    editor.style.caretColor = visible ? '' : 'transparent'
  }

  function scheduleChipManagerUnmount(manager: ChipRootManager): void {
    const timeoutId = window.setTimeout(() => {
      manager.unmountAll()
      pendingChipManagerUnmountsRef.current =
        pendingChipManagerUnmountsRef.current.filter(
          (entry) => entry.timeoutId !== timeoutId
        )
    }, 0)

    pendingChipManagerUnmountsRef.current.push({ manager, timeoutId })
  }

  function flushPendingChipManagerUnmounts(): void {
    const pending = pendingChipManagerUnmountsRef.current
    if (pending.length === 0) return
    pendingChipManagerUnmountsRef.current = []

    for (const entry of pending) {
      window.clearTimeout(entry.timeoutId)
      entry.manager.unmountAll()
    }
  }

  function getSelectionRangeInsideEditor(editor: HTMLElement): Range | null {
    const selection = document.getSelection()
    if (!selection || selection.rangeCount === 0) return null
    const range = selection.getRangeAt(0)
    if (!editor.contains(range.startContainer)) return null
    if (!editor.contains(range.endContainer)) return null
    return range
  }

  function syncSingleLineCaretVisibility(): void {
    if (multiline) return

    const editor = editorRef.current
    if (!editor) return
    if (editor.scrollWidth <= editor.clientWidth) {
      editor.scrollLeft = 0
      return
    }

    const selection = document.getSelection()
    if (!selection || selection.rangeCount === 0) return
    const range = selection.getRangeAt(0)
    if (!range.collapsed || !editor.contains(range.startContainer)) return

    const trailingRange = range.cloneRange()
    try {
      trailingRange.setEnd(editor, editor.childNodes.length)
    } catch {
      return
    }

    const trailingText = stripChipSentinels(trailingRange.toString())
    if (trailingText.length === 0) {
      editor.scrollLeft = editor.scrollWidth
    }
  }

  function syncSingleLineCaretVisibilityDeferred(): void {
    syncSingleLineCaretVisibility()
    if (multiline) return

    // Chip content is rendered via separate React roots and can expand after
    // mention insertion. Re-sync one tick later so the right edge stays visible.
    setTimeout(() => {
      syncSingleLineCaretVisibility()
    }, 0)
  }

  function placeCaretAtEditorEnd(editor: HTMLElement): void {
    const selection = document.getSelection()
    if (!selection) return
    const range = document.createRange()
    range.selectNodeContents(editor)
    range.collapse(false)
    selection.removeAllRanges()
    selection.addRange(range)
  }

  function scheduleDeferredHeightSync(): void {
    if (!multiline) return
    if (deferredHeightSyncIdRef.current !== null) {
      window.clearTimeout(deferredHeightSyncIdRef.current)
    }
    deferredHeightSyncIdRef.current = window.setTimeout(() => {
      deferredHeightSyncIdRef.current = null
      syncHeight()
    }, 0)
  }

  function syncHeightAfterLayoutChange(): void {
    syncHeight()
    scheduleDeferredHeightSync()
  }

  function syncHeight(): void {
    if (!multiline) return
    const editor = editorRef.current
    if (!editor) return

    editor.style.height = 'auto'
    editor.style.height = editor.scrollHeight + 'px'
  }

  function commitEditorChangeAfterMutation(): void {
    const editor = editorRef.current
    if (!editor) return

    ghost.clearGhostState(true)

    const segments = normalizeSegments(serialize(editor, storeRef.current))
    onChange(segments)
    syncHeight()
    syncSingleLineCaretVisibility()

    if (isComposingRef.current) return
    if (mention.mentionIsOpenRef.current) {
      mention.refreshMentionQueryFromSelection()
      return
    }

    if (onFetchMentions && mention.openMentionFromCurrentCaret()) {
      return
    }

    ghost.scheduleGhostFetch(segments)
  }

  function insertMentionItem(item: MentionItem, mentionRange: Range): void {
    const editor = editorRef.current
    if (!editor) return

    clearHighlight()

    const chip = createChipSpan(item.id)
    storeRef.current.set(item)
    insertChipAtRange(mentionRange, chip)

    const spacer = chip.nextSibling
    if (spacer && spacer.nodeType === Node.TEXT_NODE) {
      const spacerText = spacer as Text
      const spacerVisibleText = stripChipSentinels(spacerText.textContent ?? '')
      const nextSibling = spacerText.nextSibling
      const nextSiblingText =
        nextSibling && nextSibling.nodeType === Node.TEXT_NODE
          ? stripChipSentinels(nextSibling.textContent ?? '')
          : ''

      if (
        spacerVisibleText.length === 0 &&
        (nextSiblingText.length === 0 || !startsWithWhitespace(nextSiblingText))
      ) {
        spacerText.textContent = CHIP_SENTINEL + ' ' + CHIP_SENTINEL
        const selection = document.getSelection()
        if (selection) {
          const range = document.createRange()
          const trailingSentinelOffset = Math.max(
            0,
            spacerText.textContent.length - CHIP_SENTINEL.length
          )
          range.setStart(spacerText, trailingSentinelOffset)
          range.collapse(true)
          selection.removeAllRanges()
          selection.addRange(range)
        }
      }
    }

    renderAllChips()
    editor.focus()

    const segments = normalizeSegments(serialize(editor, storeRef.current))
    onChange(segments)
    syncHeightAfterLayoutChange()
    syncSingleLineCaretVisibilityDeferred()
    mention.closeMentionMode()
  }

  const mention = useSmartTextboxMentions({
    editorRef,
    onFetchMentions,
    onSelectMention: insertMentionItem,
    onMentionModeToggle: () => clearGhostStateRef.current(true),
  })

  const ghost = useSmartTextboxGhost({
    editorRef,
    wrapperRef,
    onFetchSuggestions,
    autocompleteDelay,
    trailingLength,
    mentionIsOpenRef: mention.mentionIsOpenRef,
    isComposingRef,
    onAcceptSuggestion: () => {
      const editor = editorRef.current
      if (!editor) return
      const segments = normalizeSegments(serialize(editor, storeRef.current))
      onChange(segments)
      syncHeightAfterLayoutChange()
      syncSingleLineCaretVisibilityDeferred()
    },
  })
  clearGhostStateRef.current = ghost.clearGhostState

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

    if (mention.mentionIsOpenRef.current) {
      mention.closeMentionMode()
    }

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
    syncSingleLineCaretVisibility()

    // Re-serialize and fire onChange
    const segments = normalizeSegments(serialize(editor, store))

    // Strip trailing newlines that are browser artifacts from chip deletion.
    // Only done here — during normal typing, trailing newlines are legitimate.
    const cleaned = trimTrailingNewlines(segments)
    onChange(cleaned)
    syncHeightAfterLayoutChange()
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
    // Serialize the current DOM state to compare with incoming value
    const currentSegments = normalizeSegments(serialize(editor, store))

    // Guard: if DOM already matches, skip the rebuild to preserve cursor
    if (segmentsEqual(currentSegments, value)) {
      // Still render chips for prop updates (classNames, styles, etc.)
      renderAllChips()
      return
    }

    // Different — clear and rebuild
    if (mention.mentionIsOpenRef.current) {
      mention.closeMentionMode()
    }
    ghost.clearGhostState(true)
    const oldChipManager = chipManagerRef.current
    chipManagerRef.current = new ChipRootManager()
    scheduleChipManagerUnmount(oldChipManager)
    store.clear()
    editor.textContent = ''
    const fragment = deserialize(value, store)
    editor.appendChild(fragment)
    renderAllChips()

    // Reset highlight on value change
    highlightedChipRef.current = null
    setCaretVisible(true)

    syncHeightAfterLayoutChange()
  })

  // ---------------------------------------------------------------------------
  // Cleanup on unmount
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const store = storeRef.current
    return () => {
      pendingPasteCommitRef.current = false
      if (deferredHeightSyncIdRef.current !== null) {
        window.clearTimeout(deferredHeightSyncIdRef.current)
      }
      flushPendingChipManagerUnmounts()
      chipManagerRef.current.unmountAll()
      store.clear()
    }
  }, [])

  // ---------------------------------------------------------------------------
  // Input handler — serialize DOM on every change
  // ---------------------------------------------------------------------------
  function handleInput(): void {
    clearHighlight()
    pendingPasteCommitRef.current = false
    commitEditorChangeAfterMutation()
  }

  function handlePaste(e: React.ClipboardEvent<HTMLDivElement>): void {
    clearHighlight()

    const editor = editorRef.current
    if (!editor) return

    const pastedText = e.clipboardData?.getData('text/plain') ?? ''
    e.preventDefault()
    const normalizedText = normalizePastedPlainText(pastedText, multiline)
    if (normalizedText.length === 0) return

    editor.focus()

    let wasInserted = false
    if (typeof document.execCommand === 'function') {
      try {
        wasInserted = document.execCommand('insertText', false, normalizedText)
      } catch {
        wasInserted = false
      }
    }

    if (wasInserted) {
      pendingPasteCommitRef.current = true
      queueMicrotask(() => {
        if (!pendingPasteCommitRef.current) return
        pendingPasteCommitRef.current = false
        commitEditorChangeAfterMutation()
      })
      return
    }

    const selectionRange = getSelectionRangeInsideEditor(editor)
    if (!selectionRange) return

    const fallbackRange = selectionRange.cloneRange()
    fallbackRange.deleteContents()
    const textNode = document.createTextNode(normalizedText)
    fallbackRange.insertNode(textNode)

    const selection = document.getSelection()
    if (selection) {
      const newRange = document.createRange()
      newRange.setStart(textNode, normalizedText.length)
      newRange.collapse(true)
      selection.removeAllRanges()
      selection.addRange(newRange)
    }

    commitEditorChangeAfterMutation()
  }

  // ---------------------------------------------------------------------------
  // Key down — mention/ghost/backspace/submit logic
  // ---------------------------------------------------------------------------
  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>): void {
    if (isComposingRef.current) return

    if (mention.handleMentionKeyDown(e)) return
    if (ghost.handleGhostKeyDown(e)) return

    if (e.key === '@' && onFetchMentions) {
      queueMicrotask(() => {
        mention.openMentionFromCurrentCaret()
      })
    }

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
    ghost.clearGhostState(true)
  }

  function handleMouseDown(): void {
    focusFromPointerRef.current = true
  }

  function handleFocus(): void {
    const editor = editorRef.current
    if (!editor) return

    const isFocusedViaPointer = focusFromPointerRef.current
    focusFromPointerRef.current = false
    if (isFocusedViaPointer) return

    queueMicrotask(() => {
      const currentEditor = editorRef.current
      if (!currentEditor) return
      placeCaretAtEditorEnd(currentEditor)
      syncSingleLineCaretVisibility()
    })
  }

  function handleBlur(): void {
    focusFromPointerRef.current = false
    clearHighlight()
    ghost.clearGhostState(true)
    mention.closeMentionMode()
  }

  function handleCompositionStart(): void {
    isComposingRef.current = true
  }

  function handleCompositionEnd(): void {
    isComposingRef.current = false
    mention.handleCompositionEnd()
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  const rootClassName = [className, classNames?.root].filter(Boolean).join(' ')
  const inputClassName = classNames?.input || undefined
  const shouldApplyDefaultInputLineHeight = !inputClassName
  const defaultInputLineHeight = multiline ? '1.6' : '1.4'

  const isPlaceholderVisible = isEmpty(value)
  const activeGhostSuggestion =
    ghost.ghostSuggestions[ghost.ghostActiveIndex] ?? ''
  const isGhostVisible =
    !mention.isMentionOpen &&
    ghost.ghostAnchor !== null &&
    activeGhostSuggestion.length > 0 &&
    ghost.ghostActiveIndex >= 0 &&
    ghost.ghostActiveIndex < ghost.ghostSuggestions.length

  return (
    <>
      <div
        className={rootClassName || undefined}
        style={{
          ...style,
          ...styles?.root,
        }}
      >
        <div
          ref={wrapperRef}
          style={{ position: 'relative', overflow: 'hidden' }}
        >
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            role="textbox"
            aria-multiline={multiline || undefined}
            onMouseDown={handleMouseDown}
            onFocus={handleFocus}
            onInput={handleInput}
            onPaste={handlePaste}
            onKeyDown={handleKeyDown}
            onClick={handleClick}
            onBlur={handleBlur}
            onCompositionStart={handleCompositionStart}
            onCompositionEnd={handleCompositionEnd}
            className={inputClassName}
            style={{
              outline: 'none',
              lineHeight: shouldApplyDefaultInputLineHeight
                ? defaultInputLineHeight
                : undefined,
              whiteSpace: multiline ? 'pre-wrap' : 'nowrap',
              overflowX: multiline ? undefined : 'auto',
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
          <GhostTextOverlay
            isVisible={isGhostVisible}
            text={activeGhostSuggestion}
            anchor={ghost.ghostAnchor}
            typography={ghost.ghostTypography}
            classNames={classNames}
            styles={styles}
          />
        </div>
      </div>

      <MentionDropdownPortal
        isOpen={mention.isMentionOpen}
        mentionQuery={mention.mentionQuery}
        mentionItems={mention.mentionItems}
        mentionActiveIndex={mention.mentionActiveIndex}
        mentionAnchorRect={mention.mentionAnchorRect}
        mentionDropdownPosition={mention.mentionDropdownPosition}
        mentionDropdownRef={mention.mentionDropdownRef}
        classNames={classNames}
        styles={styles}
        defaultTagIcon={defaultTagIcon}
        onMentionMouseEnter={(index) => mention.setMentionActiveIndex(index)}
        onMentionMouseDown={(item, event) => {
          event.preventDefault()
          mention.selectMentionItem(item)
        }}
      />
    </>
  )
}
