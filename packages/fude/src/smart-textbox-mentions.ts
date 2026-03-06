import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MutableRefObject,
} from 'react'
import { stripChipSentinels } from './serializer'
import {
  containsWhitespace,
  getCharacterBeforeCaret,
  getCollapsedCaretRect,
  getVisibleViewportRect,
  toFiniteNumber,
  type MentionRect,
} from './smart-textbox-utils'
import type { MentionItem } from './types'

type MentionPoint = {
  node: Node
  offset: number
}

type MentionDropdownPosition = {
  top: number
  left: number
  width?: number
  minWidth: number
  maxWidth: number
  maxHeight: number
  placement: 'below' | 'above' | 'tray'
}

const MENTION_DROPDOWN_MARGIN = 8
const MENTION_DROPDOWN_GAP = 4
const MENTION_DROPDOWN_MIN_WIDTH = 220
const MENTION_DROPDOWN_MAX_WIDTH = 320
const MENTION_DROPDOWN_MIN_USABLE_HEIGHT = 120
const MENTION_DROPDOWN_TRAY_MAX_HEIGHT = 240
const DEFAULT_MENTION_DROPDOWN_POSITION: MentionDropdownPosition = {
  top: 0,
  left: 0,
  minWidth: MENTION_DROPDOWN_MIN_WIDTH,
  maxWidth: MENTION_DROPDOWN_MAX_WIDTH,
  maxHeight: MENTION_DROPDOWN_TRAY_MAX_HEIGHT,
  placement: 'below',
}

type UseSmartTextboxMentionsParams = {
  editorRef: MutableRefObject<HTMLDivElement | null>
  onFetchMentions?: (query: string) => Promise<Array<MentionItem>>
  onSelectMention: (item: MentionItem, mentionRange: Range) => void
  onMentionModeToggle?: () => void
}

type UseSmartTextboxMentionsResult = {
  isMentionOpen: boolean
  mentionIsOpenRef: MutableRefObject<boolean>
  mentionQuery: string
  mentionItems: Array<MentionItem>
  mentionActiveIndex: number
  mentionAnchorRect: MentionRect | null
  mentionDropdownPosition: MentionDropdownPosition
  mentionDropdownRef: MutableRefObject<HTMLDivElement | null>
  setMentionActiveIndex: (index: number) => void
  closeMentionMode: () => void
  openMentionFromCurrentCaret: () => boolean
  refreshMentionQueryFromSelection: () => void
  handleMentionKeyDown: (e: KeyboardEvent<HTMLDivElement>) => boolean
  selectMentionItem: (item: MentionItem) => void
  handleCompositionEnd: () => void
}

