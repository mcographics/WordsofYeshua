import { describe, expect, it } from 'vitest'
import { matchesSearchText, normalizeSearchText, scoreSearchText, searchTerms } from './search'

describe('search helpers', () => {
  it('normalizes punctuation, case, references, and Unicode text', () => {
    expect(normalizeSearchText('  JOHN 8:12 — ἸΗΣΟΥΣ  ')).toBe('john 8 12 ἰησους')
  })

  it('requires all query terms without requiring an exact phrase', () => {
    const candidate = 'Mercy follows wherever love is shown.'
    expect(matchesSearchText(candidate, 'love mercy')).toBe(true)
    expect(matchesSearchText(candidate, 'love Lazarus')).toBe(false)
  })

  it('treats punctuation-only input as an empty search', () => {
    expect(searchTerms(' — … ')).toEqual([])
    expect(matchesSearchText('anything', ' — … ')).toBe(true)
  })

  it('ranks an exact phrase ahead of separated terms', () => {
    expect(scoreSearchText('John 8:12', 'John 8:12')).toBeGreaterThan(scoreSearchText('John spoke in chapter 8 and verse 12', 'John 8:12') ?? 0)
  })
})
