import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
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
import type { MentionItem, Segment, SmartTextboxProps } from './types'

type MentionPoint = {
  node: Node
  offset: number
}

type MentionRect = {
  top: number
  left: number
  right: number
  bottom: number
  width: number
  height: number
}

type CharacterBeforeCaret = {
  char: string
  node: Text
  offset: number
}

type GhostAnchor = {
  top: number
  left: number
  height: number
}

const DEFAULT_AUTOCOMPLETE_DELAY = 300
const DEFAULT_TRAILING_LENGTH = 300

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

function containsWhitespace(value: string): boolean {
  return /\s/.test(value)
}

function startsWithWhitespace(value: string): boolean {
  if (value.length === 0) return false
  return /\s/.test(value[0] ?? '')
}

function toFiniteNumber(value: number): number {
  if (Number.isFinite(value)) return value
  return 0
}

function toMentionRect(rect: DOMRect): MentionRect {
  return {
    top: toFiniteNumber(rect.top),
    left: toFiniteNumber(rect.left),
    right: toFiniteNumber(rect.right),
    bottom: toFiniteNumber(rect.bottom),
    width: toFiniteNumber(rect.width),
    height: toFiniteNumber(rect.height),
  }
}

function getRightmostEditableText(node: Node): Text | null {
  if (node.nodeType === Node.TEXT_NODE) {
    return node as Text
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return null
  }

  const element = node as HTMLElement
  if (element.contentEditable === 'false') {
    return null
  }

  for (let i = element.childNodes.length - 1; i >= 0; i -= 1) {
    const text = getRightmostEditableText(element.childNodes[i])
    if (text) return text
  }

  return null
}

function getCharacterBeforeCaret(range: Range): CharacterBeforeCaret | null {
  const { startContainer, startOffset } = range

  if (startContainer.nodeType === Node.TEXT_NODE) {
    if (startOffset === 0) return null
    const textNode = startContainer as Text
    const text = textNode.textContent ?? ''
    const char = text[startOffset - 1]
    if (!char) return null
    return { char, node: textNode, offset: startOffset - 1 }
  }

  if (startContainer.nodeType === Node.ELEMENT_NODE) {
    if (startOffset === 0) return null
    const element = startContainer as HTMLElement
    const previous = element.childNodes[startOffset - 1]
    if (!previous) return null

    const textNode = getRightmostEditableText(previous)
    if (!textNode) return null
    const text = textNode.textContent ?? ''
    if (text.length === 0) return null
    return {
      char: text[text.length - 1],
      node: textNode,
      offset: text.length - 1,
    }
  }

  return null
}

function toPlainTextForGhostInternal(segments: Array<Segment>): string {
  return segments
    .map((segment) =>
      segment.type === 'text' ? segment.value : segment.item.searchValue
    )
    .join('')
}

