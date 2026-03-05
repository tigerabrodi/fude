import type { Segment } from './types'

/**
 * Convert segment arrays into plain text for storage/search/LLM prompts.
 * Mention segments are represented by their `searchValue`.
 */
export function getPlainText(segments: Array<Segment>): string {
  let plain = ''

  for (const segment of segments) {
    if (segment.type === 'text') {
      plain += segment.value
    } else {
      plain += segment.item.searchValue
    }
  }

  return plain
}
