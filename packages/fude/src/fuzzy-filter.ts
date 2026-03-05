import type { MentionItem } from './types'

type MatchScore = {
  item: MentionItem
  score: number
  index: number
}

function getSubsequenceScore(query: string, candidate: string): number | null {
  let candidateCursor = 0
  let firstIndex = -1
  let previousIndex = -1
  let gapPenalty = 0

  for (let i = 0; i < query.length; i++) {
    const char = query[i]
    const foundIndex = candidate.indexOf(char, candidateCursor)
    if (foundIndex === -1) return null

    if (firstIndex === -1) {
      firstIndex = foundIndex
    }

    if (previousIndex !== -1) {
      gapPenalty += foundIndex - previousIndex - 1
    }

    previousIndex = foundIndex
    candidateCursor = foundIndex + 1
  }

  const span = previousIndex - firstIndex + 1
  const lengthPenalty = candidate.length - query.length

  return firstIndex * 3 + gapPenalty * 2 + span + lengthPenalty * 0.01
}

/**
 * Fuzzy filter mention items by searchValue.
 *
 * Rules:
 * - Empty/whitespace query returns all items in original order.
 * - Case-insensitive matching.
 * - Prefer direct substring matches, then subsequence matches.
 * - Stable ordering for ties (original input order).
 */
export function fuzzyFilter<TItem extends MentionItem>(
  query: string,
  items: Array<TItem>
): Array<TItem> {
  const normalizedQuery = query.trim().toLowerCase()
  if (normalizedQuery.length === 0) return items.slice()

  const matches: Array<MatchScore> = []

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const candidate = item.searchValue.toLowerCase()

    const directIndex = candidate.indexOf(normalizedQuery)
    if (directIndex !== -1) {
      const directScore =
        directIndex * 2 + (candidate.length - normalizedQuery.length) * 0.01
      matches.push({ item, score: directScore, index: i })
      continue
    }

    const subsequenceScore = getSubsequenceScore(normalizedQuery, candidate)
    if (subsequenceScore !== null) {
      // Penalize non-contiguous matches so direct includes always win.
      matches.push({ item, score: 100 + subsequenceScore, index: i })
    }
  }

  matches.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score
    return a.index - b.index
  })

  return matches.map((entry) => entry.item as TItem)
}
