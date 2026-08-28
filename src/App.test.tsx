import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { DEFAULT_APP_SETTINGS, SETTINGS_STORAGE_KEY } from './settings'
import { sayings } from '../data/words-of-yeshua/sayings'

describe('Words of Yeshua', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => {
    cleanup()
    delete window.wordsOfYeshua
  })

  it('keeps implementation details out of the reader interface', () => {
    render(<App />)

    expect(document.body).not.toHaveTextContent(/C\+\+ search ready|safe search fallback|browser preview|locally generated speech units|datasets/i)
    expect(screen.getByText(/KJV · Read in scriptural context/i)).toBeInTheDocument()
  })

  it('opens a saying and shows its structured context', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /read in context/i }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('Jerusalem and the temple area')).toBeInTheDocument()
    expect(within(dialog).getByText('Signs and festival ministry')).toBeInTheDocument()
    expect(within(dialog).getAllByText(/I am the light of the world/i).length).toBeGreaterThan(0)
  })

  it('searches across contextual metadata', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /begin exploring/i }))
    fireEvent.change(screen.getByPlaceholderText(/search words/i), { target: { value: 'Lazarus' } })
    expect(document.querySelectorAll('.saying-card').length).toBeGreaterThan(0)
    expect(document.querySelector('.results-heading strong')).not.toHaveTextContent('0')
  })

  it('matches every word in a multi-word search even when the words are separated', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /begin exploring/i }))
    fireEvent.change(screen.getByPlaceholderText(/search words/i), { target: { value: 'love mercy' } })

    expect(document.querySelectorAll('.saying-card').length).toBeGreaterThan(0)
    for (const card of document.querySelectorAll('.saying-card')) {
      const text = card.textContent?.toLocaleLowerCase() ?? ''
      expect(text).toMatch(/love|mercy/)
    }
  })

  it('searches Strong numbers and Greek lemmas from the local Bible data', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /begin exploring/i }))
    const searchInput = screen.getByPlaceholderText(/search words/i)
    fireEvent.change(searchInput, { target: { value: 'G2424' } })
    expect(document.querySelectorAll('.saying-card').length).toBeGreaterThan(0)
    fireEvent.change(searchInput, { target: { value: 'Ἰησοῦς' } })
    expect(document.querySelectorAll('.saying-card').length).toBeGreaterThan(0)
  })

  it('shows no results and the clear-search control restores the catalogue', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /begin exploring/i }))
    fireEvent.change(screen.getByPlaceholderText(/search words/i), { target: { value: 'zzzz-no-match' } })
    expect(document.querySelector('.results-heading')).toHaveTextContent('0 passages')
    fireEvent.click(screen.getByRole('button', { name: /clear search/i }))
    expect(document.querySelector('.results-heading')).toHaveTextContent(`${sayings.length} passages`)
  })

  it('puts an exact Bible reference first in the results', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /begin exploring/i }))
    fireEvent.change(screen.getByPlaceholderText(/search words/i), { target: { value: 'John 8:12' } })
    expect(document.querySelector('.saying-card .card-body > strong')).toHaveTextContent('John 8:12')
  })

  it('searches the words of Jesus in Acts and Revelation by exact reference', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /begin exploring/i }))
    const searchInput = screen.getByPlaceholderText(/search words/i)

    fireEvent.change(searchInput, { target: { value: 'Acts 9:5' } })
    expect(document.querySelector('.saying-card .card-body > strong')).toHaveTextContent('Acts 9:5')
    expect(screen.getAllByText(/I am Jesus whom thou persecutest/i).length).toBeGreaterThan(0)

    fireEvent.change(searchInput, { target: { value: 'Revelation 3:20' } })
    expect(document.querySelector('.saying-card .card-body > strong')).toHaveTextContent('Revelation 3:20')
    expect(screen.getAllByText(/Behold, I stand at the door, and knock/i).length).toBeGreaterThan(0)
  })

  it('filters the catalogue to Acts and Revelation', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /begin exploring/i }))

    fireEvent.click(screen.getByRole('button', { name: 'Acts' }))
    expect(document.querySelector('.results-heading')).toHaveTextContent('26 passages')
    for (const reference of document.querySelectorAll('.saying-card .card-body > strong')) expect(reference).toHaveTextContent(/^Acts /)

    fireEvent.click(screen.getByRole('button', { name: 'Revelation' }))
    expect(document.querySelector('.results-heading')).toHaveTextContent('62 passages')
    for (const reference of document.querySelectorAll('.saying-card .card-body > strong')) expect(reference).toHaveTextContent(/^Revelation /)
  })

  it('saves a saying locally and displays it in the saved collection', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Save saying' }))
    fireEvent.click(screen.getAllByRole('button', { name: /saved 1/i })[0])
    expect(screen.getAllByText(/I am the light of the world/i).length).toBeGreaterThan(0)
    expect(JSON.parse(localStorage.getItem('woy-saved') ?? '[]')).toContain('john-8-12-1')
  })

  it('combines book and theme filters', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /begin exploring/i }))
    fireEvent.click(screen.getByRole('button', { name: 'John' }))
    fireEvent.click(screen.getByRole('button', { name: 'Themes' }))
    fireEvent.click(screen.getByRole('button', { name: 'Love' }))

    expect(screen.getAllByText(/That ye love one another; as I have loved you/i).length).toBeGreaterThan(0)
    expect(document.querySelector('.results-heading')).toHaveTextContent(/passages?/)
  })

  it('opens a category from the home screen', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /places where it happened/i }))

    expect(screen.getByRole('button', { name: 'Places' })).toHaveClass('active')
    expect(screen.getByRole('button', { name: /all places/i })).toBeInTheDocument()
  })

  it('hands search ranking to the Electron native bridge', async () => {
    const searchBiblicalContent = vi.fn().mockResolvedValue([0])
    window.wordsOfYeshua = {
      runtime: 'electron',
      getNativeHealth: vi.fn().mockResolvedValue({ ok: true, engine: 'words-of-yeshua-native' }),
      searchBiblicalContent,
      minimizeWindow: vi.fn(),
      closeWindow: vi.fn(),
    }

    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /begin exploring/i }))
    fireEvent.change(screen.getByPlaceholderText(/search words/i), { target: { value: 'native-only-query' } })

    expect((await screen.findAllByText(/Suffer \[it to be so\] now/i)).length).toBeGreaterThan(0)
    expect(searchBiblicalContent).toHaveBeenCalledOnce()
    const [query, candidates] = searchBiblicalContent.mock.calls[0] as [string, string[]]
    expect(query).toBe('native only query')
    expect(candidates[0]).toContain('suffer it to be so now')
  })

  it('connects the frameless window controls to the Electron bridge', () => {
    const minimizeWindow = vi.fn()
    const closeWindow = vi.fn()
    window.wordsOfYeshua = {
      runtime: 'electron',
      getNativeHealth: vi.fn().mockResolvedValue({ ok: true, engine: 'words-of-yeshua-native' }),
      searchBiblicalContent: vi.fn().mockResolvedValue([]),
      minimizeWindow,
      closeWindow,
    }

    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /minimize window/i }))
    fireEvent.click(screen.getByRole('button', { name: /close window/i }))

    expect(minimizeWindow).toHaveBeenCalledOnce()
    expect(closeWindow).toHaveBeenCalledOnce()
  })

  it('applies and persists appearance settings immediately', () => {
    render(<App />)
    fireEvent.click(screen.getAllByRole('button', { name: 'Settings' })[0])
    fireEvent.click(screen.getByRole('button', { name: 'Dark' }))
    fireEvent.click(screen.getByRole('button', { name: 'Large' }))
    fireEvent.click(screen.getByRole('button', { name: 'Clean' }))
    fireEvent.click(screen.getByRole('button', { name: 'Wide' }))
    fireEvent.click(screen.getByRole('switch', { name: /compact passage cards/i }))
    fireEvent.click(screen.getByRole('switch', { name: /reduce animation/i }))

    expect(document.documentElement.dataset).toMatchObject({
      theme: 'dark', textSize: 'large', scriptureFont: 'clean', readingWidth: 'wide', compactCards: 'true', reduceMotion: 'true',
    })
    expect(JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) ?? '{}')).toMatchObject({ theme: 'dark', textSize: 'large', compactCards: true, reduceMotion: true })
  })

  it('applies and persists display scale and window resolution settings', () => {
    render(<App />)
    fireEvent.click(screen.getAllByRole('button', { name: 'Settings' })[0])
    fireEvent.click(screen.getByRole('button', { name: '125%' }))
    fireEvent.click(screen.getByRole('button', { name: '1600 × 900' }))

    expect(document.documentElement.dataset).toMatchObject({ displayScale: '125', windowResolution: '1600x900' })
    expect(document.documentElement.style.getPropertyValue('--display-scale')).toBe('1.25')
    expect(JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) ?? '{}')).toMatchObject({ displayScale: 125, windowResolution: '1600x900' })
  })

  it('can hide full-verse and original-language study sections', () => {
    render(<App />)
    fireEvent.click(screen.getAllByRole('button', { name: 'Settings' })[0])
    fireEvent.click(screen.getByRole('switch', { name: /show complete verse/i }))
    fireEvent.click(screen.getByRole('switch', { name: /show Greek and Strong’s/i }))
    fireEvent.click(screen.getAllByRole('button', { name: 'Home' })[0])
    fireEvent.click(screen.getByRole('button', { name: /read in context/i }))

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).queryByText('Complete verse')).not.toBeInTheDocument()
    expect(within(dialog).queryByText('Greek and Strong’s connections')).not.toBeInTheDocument()
  })

  it('uses the selected result-page size when exploring', () => {
    render(<App />)
    fireEvent.click(screen.getAllByRole('button', { name: 'Settings' })[0])
    fireEvent.click(screen.getByRole('button', { name: '40' }))
    fireEvent.click(screen.getAllByRole('button', { name: 'Explore' })[0])

    expect(document.querySelectorAll('.saying-card')).toHaveLength(40)
    fireEvent.click(screen.getByRole('button', { name: /load 40 more passages/i }))
    expect(document.querySelectorAll('.saying-card')).toHaveLength(80)
  })

  it('opens on the saved start page when selected', () => {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ ...DEFAULT_APP_SETTINGS, startPage: 'saved' }))
    localStorage.setItem('woy-saved', JSON.stringify(['john-8-12-1']))
    render(<App />)

    expect(screen.getByRole('heading', { name: 'Your saved words' })).toBeInTheDocument()
    expect(screen.getAllByText(/I am the light of the world/i).length).toBeGreaterThan(0)
  })

  it('resets settings without removing saved passages', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Save saying' }))
    fireEvent.click(screen.getAllByRole('button', { name: 'Settings' })[0])
    fireEvent.click(screen.getByRole('button', { name: 'Dark' }))
    fireEvent.click(screen.getByRole('button', { name: /reset settings/i }))

    expect(JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) ?? '{}')).toEqual(DEFAULT_APP_SETTINGS)
    expect(JSON.parse(localStorage.getItem('woy-saved') ?? '[]')).toContain('john-8-12-1')
    expect(screen.getByText(/settings restored to their defaults/i)).toBeInTheDocument()
  })
})
