import type { Segment } from './types'

/**
 * Compare two segment arrays by structure.
 *
 * Used as the "guard" in the sync effect — if the current DOM already
 * represents the same value as props.value, we skip the expensive
 * clear-and-rebuild cycle and preserve the user's cursor position.
 *
 * Comparison rules:
 *  - Same length, same type at each index
 *  - TextSegments: compare `value` strings
 *  - MentionSegments: compare `item.id` only (label is ReactNode, not comparable)
 */
export function segmentsEqual(a: Array<Segment>, b: Array<Segment>): boolean {
  if (a.length !== b.length) return false

  for (let i = 0; i < a.length; i++) {
    const sa = a[i]
    const sb = b[i]

    if (sa.type !== sb.type) return false

    if (sa.type === 'text') {
      if (sa.value !== (sb as typeof sa).value) return false
    } else {
      if (sa.item.id !== (sb as typeof sa).item.id) return false
    }
  }

  return true
}
