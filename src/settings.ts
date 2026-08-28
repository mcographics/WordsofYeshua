export type AppTheme = 'light' | 'dark' | 'slate'
export type TextSize = 'small' | 'medium' | 'large'
export type ScriptureFont = 'classic' | 'clean'
export type ReadingWidth = 'focused' | 'comfortable' | 'wide'
export type StartPage = 'home' | 'library' | 'saved'
export type ResultsPerPage = 40 | 80 | 120
export type DisplayScale = 80 | 90 | 100 | 110 | 125 | 150
export type WindowResolution = 'auto' | '1280x720' | '1366x768' | '1600x900' | '1920x1080'

export interface AppSettings {
  theme: AppTheme
  textSize: TextSize
  scriptureFont: ScriptureFont
  readingWidth: ReadingWidth
  startPage: StartPage
  resultsPerPage: ResultsPerPage
  displayScale: DisplayScale
  windowResolution: WindowResolution
  compactCards: boolean
  showFullVerse: boolean
  showOriginalTerms: boolean
  wordsOfChristInRed: boolean
  reduceMotion: boolean
}

export const SETTINGS_STORAGE_KEY = 'woy-settings'

export const DEFAULT_APP_SETTINGS: AppSettings = Object.freeze({
  theme: 'light',
  textSize: 'medium',
  scriptureFont: 'classic',
  readingWidth: 'comfortable',
  startPage: 'home',
  resultsPerPage: 80,
  displayScale: 100,
  windowResolution: 'auto',
  compactCards: false,
  showFullVerse: true,
  showOriginalTerms: true,
  wordsOfChristInRed: true,
  reduceMotion: false,
})

const allowedValues = {
  theme: ['light', 'dark', 'slate'],
  textSize: ['small', 'medium', 'large'],
  scriptureFont: ['classic', 'clean'],
  readingWidth: ['focused', 'comfortable', 'wide'],
  startPage: ['home', 'library', 'saved'],
  resultsPerPage: [40, 80, 120],
  displayScale: [80, 90, 100, 110, 125, 150],
  windowResolution: ['auto', '1280x720', '1366x768', '1600x900', '1920x1080'],
} as const

function allowed<T>(value: unknown, values: readonly T[], fallback: T): T {
  return values.includes(value as T) ? value as T : fallback
}

function booleanValue(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback
}

function themeValue(value: unknown): AppTheme {
  if (value === 'parchment' || value === 'linen') return 'light'
  if (value === 'night') return 'dark'
  return allowed(value, allowedValues.theme, DEFAULT_APP_SETTINGS.theme)
}

export function sanitizeAppSettings(value: unknown): AppSettings {
  const source = value && typeof value === 'object' ? value as Partial<AppSettings> : {}
  return {
    theme: themeValue(source.theme),
    textSize: allowed(source.textSize, allowedValues.textSize, DEFAULT_APP_SETTINGS.textSize),
    scriptureFont: allowed(source.scriptureFont, allowedValues.scriptureFont, DEFAULT_APP_SETTINGS.scriptureFont),
    readingWidth: allowed(source.readingWidth, allowedValues.readingWidth, DEFAULT_APP_SETTINGS.readingWidth),
    startPage: allowed(source.startPage, allowedValues.startPage, DEFAULT_APP_SETTINGS.startPage),
    resultsPerPage: allowed(source.resultsPerPage, allowedValues.resultsPerPage, DEFAULT_APP_SETTINGS.resultsPerPage),
    displayScale: allowed(source.displayScale, allowedValues.displayScale, DEFAULT_APP_SETTINGS.displayScale),
    windowResolution: allowed(source.windowResolution, allowedValues.windowResolution, DEFAULT_APP_SETTINGS.windowResolution),
    compactCards: booleanValue(source.compactCards, DEFAULT_APP_SETTINGS.compactCards),
    showFullVerse: booleanValue(source.showFullVerse, DEFAULT_APP_SETTINGS.showFullVerse),
    showOriginalTerms: booleanValue(source.showOriginalTerms, DEFAULT_APP_SETTINGS.showOriginalTerms),
    wordsOfChristInRed: booleanValue(source.wordsOfChristInRed, DEFAULT_APP_SETTINGS.wordsOfChristInRed),
    reduceMotion: booleanValue(source.reduceMotion, DEFAULT_APP_SETTINGS.reduceMotion),
  }
}

export function loadAppSettings(storage: Pick<Storage, 'getItem'> = localStorage): AppSettings {
  try {
    return sanitizeAppSettings(JSON.parse(storage.getItem(SETTINGS_STORAGE_KEY) ?? 'null'))
  } catch {
    return { ...DEFAULT_APP_SETTINGS }
  }
}

export function saveAppSettings(settings: AppSettings, storage: Pick<Storage, 'setItem'> = localStorage) {
  storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(sanitizeAppSettings(settings)))
}

export function applyAppSettings(settings: AppSettings, root: HTMLElement = document.documentElement) {
  root.dataset.theme = settings.theme
  root.dataset.textSize = settings.textSize
  root.dataset.scriptureFont = settings.scriptureFont
  root.dataset.readingWidth = settings.readingWidth
  root.dataset.compactCards = String(settings.compactCards)
  root.dataset.reduceMotion = String(settings.reduceMotion)
  root.dataset.displayScale = String(settings.displayScale)
  root.dataset.windowResolution = settings.windowResolution
  root.style.setProperty('--display-scale', String(settings.displayScale / 100))
}

export function clearAppliedAppSettings(root: HTMLElement = document.documentElement) {
  delete root.dataset.theme
  delete root.dataset.textSize
  delete root.dataset.scriptureFont
  delete root.dataset.readingWidth
  delete root.dataset.compactCards
  delete root.dataset.reduceMotion
  delete root.dataset.displayScale
  delete root.dataset.windowResolution
  delete root.dataset.nativeDisplay
  root.style.removeProperty('--display-scale')
}
