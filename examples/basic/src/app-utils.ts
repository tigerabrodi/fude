import type { Segment } from 'fude'
import { tailwindThemes } from './app-data'

export function cloneSegments(segments: Array<Segment>): Array<Segment> {
  return segments.map((segment) =>
    segment.type === 'text'
      ? { ...segment }
      : { type: 'mention', item: { ...segment.item } }
  )
}

export function createTailwindValues(): Record<string, Array<Segment>> {
  const result: Record<string, Array<Segment>> = {}
  for (const theme of tailwindThemes) {
    result[theme.id] = cloneSegments(theme.initialValue)
  }
  return result
}

function revealWhitespace(value: string): string {
  return value
    .replace(/ /g, '<space>')
    .replace(/\n/g, '<newline>')
    .replace(/\t/g, '<tab>')
}

export function formatSegmentsForDebug(segments: Array<Segment>): string {
  return JSON.stringify(
    segments.map((segment, index) =>
      segment.type === 'text'
        ? {
            ...segment,
            segmentIndex: index,
            valueVisible: revealWhitespace(segment.value),
            valueLength: segment.value.length,
          }
        : { ...segment, segmentIndex: index }
    ),
    null,
    2
  )
}

export function formatTextSegmentLengths(segments: Array<Segment>): string {
  const lengths = segments
    .map((segment, index) =>
      segment.type === 'text' ? `#${index}:${segment.value.length}` : null
    )
    .filter((entry): entry is string => entry !== null)

  return lengths.length > 0 ? lengths.join(', ') : 'none'
}

export function formatDebugBlock(
  label: string,
  segments: Array<Segment>
): string {
  return `${label} text lengths: ${formatTextSegmentLengths(segments)}\n\n${formatSegmentsForDebug(
    segments
  )}`
}

export async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', 'true')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  document.execCommand('copy')
  textarea.remove()
}
