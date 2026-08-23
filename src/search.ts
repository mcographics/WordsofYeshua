const SEARCH_TOKEN_PATTERN = /[\p{L}\p{N}]+/gu

export function normalizeSearchText(value: string) {
  return (value.toLocaleLowerCase().match(SEARCH_TOKEN_PATTERN) ?? []).join(' ')
}

export function searchTerms(query: string) {
  const normalized = normalizeSearchText(query)
  return normalized ? normalized.split(' ') : []
}

export function matchesSearchText(candidate: string, query: string) {
  return scoreSearchText(candidate, query) !== null
}

export function scoreSearchText(candidate: string, query: string) {
  const terms = searchTerms(query)
  if (terms.length === 0) return 0
  const normalizedCandidate = normalizeSearchText(candidate)
  const normalizedQuery = terms.join(' ')
  const phrasePosition = normalizedCandidate.indexOf(normalizedQuery)
  if (phrasePosition >= 0) return 10_000 - Math.min(phrasePosition, 5_000)

  let score = 0
  for (const term of terms) {
    const termPosition = normalizedCandidate.indexOf(term)
    if (termPosition < 0) return null
    score += 100 - Math.min(termPosition, 99)
  }
  return score
}
