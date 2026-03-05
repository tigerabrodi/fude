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
  toFiniteNumber,
  toMentionRect,
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
  const [mentionDropdownPosition, setMentionDropdownPosition] = useState({
    top: 0,
    left: 0,
  })
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
    onMentionModeToggle?.()

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

  function handleCompositionEnd(): void {
    if (mentionIsOpenRef.current) {
      refreshMentionQueryFromSelection()
    }
  }

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
