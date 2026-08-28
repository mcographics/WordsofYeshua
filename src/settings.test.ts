import { afterEach, describe, expect, it } from 'vitest'
import {
  applyAppSettings, clearAppliedAppSettings, DEFAULT_APP_SETTINGS, loadAppSettings, sanitizeAppSettings,
  saveAppSettings, SETTINGS_STORAGE_KEY,
} from './settings'

describe('app settings', () => {
  afterEach(() => {
    localStorage.clear()
    clearAppliedAppSettings()
  })

  it('sanitizes invalid and incomplete stored preferences', () => {
    expect(sanitizeAppSettings({ theme: 'unknown', textSize: 'large', compactCards: true, resultsPerPage: 999 })).toEqual({
      ...DEFAULT_APP_SETTINGS,
      textSize: 'large',
      compactCards: true,
    })
  })

  it('persists and reloads device-local preferences', () => {
    const settings = { ...DEFAULT_APP_SETTINGS, theme: 'dark' as const, resultsPerPage: 40 as const, reduceMotion: true }
    saveAppSettings(settings)

    expect(loadAppSettings()).toEqual(settings)
    expect(JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) ?? '{}')).toMatchObject({ theme: 'dark', resultsPerPage: 40, reduceMotion: true })
  })

  it('recovers from malformed local storage', () => {
    localStorage.setItem(SETTINGS_STORAGE_KEY, '{broken')
    expect(loadAppSettings()).toEqual(DEFAULT_APP_SETTINGS)
  })

  it('applies display preferences to the document root', () => {
    applyAppSettings({ ...DEFAULT_APP_SETTINGS, theme: 'slate', textSize: 'large', scriptureFont: 'clean', readingWidth: 'wide', compactCards: true, reduceMotion: true })
    expect(document.documentElement.dataset).toMatchObject({
      theme: 'slate', textSize: 'large', scriptureFont: 'clean', readingWidth: 'wide', compactCards: 'true', reduceMotion: 'true',
    })
  })

  it('migrates the previous warm theme names to the new palette', () => {
    expect(sanitizeAppSettings({ theme: 'parchment' }).theme).toBe('light')
    expect(sanitizeAppSettings({ theme: 'linen' }).theme).toBe('light')
    expect(sanitizeAppSettings({ theme: 'night' }).theme).toBe('dark')
  })

  it('sanitizes display scale and window resolution preferences', () => {
    expect(sanitizeAppSettings({ displayScale: 125, windowResolution: '1600x900' })).toMatchObject({
      displayScale: 125, windowResolution: '1600x900',
    })
    expect(sanitizeAppSettings({ displayScale: 999, windowResolution: '640x480' })).toMatchObject({
      displayScale: 100, windowResolution: 'auto',
    })
  })
})
