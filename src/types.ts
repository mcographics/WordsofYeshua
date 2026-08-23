export type Category = 'Events' | 'Themes' | 'People' | 'Places' | 'Things' | 'Timeline'
export type BiblicalBook = 'Matthew' | 'Mark' | 'Luke' | 'John' | 'Acts' | 'Revelation'

export interface Saying {
  id: string
  title: string
  quote: string
  reference: string
  book: BiblicalBook
  chapter: number
  verse: number
  verseText: string
  event: string
  themes: string[]
  people: string[]
  place: string
  things: string[]
  period: string
  context: string
  sourceTopics: Array<{ topic: string; score: number }>
  relatedReferences: Array<{ reference: string; votes: number }>
  originalTerms: Array<{
    strong: string
    lemma: string
    transliteration: string
    gloss: string
    partOfSpeech: string
    vine?: { title: string; page: number }
  }>
  sortOrder: number
}

export interface BibleVerse {
  book: BiblicalBook
  chapter: number
  verse: number
  text: string
  event: string
}
