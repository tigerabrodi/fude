import type { Segment } from './types'

/**
 * Collapse whitespace-only segment arrays to empty.
 *
 * After serialization, the DOM may contain browser artifacts (like a lone
 * `<br>` cursor placeholder) that produce whitespace-only text segments.
 * This normalizes such output to an empty array, keeping the serializer
 * honest about what the DOM contains while presenting a clean value to
 * consumers.
 */
export function normalizeSegments(
  segments: Array<Segment>
): Array<Segment> {
  if (
    segments.length === 1 &&
    segments[0].type === 'text' &&
    segments[0].value.trim() === ''
  ) {
    return []
  }
  return segments
}
