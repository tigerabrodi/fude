import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MutableRefObject,
} from 'react'
import {
  getCollapsedCaretRect,
  nodeHasVisibleContent,
  toFiniteNumber,
  toPlainTextForGhostInternal,
} from './smart-textbox-utils'
import type { Segment } from './types'

type GhostAnchor = {
  kind: 'single-line'
  top: number
  left: number
  height: number
}

type MultilineGhostAnchor = {
  kind: 'multiline'
  top: number
  left: number
  width: number
  height: number
  firstLineIndent: number
}

export type GhostLayout = GhostAnchor | MultilineGhostAnchor

type UseSmartTextboxGhostParams = {
  editorRef: MutableRefObject<HTMLDivElement | null>
  wrapperRef: MutableRefObject<HTMLDivElement | null>
  onFetchSuggestions?: (trailing: string) => Promise<Array<string>>
  autocompleteDelay: number
  trailingLength: number
  multiline: boolean
  mentionIsOpenRef: MutableRefObject<boolean>
  isComposingRef: MutableRefObject<boolean>
  onAcceptSuggestion: () => void
}

type UseSmartTextboxGhostResult = {
  ghostSuggestions: Array<string>
  ghostActiveIndex: number
  ghostLayout: GhostLayout | null
  ghostTypography: CSSProperties
  clearGhostState: (invalidateRequest?: boolean) => void
  scheduleGhostFetch: (segments: Array<Segment>) => void
  handleGhostKeyDown: (event: KeyboardEvent<HTMLDivElement>) => boolean
  acceptGhostSuggestion: () => void
}

