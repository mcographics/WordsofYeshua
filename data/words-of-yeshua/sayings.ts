import generatedCatalogue from './generated-catalogue.json'
import type { Category, Saying } from '../../src/types'

export const catalogueMeta = generatedCatalogue.meta
export const bibleVerses = generatedCatalogue.bibleVerses
export const sayings = generatedCatalogue.sayings as Saying[]

export const categoryValues: Record<Category, string[]> = {
  Events: [...new Set(sayings.map((item) => item.event))],
  Themes: [...new Set(sayings.flatMap((item) => item.themes))],
  People: [...new Set(sayings.flatMap((item) => item.people))],
  Places: [...new Set(sayings.map((item) => item.place))],
  Things: [...new Set(sayings.flatMap((item) => item.things))],
  Timeline: [...new Set([...sayings].sort((a, b) => a.sortOrder - b.sortOrder).map((item) => item.period))],
}