function nodeHasVisibleContent(node: Node): boolean {
  if (node.nodeType === Node.TEXT_NODE) {
    return stripChipSentinels(node.textContent ?? '').length > 0
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return false
  }

  const element = node as HTMLElement
  if (element.hasAttribute(MENTION_ID_ATTR)) return true
  if (element.tagName === 'BR') return true

  for (const child of element.childNodes) {
    if (nodeHasVisibleContent(child)) return true
  }

  return false
}

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
  const [isMentionOpen, setIsMentionOpen] = useState(false)
  const mentionIsOpenRef = useRef(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const mentionQueryRef = useRef('')
  const [mentionItems, setMentionItems] = useState<Array<MentionItem>>([])
  const [mentionActiveIndex, setMentionActiveIndex] = useState(0)
  const [mentionAnchorRect, setMentionAnchorRect] =
    useState<MentionRect | null>(null)
  const [mentionDropdownPosition, setMentionDropdownPosition] = useState({
    top: 0,
    left: 0,
  })
  const mentionRequestIdRef = useRef(0)
  const mentionLastFetchQueryRef = useRef<string | null>(null)
  const mentionRangeRef = useRef<Range | null>(null)
  const mentionStartRef = useRef<MentionPoint | null>(null)
  const mentionDropdownRef = useRef<HTMLDivElement | null>(null)
  const [ghostSuggestions, setGhostSuggestions] = useState<Array<string>>([])
  const [ghostActiveIndex, setGhostActiveIndex] = useState(0)
  const [ghostAnchor, setGhostAnchor] = useState<GhostAnchor | null>(null)
  const [ghostTypography, setGhostTypography] = useState<CSSProperties>({})
  const isComposingRef = useRef(false)
  const focusFromPointerRef = useRef(false)
  const deferredHeightSyncIdRef = useRef<number | null>(null)
  const ghostDebounceIdRef = useRef<number | null>(null)
  const ghostRequestIdRef = useRef(0)
  const pendingChipManagerUnmountsRef = useRef<
    Array<{ manager: ChipRootManager; timeoutId: number }>
  >([])

  function setCaretVisible(visible: boolean): void {
    const editor = editorRef.current
    if (!editor) return
    editor.style.caretColor = visible ? '' : 'transparent'
  }

  function setMentionOpen(open: boolean): void {
    mentionIsOpenRef.current = open
    setIsMentionOpen(open)
  }

  function setMentionQueryValue(query: string): void {
    mentionQueryRef.current = query
    setMentionQuery(query)
  }

  function clearGhostDebounceTimer(): void {
    if (ghostDebounceIdRef.current !== null) {
      window.clearTimeout(ghostDebounceIdRef.current)
      ghostDebounceIdRef.current = null
    }
  }

  function clearGhostState(invalidateRequest = false): void {
    clearGhostDebounceTimer()
    if (invalidateRequest) {
      ghostRequestIdRef.current += 1
    }
    setGhostSuggestions((previous) => (previous.length === 0 ? previous : []))
    setGhostActiveIndex((previous) => (previous === 0 ? previous : 0))
    setGhostAnchor((previous) => (previous === null ? previous : null))
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

  function getCollapsedSelectionRange(editor: HTMLElement): Range | null {
    const selection = document.getSelection()
    if (!selection || selection.rangeCount === 0) return null
    const range = selection.getRangeAt(0)
    if (!range.collapsed) return null
    if (!editor.contains(range.startContainer)) return null
    return range
  }

  function isCaretAtVisualEnd(editor: HTMLElement, range: Range): boolean {
    if (!range.collapsed) return false
    if (!editor.contains(range.startContainer)) return false

    const trailingRange = range.cloneRange()
    try {
      trailingRange.setEnd(editor, editor.childNodes.length)
    } catch {
      return false
    }

    const trailingFragment = trailingRange.cloneContents()
    for (const child of trailingFragment.childNodes) {
      if (nodeHasVisibleContent(child)) return false
    }
    return true
  }

  function updateGhostAnchorFromSelection(): boolean {
    const editor = editorRef.current
    const wrapper = wrapperRef.current
    if (!editor || !wrapper) {
      setGhostAnchor(null)
      return false
    }

    const selectionRange = getCollapsedSelectionRange(editor)
    if (!selectionRange) {
      setGhostAnchor(null)
      return false
    }

    let rect = selectionRange.getBoundingClientRect()
    if (rect.width <= 0 && rect.height <= 0) {
      const marker = document.createElement('span')
      marker.textContent = CHIP_SENTINEL
      marker.style.display = 'inline'
      marker.style.padding = '0'
      marker.style.margin = '0'
      marker.style.lineHeight = 'inherit'
      marker.style.verticalAlign = 'top'
      marker.style.opacity = '0'
      marker.style.pointerEvents = 'none'

      const markerRange = selectionRange.cloneRange()
      try {
        markerRange.insertNode(marker)
        rect = marker.getBoundingClientRect()

        const selection = document.getSelection()
        if (selection) {
          const restoreRange = document.createRange()
          restoreRange.setStartAfter(marker)
          restoreRange.collapse(true)
          selection.removeAllRanges()
          selection.addRange(restoreRange)
        }
      } finally {
        marker.remove()
      }
    }

    const editorComputed = window.getComputedStyle(editor)
    const parsedLineHeight = Number.parseFloat(editorComputed.lineHeight)
    const fallbackLineHeight = Number.isFinite(parsedLineHeight)
      ? parsedLineHeight
      : 0
    const rectHeight = toFiniteNumber(rect.height)
    const height = Math.max(toFiniteNumber(rect.height), fallbackLineHeight)
    const wrapperRect = wrapper.getBoundingClientRect()
    let top = toFiniteNumber(rect.top) - toFiniteNumber(wrapperRect.top)
    if (
      fallbackLineHeight > 0 &&
      rectHeight > 0 &&
      rectHeight < fallbackLineHeight
    ) {
      // Some engines return glyph box height instead of line box height for
      // collapsed ranges. Shift up so ghost text shares the same baseline.
      top -= (fallbackLineHeight - rectHeight) / 2
    }
    const nextAnchor: GhostAnchor = {
      top,
      left: toFiniteNumber(rect.left) - toFiniteNumber(wrapperRect.left),
      height,
    }

    setGhostAnchor((previous) => {
      if (
        previous &&
        Math.abs(previous.top - nextAnchor.top) < 0.5 &&
        Math.abs(previous.left - nextAnchor.left) < 0.5 &&
        Math.abs(previous.height - nextAnchor.height) < 0.5
      ) {
        return previous
      }
      return nextAnchor
    })

    return true
  }

  function syncGhostTypographyFromEditor(): void {
    const editor = editorRef.current
    if (!editor) return

    const computed = window.getComputedStyle(editor)
    const nextTypography: CSSProperties = {
      fontFamily: computed.fontFamily,
      fontSize: computed.fontSize,
      fontWeight: computed.fontWeight,
      fontStyle: computed.fontStyle,
      lineHeight: computed.lineHeight,
      letterSpacing: computed.letterSpacing,
      textTransform: computed.textTransform,
      textIndent: computed.textIndent,
    }

    setGhostTypography((previous) => {
      if (
        previous.fontFamily === nextTypography.fontFamily &&
        previous.fontSize === nextTypography.fontSize &&
        previous.fontWeight === nextTypography.fontWeight &&
        previous.fontStyle === nextTypography.fontStyle &&
        previous.lineHeight === nextTypography.lineHeight &&
        previous.letterSpacing === nextTypography.letterSpacing &&
        previous.textTransform === nextTypography.textTransform &&
        previous.textIndent === nextTypography.textIndent
      ) {
        return previous
      }
      return nextTypography
    })
  }

  function scheduleGhostFetch(segments: Array<Segment>): void {
    clearGhostDebounceTimer()

    if (!onFetchSuggestions) return
    if (mentionIsOpenRef.current) return
    if (isComposingRef.current) return

    const editor = editorRef.current
    if (!editor) return

    const selectionRange = getCollapsedSelectionRange(editor)
    if (!selectionRange || !isCaretAtVisualEnd(editor, selectionRange)) return

    const effectiveTrailingLength = Math.max(1, trailingLength)
    const plainText = toPlainTextForGhostInternal(segments)
    const trailing = plainText.slice(-effectiveTrailingLength)
    if (trailing.length === 0) return

    const waitMs = Math.max(0, autocompleteDelay)
    ghostDebounceIdRef.current = window.setTimeout(() => {
      ghostDebounceIdRef.current = null
      const requestId = ++ghostRequestIdRef.current

      void onFetchSuggestions(trailing)
        .then((rawSuggestions) => {
          if (requestId !== ghostRequestIdRef.current) return
          if (mentionIsOpenRef.current || isComposingRef.current) return

          const currentEditor = editorRef.current
          if (!currentEditor) return

          const currentRange = getCollapsedSelectionRange(currentEditor)
          if (
            !currentRange ||
            !isCaretAtVisualEnd(currentEditor, currentRange)
          ) {
            return
          }

          const normalizedSuggestions = (
            Array.isArray(rawSuggestions) ? rawSuggestions : []
          ).filter(
            (value): value is string =>
              typeof value === 'string' && value.length > 0
          )

          if (normalizedSuggestions.length === 0) {
            setGhostSuggestions([])
            setGhostActiveIndex(0)
            setGhostAnchor(null)
            return
          }

          const hasAnchor = updateGhostAnchorFromSelection()
          if (!hasAnchor) {
            setGhostSuggestions([])
            setGhostActiveIndex(0)
            setGhostAnchor(null)
            return
          }

          syncGhostTypographyFromEditor()
          setGhostSuggestions(normalizedSuggestions)
          setGhostActiveIndex(0)
        })
        .catch(() => {
          if (requestId !== ghostRequestIdRef.current) return
          setGhostSuggestions([])
          setGhostActiveIndex(0)
          setGhostAnchor(null)
        })
    }, waitMs)
  }

  function acceptGhostSuggestion(): void {
    const editor = editorRef.current
    if (!editor) return
    if (mentionIsOpenRef.current) return

    const suggestion = ghostSuggestions[ghostActiveIndex] ?? ''
    if (suggestion.length === 0) return

    const selectionRange = getCollapsedSelectionRange(editor)
    if (!selectionRange || !isCaretAtVisualEnd(editor, selectionRange)) return

    editor.focus()

    let wasInserted = false
    if (typeof document.execCommand === 'function') {
      try {
        wasInserted = document.execCommand('insertText', false, suggestion)
      } catch {
        wasInserted = false
      }
    }

    if (!wasInserted) {
      const fallbackRange = selectionRange.cloneRange()
      fallbackRange.deleteContents()
      const textNode = document.createTextNode(suggestion)
      fallbackRange.insertNode(textNode)

      const selection = document.getSelection()
      if (selection) {
        const newRange = document.createRange()
        newRange.setStart(textNode, suggestion.length)
        newRange.collapse(true)
        selection.removeAllRanges()
        selection.addRange(newRange)
      }
    }

    clearGhostState(true)

    const segments = normalizeSegments(serialize(editor, storeRef.current))
    onChange(segments)
    syncHeightAfterLayoutChange()
    syncSingleLineCaretVisibilityDeferred()
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

  function closeMentionMode(): void {
    if (
      !mentionIsOpenRef.current &&
      !mentionStartRef.current &&
      !mentionRangeRef.current
    ) {
      return
    }

    mentionRequestIdRef.current += 1
    mentionLastFetchQueryRef.current = null
    mentionRangeRef.current = null
    mentionStartRef.current = null
    clearGhostState(true)
    setMentionAnchorRect(null)
    setMentionItems([])
    setMentionActiveIndex(0)
    setMentionQueryValue('')
    setMentionOpen(false)
  }

  async function fetchMentions(query: string): Promise<void> {
    if (!onFetchMentions || !mentionIsOpenRef.current) return
    if (mentionLastFetchQueryRef.current === query) return

    mentionLastFetchQueryRef.current = query
    const requestId = ++mentionRequestIdRef.current

    try {
      const items = await onFetchMentions(query)
      if (
        requestId !== mentionRequestIdRef.current ||
        !mentionIsOpenRef.current
      ) {
        return
      }

      const normalizedItems = Array.isArray(items) ? items : []
      setMentionItems(normalizedItems)
      setMentionActiveIndex((previous) => {
        if (normalizedItems.length === 0) return 0
        return Math.min(previous, normalizedItems.length - 1)
      })
    } catch {
      if (
        requestId !== mentionRequestIdRef.current ||
        !mentionIsOpenRef.current
      ) {
        return
      }

      setMentionItems([])
      setMentionActiveIndex(0)
    }
  }

  function openMentionFromCurrentCaret(): boolean {
    const editor = editorRef.current

    if (!editor || !onFetchMentions || mentionIsOpenRef.current) {
      return false
    }

    const selection = document.getSelection()
    if (!selection || selection.rangeCount === 0) {
      return false
    }

    const caretRange = selection.getRangeAt(0)
    if (!caretRange.collapsed) {
      return false
    }
    if (!editor.contains(caretRange.startContainer)) {
      return false
    }

    const charBefore = getCharacterBeforeCaret(caretRange)
    if (!charBefore || charBefore.char !== '@') {
      return false
    }

    const mentionRange = document.createRange()
    try {
      mentionRange.setStart(charBefore.node, charBefore.offset)
      mentionRange.setEnd(caretRange.startContainer, caretRange.startOffset)
    } catch {
      return false
    }

    const triggerText = stripChipSentinels(mentionRange.toString())
    if (triggerText !== '@') {
      return false
    }

    mentionStartRef.current = {
      node: charBefore.node,
      offset: charBefore.offset,
    }
    mentionRangeRef.current = mentionRange
    mentionLastFetchQueryRef.current = null
    clearGhostState(true)

    setMentionOpen(true)
    setMentionQueryValue('')
    setMentionItems([])
    setMentionActiveIndex(0)
    setMentionAnchorRect(toMentionRect(mentionRange.getBoundingClientRect()))
    void fetchMentions('')
    return true
  }

  function refreshMentionQueryFromSelection(): void {
    if (!mentionIsOpenRef.current) return

    const editor = editorRef.current
    const start = mentionStartRef.current
    if (!editor || !start) {
      closeMentionMode()
      return
    }

    const selection = document.getSelection()
    if (!selection || selection.rangeCount === 0) {
      closeMentionMode()
      return
    }

    const caretRange = selection.getRangeAt(0)
    if (!caretRange.collapsed || !editor.contains(caretRange.startContainer)) {
      closeMentionMode()
      return
    }

    const mentionRange = document.createRange()
    try {
      mentionRange.setStart(start.node, start.offset)
      mentionRange.setEnd(caretRange.startContainer, caretRange.startOffset)
    } catch {
      closeMentionMode()
      return
    }

    const mentionText = stripChipSentinels(mentionRange.toString())
    if (!mentionText.startsWith('@')) {
      closeMentionMode()
      return
    }

    const query = mentionText.slice(1)
    if (containsWhitespace(query)) {
      closeMentionMode()
      return
    }

    mentionRangeRef.current = mentionRange
    setMentionAnchorRect(toMentionRect(mentionRange.getBoundingClientRect()))

    if (query !== mentionQueryRef.current) {
      setMentionQueryValue(query)
      void fetchMentions(query)
    }
  }

  function insertMentionItem(item: MentionItem): void {
    const editor = editorRef.current
    const mentionRange = mentionRangeRef.current
    if (!editor || !mentionRange) return

    clearHighlight()

    const chip = createChipSpan(item.id)
    storeRef.current.set(item)
    insertChipAtRange(mentionRange.cloneRange(), chip)

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
    closeMentionMode()
  }

  function syncMentionDropdownPosition(): void {
    if (!mentionIsOpenRef.current || !mentionAnchorRect) return

    const dropdown = mentionDropdownRef.current
    if (!dropdown) return

    const viewportWidth =
      window.innerWidth || document.documentElement.clientWidth
    const viewportHeight =
      window.innerHeight || document.documentElement.clientHeight
    const dropdownRect = dropdown.getBoundingClientRect()
    const dropdownWidth = toFiniteNumber(dropdownRect.width)
    const dropdownHeight = toFiniteNumber(dropdownRect.height)

    const minMargin = 8
    const gap = 4

    let left = mentionAnchorRect.left
    let top = mentionAnchorRect.bottom + gap

    if (left + dropdownWidth > viewportWidth - minMargin) {
      left = Math.max(minMargin, viewportWidth - dropdownWidth - minMargin)
    }

    const canFlipAbove =
      mentionAnchorRect.top - gap - dropdownHeight >= minMargin
    if (top + dropdownHeight > viewportHeight - minMargin && canFlipAbove) {
      top = mentionAnchorRect.top - gap - dropdownHeight
    }

    top = Math.min(top, viewportHeight - dropdownHeight - minMargin)
    top = Math.max(minMargin, top)
    left = Math.max(minMargin, left)
    if (!Number.isFinite(top) || !Number.isFinite(left)) return

    setMentionDropdownPosition((previous) => {
      if (
        Math.abs(previous.top - top) < 0.5 &&
        Math.abs(previous.left - left) < 0.5
      ) {
        return previous
      }
      return { top, left }
    })
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

    if (mentionIsOpenRef.current) {
      closeMentionMode()
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
    if (mentionIsOpenRef.current) {
      closeMentionMode()
    }
    clearGhostState(true)
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

  useEffect(() => {
    if (!isMentionOpen) return

    function syncAnchorFromRange(): void {
      const mentionRange = mentionRangeRef.current
      if (!mentionRange) return
      setMentionAnchorRect(toMentionRect(mentionRange.getBoundingClientRect()))
    }

    function handlePointerDown(event: PointerEvent): void {
      const target = event.target
      if (!target || !(target instanceof Node)) return

      const editor = editorRef.current
      const dropdown = mentionDropdownRef.current
      if (editor?.contains(target)) return
      if (dropdown?.contains(target)) return
      closeMentionMode()
    }

    document.addEventListener('pointerdown', handlePointerDown, true)
    window.addEventListener('resize', syncAnchorFromRange)
    window.addEventListener('scroll', syncAnchorFromRange, true)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true)
      window.removeEventListener('resize', syncAnchorFromRange)
      window.removeEventListener('scroll', syncAnchorFromRange, true)
    }
  })

  useEffect(() => {
    if (!isMentionOpen) return
    syncMentionDropdownPosition()
  })

  useEffect(() => {
    if (!isMentionOpen) return
    const dropdown = mentionDropdownRef.current
    if (!dropdown) return
    const selector = `[data-mention-option-index="${mentionActiveIndex}"]`
    const activeOption = dropdown.querySelector<HTMLElement>(selector)
    if (!activeOption) return
    activeOption.scrollIntoView({ block: 'nearest' })
  }, [isMentionOpen, mentionActiveIndex, mentionItems.length])

  useEffect(() => {
    const activeGhostSuggestion = ghostSuggestions[ghostActiveIndex] ?? ''
    if (
      isMentionOpen ||
      !ghostAnchor ||
      ghostSuggestions.length === 0 ||
      activeGhostSuggestion.length === 0
    ) {
      return
    }

    function syncGhostLayout(): void {
      const hasAnchor = updateGhostAnchorFromSelection()
      if (!hasAnchor) {
        setGhostSuggestions([])
        setGhostActiveIndex(0)
        setGhostAnchor(null)
        return
      }
      syncGhostTypographyFromEditor()
    }

    window.addEventListener('resize', syncGhostLayout)
    window.addEventListener('scroll', syncGhostLayout, true)

    return () => {
      window.removeEventListener('resize', syncGhostLayout)
      window.removeEventListener('scroll', syncGhostLayout, true)
    }
  })

  // ---------------------------------------------------------------------------
  // Cleanup on unmount
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const store = storeRef.current
    return () => {
      if (deferredHeightSyncIdRef.current !== null) {
        window.clearTimeout(deferredHeightSyncIdRef.current)
      }
      clearGhostDebounceTimer()
      flushPendingChipManagerUnmounts()
      ghostRequestIdRef.current += 1
      mentionRequestIdRef.current += 1
      mentionRangeRef.current = null
      mentionStartRef.current = null
      mentionIsOpenRef.current = false
      chipManagerRef.current.unmountAll()
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

    clearGhostState(true)

    const segments = normalizeSegments(serialize(editor, storeRef.current))
    onChange(segments)
    syncHeight()
    syncSingleLineCaretVisibility()

    if (isComposingRef.current) return
    if (mentionIsOpenRef.current) {
      refreshMentionQueryFromSelection()
      return
    }

    if (onFetchMentions && openMentionFromCurrentCaret()) {
      return
    }

    scheduleGhostFetch(segments)
  }

  // ---------------------------------------------------------------------------
  // Key down — backspace + submit logic
  // ---------------------------------------------------------------------------
  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>): void {
    if (isComposingRef.current) return

    if (mentionIsOpenRef.current) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setMentionActiveIndex((previous) => {
          if (mentionItems.length === 0) return 0
          return (previous + 1) % mentionItems.length
        })
        return
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setMentionActiveIndex((previous) => {
          if (mentionItems.length === 0) return 0
          return (previous - 1 + mentionItems.length) % mentionItems.length
        })
        return
      }

      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        const activeItem = mentionItems[mentionActiveIndex] ?? null
        if (activeItem) {
          insertMentionItem(activeItem)
        }
        return
      }

      if (e.key === 'Escape') {
        e.preventDefault()
        closeMentionMode()
        return
      }

      if (
        e.key === 'ArrowLeft' ||
        e.key === 'ArrowRight' ||
        e.key === 'Home' ||
        e.key === 'End'
      ) {
        closeMentionMode()
        return
      }

      // Mention mode owns key handling while open.
      return
    }

    const hasVisibleGhost =
      !isMentionOpen &&
      ghostAnchor !== null &&
      ghostActiveIndex >= 0 &&
      ghostActiveIndex < ghostSuggestions.length &&
      (ghostSuggestions[ghostActiveIndex] ?? '').length > 0

    if (hasVisibleGhost && e.key === 'Tab') {
      e.preventDefault()
      if (e.shiftKey) {
        setGhostActiveIndex((previous) => {
          if (ghostSuggestions.length === 0) return 0
          return (previous + 1) % ghostSuggestions.length
        })
      } else {
        acceptGhostSuggestion()
      }
      return
    }

    if (hasVisibleGhost && e.key === 'Escape') {
      e.preventDefault()
      clearGhostState(true)
      return
    }

    if (e.key === '@' && onFetchMentions) {
      queueMicrotask(() => {
        openMentionFromCurrentCaret()
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
    clearGhostState(true)
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
    clearGhostState(true)
    closeMentionMode()
  }

  function handleCompositionStart(): void {
    isComposingRef.current = true
  }

  function handleCompositionEnd(): void {
    isComposingRef.current = false
    if (mentionIsOpenRef.current) {
      refreshMentionQueryFromSelection()
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  const rootClassName = [className, classNames?.root].filter(Boolean).join(' ')
  const inputClassName = classNames?.input || undefined

  const isPlaceholderVisible = isEmpty(value)
  const activeGhostSuggestion = ghostSuggestions[ghostActiveIndex] ?? ''
  const isGhostVisible =
    !isMentionOpen &&
    ghostAnchor !== null &&
    activeGhostSuggestion.length > 0 &&
    ghostActiveIndex >= 0 &&
    ghostActiveIndex < ghostSuggestions.length
  let mentionDropdownPortal: ReturnType<typeof createPortal> | null = null

  if (isMentionOpen && mentionAnchorRect && typeof document !== 'undefined') {
    mentionDropdownPortal = createPortal(
      <div
        ref={mentionDropdownRef}
        role="listbox"
        data-mention-query={mentionQuery}
        className={classNames?.dropdown}
        style={{
          position: 'fixed',
          top: mentionDropdownPosition.top,
          left: mentionDropdownPosition.left,
          minWidth: 220,
          maxWidth: 320,
          maxHeight: 220,
          overflowY: 'auto',
          border: '1px solid #2E2E2E',
          borderRadius: 8,
          backgroundColor: '#1C1C1C',
          color: '#E5E5E5',
          padding: 4,
          zIndex: 1000,
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)',
          ...styles?.dropdown,
        }}
      >
        {mentionItems.length === 0 && (
          <div
            style={{
              padding: '8px 10px',
              opacity: 0.7,
              fontSize: 13,
            }}
          >
            {mentionQuery.length > 0
              ? `No mentions for "${mentionQuery}"`
              : 'No mentions'}
          </div>
        )}

        {mentionItems.map((item, index) => {
          const isActive = index === mentionActiveIndex
          const icon = item.icon ?? defaultTagIcon
          return (
            <div
              key={`${item.id}-${index}`}
              role="option"
              aria-selected={isActive}
              data-mention-option-index={index}
              className={classNames?.dropdownItem}
              onMouseEnter={() => setMentionActiveIndex(index)}
              onMouseDown={(event) => {
                event.preventDefault()
                insertMentionItem(item)
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                borderRadius: 6,
                padding: '8px 10px',
                cursor: 'pointer',
                backgroundColor: isActive ? '#2A2A2A' : 'transparent',
                ...styles?.dropdownItem,
              }}
            >
              {icon && (
                <span style={{ display: 'inline-flex', flexShrink: 0 }}>
                  {icon}
                </span>
              )}
              <span>{item.label}</span>
            </div>
          )
        })}
      </div>,
      document.body
    )
  }

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
            onKeyDown={handleKeyDown}
            onClick={handleClick}
            onBlur={handleBlur}
            onCompositionStart={handleCompositionStart}
            onCompositionEnd={handleCompositionEnd}
            className={inputClassName}
            style={{
              outline: 'none',
              lineHeight: multiline ? '1.45' : '1.4',
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
          {isGhostVisible && ghostAnchor && (
            <div
              aria-hidden
              className={classNames?.ghostText}
              style={{
                position: 'absolute',
                top: ghostAnchor.top,
                left: ghostAnchor.left,
                minHeight: ghostAnchor.height,
                pointerEvents: 'none',
                userSelect: 'none',
                whiteSpace: 'pre',
                opacity: 0.35,
                color: '#6E6E6E',
                ...ghostTypography,
                ...styles?.ghostText,
              }}
            >
              {activeGhostSuggestion}
            </div>
          )}
        </div>
      </div>
      {mentionDropdownPortal}
    </>
  )
}