export function useSmartTextboxMentions({
  editorRef,
  onFetchMentions,
  onSelectMention,
  onMentionModeToggle,
}: UseSmartTextboxMentionsParams): UseSmartTextboxMentionsResult {
  const [isMentionOpen, setIsMentionOpen] = useState(false)
  const mentionIsOpenRef = useRef(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const mentionQueryRef = useRef('')
  const [mentionItems, setMentionItems] = useState<Array<MentionItem>>([])
  const [mentionActiveIndex, setMentionActiveIndex] = useState(0)
  const [mentionAnchorRect, setMentionAnchorRect] =
    useState<MentionRect | null>(null)
  const [mentionDropdownPosition, setMentionDropdownPosition] = useState(
    DEFAULT_MENTION_DROPDOWN_POSITION
  )
  const mentionRequestIdRef = useRef(0)
  const mentionLastFetchQueryRef = useRef<string | null>(null)
  const mentionRangeRef = useRef<Range | null>(null)
  const mentionStartRef = useRef<MentionPoint | null>(null)
  const mentionDropdownRef = useRef<HTMLDivElement | null>(null)

  function setMentionOpen(open: boolean): void {
    mentionIsOpenRef.current = open
    setIsMentionOpen(open)
  }

  function setMentionQueryValue(query: string): void {
    mentionQueryRef.current = query
    setMentionQuery(query)
  }

  function closeMentionMode(): void {
    if (
      !mentionIsOpenRef.current &&
      !mentionStartRef.current &&
      !mentionRangeRef.current
    ) {
      return
    }

    onMentionModeToggle?.()
    mentionRequestIdRef.current += 1
    mentionLastFetchQueryRef.current = null
    mentionRangeRef.current = null
    mentionStartRef.current = null
    setMentionAnchorRect(null)
    setMentionDropdownPosition(DEFAULT_MENTION_DROPDOWN_POSITION)
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

  function updateMentionAnchorFromRange(caretRange: Range): boolean {
    const caretRect = getCollapsedCaretRect(caretRange)
    if (!caretRect) {
      setMentionAnchorRect(null)
      return false
    }

    const viewport = getVisibleViewportRect()
    setMentionAnchorRect({
      top: toFiniteNumber(caretRect.top) + viewport.top,
      left: toFiniteNumber(caretRect.left) + viewport.left,
      right: toFiniteNumber(caretRect.right) + viewport.left,
      bottom: toFiniteNumber(caretRect.bottom) + viewport.top,
      width: toFiniteNumber(caretRect.width),
      height: toFiniteNumber(caretRect.height),
    })
    return true
  }

  function updateMentionAnchorFromSelection(): boolean {
    const editor = editorRef.current
    if (!editor) {
      setMentionAnchorRect(null)
      return false
    }

    const selection = document.getSelection()
    if (!selection || selection.rangeCount === 0) {
      setMentionAnchorRect(null)
      return false
    }

    const caretRange = selection.getRangeAt(0)
    if (!caretRange.collapsed || !editor.contains(caretRange.startContainer)) {
      setMentionAnchorRect(null)
      return false
    }

    return updateMentionAnchorFromRange(caretRange)
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
    onMentionModeToggle?.()

    setMentionOpen(true)
    setMentionQueryValue('')
    setMentionItems([])
    setMentionActiveIndex(0)
    setMentionDropdownPosition(DEFAULT_MENTION_DROPDOWN_POSITION)
    updateMentionAnchorFromRange(caretRange)
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
    updateMentionAnchorFromRange(caretRange)

    if (query !== mentionQueryRef.current) {
      setMentionQueryValue(query)
      void fetchMentions(query)
    }
  }

  function selectMentionItem(item: MentionItem): void {
    const mentionRange = mentionRangeRef.current
    if (!mentionRange) return
    onSelectMention(item, mentionRange.cloneRange())
  }

  function handleMentionKeyDown(e: KeyboardEvent<HTMLDivElement>): boolean {
    if (!mentionIsOpenRef.current) return false

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setMentionActiveIndex((previous) => {
        if (mentionItems.length === 0) return 0
        return (previous + 1) % mentionItems.length
      })
      return true
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setMentionActiveIndex((previous) => {
        if (mentionItems.length === 0) return 0
        return (previous - 1 + mentionItems.length) % mentionItems.length
      })
      return true
    }

    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      const activeItem = mentionItems[mentionActiveIndex] ?? null
      if (activeItem) {
        selectMentionItem(activeItem)
      }
      return true
    }

    if (e.key === 'Escape') {
      e.preventDefault()
      closeMentionMode()
      return true
    }

    if (
      e.key === 'ArrowLeft' ||
      e.key === 'ArrowRight' ||
      e.key === 'Home' ||
      e.key === 'End'
    ) {
      closeMentionMode()
      return true
    }

    // Mention mode owns key handling while open.
    return true
  }

  function syncMentionDropdownPosition(): void {
    if (!mentionIsOpenRef.current || !mentionAnchorRect) return

    const dropdown = mentionDropdownRef.current
    if (!dropdown) return

    const viewport = getVisibleViewportRect()
    const dropdownRect = dropdown.getBoundingClientRect()
    const dropdownWidth = toFiniteNumber(dropdownRect.width)
    const dropdownHeight = toFiniteNumber(dropdownRect.height)
    const horizontalInset = viewport.left + MENTION_DROPDOWN_MARGIN
    const availableWidth = Math.max(
      0,
      viewport.width - MENTION_DROPDOWN_MARGIN * 2
    )
    const anchoredMinWidth = Math.min(
      MENTION_DROPDOWN_MIN_WIDTH,
      availableWidth
    )
    const anchoredMaxWidth = Math.min(
      MENTION_DROPDOWN_MAX_WIDTH,
      availableWidth
    )
    const renderedAnchoredWidth = Math.min(
      Math.max(dropdownWidth, anchoredMinWidth),
      Math.max(anchoredMaxWidth, anchoredMinWidth)
    )

    const spaceBelow = Math.max(
      0,
      viewport.bottom -
        mentionAnchorRect.bottom -
        MENTION_DROPDOWN_GAP -
        MENTION_DROPDOWN_MARGIN
    )
    const spaceAbove = Math.max(
      0,
      mentionAnchorRect.top -
        viewport.top -
        MENTION_DROPDOWN_GAP -
        MENTION_DROPDOWN_MARGIN
    )

    let nextPosition: MentionDropdownPosition

    if (spaceBelow >= MENTION_DROPDOWN_MIN_USABLE_HEIGHT) {
      let left = mentionAnchorRect.right
      if (
        left + renderedAnchoredWidth >
        viewport.right - MENTION_DROPDOWN_MARGIN
      ) {
        left = viewport.right - renderedAnchoredWidth - MENTION_DROPDOWN_MARGIN
      }
      left = Math.max(horizontalInset, left)

      nextPosition = {
        top: mentionAnchorRect.bottom + MENTION_DROPDOWN_GAP,
        left,
        minWidth: anchoredMinWidth,
        maxWidth: Math.max(anchoredMaxWidth, anchoredMinWidth),
        maxHeight: spaceBelow,
        placement: 'below',
      }
    } else if (spaceAbove >= MENTION_DROPDOWN_MIN_USABLE_HEIGHT) {
      let left = mentionAnchorRect.right
      if (
        left + renderedAnchoredWidth >
        viewport.right - MENTION_DROPDOWN_MARGIN
      ) {
        left = viewport.right - renderedAnchoredWidth - MENTION_DROPDOWN_MARGIN
      }
      left = Math.max(horizontalInset, left)

      const renderedHeight = Math.min(dropdownHeight, spaceAbove)
      const top = Math.max(
        viewport.top + MENTION_DROPDOWN_MARGIN,
        mentionAnchorRect.top - MENTION_DROPDOWN_GAP - renderedHeight
      )

      nextPosition = {
        top,
        left,
        minWidth: anchoredMinWidth,
        maxWidth: Math.max(anchoredMaxWidth, anchoredMinWidth),
        maxHeight: spaceAbove,
        placement: 'above',
      }
    } else {
      const trayWidth = Math.max(0, availableWidth)
      const trayMaxHeight = Math.min(
        MENTION_DROPDOWN_TRAY_MAX_HEIGHT,
        Math.max(0, viewport.height - MENTION_DROPDOWN_MARGIN * 2)
      )
      const renderedHeight = Math.min(dropdownHeight, trayMaxHeight)

      nextPosition = {
        top: Math.max(
          viewport.top + MENTION_DROPDOWN_MARGIN,
          viewport.bottom - MENTION_DROPDOWN_MARGIN - renderedHeight
        ),
        left: horizontalInset,
        width: trayWidth,
        minWidth: trayWidth,
        maxWidth: trayWidth,
        maxHeight: trayMaxHeight,
        placement: 'tray',
      }
    }

    if (
      !Number.isFinite(nextPosition.top) ||
      !Number.isFinite(nextPosition.left) ||
      !Number.isFinite(nextPosition.minWidth) ||
      !Number.isFinite(nextPosition.maxWidth) ||
      !Number.isFinite(nextPosition.maxHeight)
    ) {
      return
    }

    setMentionDropdownPosition((previous) => {
      if (
        Math.abs(previous.top - nextPosition.top) < 0.5 &&
        Math.abs(previous.left - nextPosition.left) < 0.5 &&
        Math.abs(previous.minWidth - nextPosition.minWidth) < 0.5 &&
        Math.abs(previous.maxWidth - nextPosition.maxWidth) < 0.5 &&
        Math.abs(previous.maxHeight - nextPosition.maxHeight) < 0.5 &&
        Math.abs((previous.width ?? 0) - (nextPosition.width ?? 0)) < 0.5 &&
        previous.placement === nextPosition.placement
      ) {
        return previous
      }
      return nextPosition
    })
  }

  function handleCompositionEnd(): void {
    if (mentionIsOpenRef.current) {
      refreshMentionQueryFromSelection()
    }
  }

  useEffect(() => {
    if (!isMentionOpen) return

    function syncAnchorFromSelection(): void {
      updateMentionAnchorFromSelection()
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

    const visualViewport = window.visualViewport

    document.addEventListener('pointerdown', handlePointerDown, true)
    window.addEventListener('resize', syncAnchorFromSelection)
    window.addEventListener('scroll', syncAnchorFromSelection, true)
    visualViewport?.addEventListener('resize', syncAnchorFromSelection)
    visualViewport?.addEventListener('scroll', syncAnchorFromSelection)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true)
      window.removeEventListener('resize', syncAnchorFromSelection)
      window.removeEventListener('scroll', syncAnchorFromSelection, true)
      visualViewport?.removeEventListener('resize', syncAnchorFromSelection)
      visualViewport?.removeEventListener('scroll', syncAnchorFromSelection)
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
    return () => {
      mentionRequestIdRef.current += 1
      mentionRangeRef.current = null
      mentionStartRef.current = null
      mentionLastFetchQueryRef.current = null
      mentionIsOpenRef.current = false
    }
  }, [])

  return {
    isMentionOpen,
    mentionIsOpenRef,
    mentionQuery,
    mentionItems,
    mentionActiveIndex,
    mentionAnchorRect,
    mentionDropdownPosition,
    mentionDropdownRef,
    setMentionActiveIndex,
    closeMentionMode,
    openMentionFromCurrentCaret,
    refreshMentionQueryFromSelection,
    handleMentionKeyDown,
    selectMentionItem,
    handleCompositionEnd,
  }
}
