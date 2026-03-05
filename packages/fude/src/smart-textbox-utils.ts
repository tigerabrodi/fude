import { MENTION_ID_ATTR, stripChipSentinels } from './serializer'
import type { Segment, SmartTextboxProps } from './types'

export type MentionRect = {
  top: number
  left: number
  right: number
  bottom: number
  width: number
  height: number
}

export type CharacterBeforeCaret = {
  char: string
  node: Text
  offset: number
}

export function trimTrailingNewlines(segments: Array<Segment>): Array<Segment> {
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
export function isEmpty(value: SmartTextboxProps['value']): boolean {
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

export function isRemovablePostChipArtifact(node: Node): boolean {
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

export function isPlaceholderWrapper(element: HTMLElement): boolean {
  if (!element.firstChild) return true

  for (const child of element.childNodes) {
    if (child.nodeType === Node.COMMENT_NODE) continue
    if (!isRemovablePostChipArtifact(child)) {
      return false
    }
  }

  return true
}

export function collapseBoundaryDoubleSpace(marker: Comment): void {
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

export function containsWhitespace(value: string): boolean {
  return /\s/.test(value)
}

export function startsWithWhitespace(value: string): boolean {
  if (value.length === 0) return false
  return /\s/.test(value[0] ?? '')
}

export function toFiniteNumber(value: number): number {
  if (Number.isFinite(value)) return value
  return 0
}

export function toMentionRect(rect: DOMRect): MentionRect {
  return {
    top: toFiniteNumber(rect.top),
    left: toFiniteNumber(rect.left),
    right: toFiniteNumber(rect.right),
    bottom: toFiniteNumber(rect.bottom),
    width: toFiniteNumber(rect.width),
    height: toFiniteNumber(rect.height),
  }
}

export function getRightmostEditableText(node: Node): Text | null {
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

export function getCharacterBeforeCaret(
  range: Range
): CharacterBeforeCaret | null {
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

export function toPlainTextForGhostInternal(segments: Array<Segment>): string {
  return segments
    .map((segment) =>
      segment.type === 'text' ? segment.value : segment.item.searchValue
    )
    .join('')
}

export function nodeHasVisibleContent(node: Node): boolean {
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