export function useSmartTextboxGhost({
  editorRef,
  wrapperRef,
  onFetchSuggestions,
  autocompleteDelay,
  trailingLength,
  multiline,
  mentionIsOpenRef,
  isComposingRef,
  onAcceptSuggestion,
}: UseSmartTextboxGhostParams): UseSmartTextboxGhostResult {
  const [ghostSuggestions, setGhostSuggestions] = useState<Array<string>>([])
  const [ghostActiveIndex, setGhostActiveIndex] = useState(0)
  const [ghostLayout, setGhostLayout] = useState<GhostLayout | null>(null)
  const [ghostTypography, setGhostTypography] = useState<CSSProperties>({})
  const ghostDebounceIdRef = useRef<number | null>(null)
  const ghostRequestIdRef = useRef(0)

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
    setGhostLayout((previous) => (previous === null ? previous : null))
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

  function readPixelValue(value: string): number {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : 0
  }

  function hasSameGhostLayout(
    previous: GhostLayout | null,
    next: GhostLayout
  ): boolean {
    if (!previous || previous.kind !== next.kind) return false
    if (
      Math.abs(previous.top - next.top) >= 0.5 ||
      Math.abs(previous.left - next.left) >= 0.5 ||
      Math.abs(previous.height - next.height) >= 0.5
    ) {
      return false
    }

    if (previous.kind === 'multiline' && next.kind === 'multiline') {
      return (
        Math.abs(previous.width - next.width) < 0.5 &&
        Math.abs(previous.firstLineIndent - next.firstLineIndent) < 0.5
      )
    }

    return true
  }

  function updateGhostLayoutFromSelection(): boolean {
    const editor = editorRef.current
    const wrapper = wrapperRef.current
    if (!editor || !wrapper) {
      setGhostLayout(null)
      return false
    }

    const selectionRange = getCollapsedSelectionRange(editor)
    if (!selectionRange) {
      setGhostLayout(null)
      return false
    }

    const rect = getCollapsedCaretRect(selectionRange)
    if (!rect) {
      setGhostLayout(null)
      return false
    }

    const wrapperRect = wrapper.getBoundingClientRect()
    const editorComputed = window.getComputedStyle(editor)
    const parsedLineHeight = Number.parseFloat(editorComputed.lineHeight)
    const fallbackLineHeight = Number.isFinite(parsedLineHeight)
      ? parsedLineHeight
      : 0
    const rectHeight = toFiniteNumber(rect.height)
    const height = Math.max(rectHeight, fallbackLineHeight)
    let top = toFiniteNumber(rect.top) - toFiniteNumber(wrapperRect.top)
    if (
      fallbackLineHeight > 0 &&
      rectHeight > 0 &&
      rectHeight < fallbackLineHeight
    ) {
      // If the caret rect is glyph-sized but the line box is taller (custom
      // leading), lift the anchor to line-box top so ghost aligns with text.
      top -= (fallbackLineHeight - rectHeight) / 2
    }

    let nextLayout: GhostLayout = {
      kind: 'single-line',
      top,
      left: toFiniteNumber(rect.left) - toFiniteNumber(wrapperRect.left),
      height,
    }

    if (multiline) {
      const editorRect = editor.getBoundingClientRect()
      const borderLeft = readPixelValue(editorComputed.borderLeftWidth)
      const borderRight = readPixelValue(editorComputed.borderRightWidth)
      const paddingLeft = readPixelValue(editorComputed.paddingLeft)
      const paddingRight = readPixelValue(editorComputed.paddingRight)
      const contentLeft =
        toFiniteNumber(editorRect.left) -
        toFiniteNumber(wrapperRect.left) +
        borderLeft +
        paddingLeft
      const innerWidth =
        editor.clientWidth > 0
          ? editor.clientWidth
          : Math.max(
              0,
              toFiniteNumber(editorRect.width) - borderLeft - borderRight
            )
      const contentWidth = Math.max(0, innerWidth - paddingLeft - paddingRight)
      const contentLeftInViewport =
        toFiniteNumber(editorRect.left) + borderLeft + paddingLeft

      nextLayout = {
        kind: 'multiline',
        top,
        left: contentLeft,
        width: contentWidth,
        height,
        firstLineIndent: Math.max(
          0,
          toFiniteNumber(rect.left) - contentLeftInViewport
        ),
      }
    }

    setGhostLayout((previous) => {
      if (hasSameGhostLayout(previous, nextLayout)) {
        return previous
      }
      return nextLayout
    })

    return true
  }

  function syncGhostTypographyFromEditor(): void {
    const editor = editorRef.current
    if (!editor) return

    const computed = window.getComputedStyle(editor)
    const parsedLineHeight = Number.parseFloat(computed.lineHeight)
    const parsedFontSize = Number.parseFloat(computed.fontSize)
    const normalizedLineHeight =
      Number.isFinite(parsedLineHeight) &&
      Number.isFinite(parsedFontSize) &&
      parsedLineHeight < parsedFontSize
        ? `${parsedFontSize}px`
        : computed.lineHeight

    const nextTypography: CSSProperties = {
      fontFamily: computed.fontFamily,
      fontSize: computed.fontSize,
      fontWeight: computed.fontWeight,
      fontStyle: computed.fontStyle,
      lineHeight: normalizedLineHeight,
      letterSpacing: computed.letterSpacing,
      textTransform: computed.textTransform,
      whiteSpace: computed.whiteSpace,
      wordBreak: computed.wordBreak as CSSProperties['wordBreak'],
      overflowWrap: computed.overflowWrap as CSSProperties['overflowWrap'],
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
        previous.whiteSpace === nextTypography.whiteSpace &&
        previous.wordBreak === nextTypography.wordBreak &&
        previous.overflowWrap === nextTypography.overflowWrap
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
            setGhostLayout(null)
            return
          }

          const hasLayout = updateGhostLayoutFromSelection()
          if (!hasLayout) {
            setGhostSuggestions([])
            setGhostActiveIndex(0)
            setGhostLayout(null)
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
          setGhostLayout(null)
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
    onAcceptSuggestion()
  }

  function handleGhostKeyDown(e: KeyboardEvent<HTMLDivElement>): boolean {
    const hasVisibleGhost =
      !mentionIsOpenRef.current &&
      ghostLayout !== null &&
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
      return true
    }

    if (hasVisibleGhost && e.key === 'Escape') {
      e.preventDefault()
      clearGhostState(true)
      return true
    }

    return false
  }

  useEffect(() => {
    const activeGhostSuggestion = ghostSuggestions[ghostActiveIndex] ?? ''
    if (
      mentionIsOpenRef.current ||
      !ghostLayout ||
      ghostSuggestions.length === 0 ||
      activeGhostSuggestion.length === 0
    ) {
      return
    }

    function syncGhostLayout(): void {
      const hasLayout = updateGhostLayoutFromSelection()
      if (!hasLayout) {
        setGhostSuggestions([])
        setGhostActiveIndex(0)
        setGhostLayout(null)
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

  useEffect(() => {
    return () => {
      clearGhostDebounceTimer()
      ghostRequestIdRef.current += 1
    }
  }, [])

  return {
    ghostSuggestions,
    ghostActiveIndex,
    ghostLayout,
    ghostTypography,
    clearGhostState,
    scheduleGhostFetch,
    handleGhostKeyDown,
    acceptGhostSuggestion,
  }
}
