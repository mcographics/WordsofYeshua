import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft, ArrowRight, Bookmark, BookOpen, CalendarDays, ChevronRight, CircleUserRound,
  Compass, Eye, FileText, Gauge, Heart, Home, Languages, Landmark, LayoutGrid, MapPin, Menu,
  Minus, Moon, RotateCcw, Search, Settings, Sparkles, Sun, Tag, Type, UsersRound, X,
} from 'lucide-react'
import brandLogo from '../Assets/logo.png'
import { bibleVerses, catalogueMeta, categoryValues, sayings } from '../data/words-of-yeshua/sayings'
import type { Category, Saying } from './types'
import { normalizeSearchText, scoreSearchText } from './search'
import {
  applyAppSettings, clearAppliedAppSettings, DEFAULT_APP_SETTINGS, loadAppSettings, saveAppSettings,
} from './settings'
import type { AppSettings, ResultsPerPage, StartPage } from './settings'

type View = 'home' | 'library' | 'saved' | 'settings'

const categoryMeta: Record<Category, { note: string; icon: typeof CalendarDays; color: string }> = {
  Events: { note: 'What happened', icon: CalendarDays, color: 'clay' },
  Themes: { note: 'What he taught', icon: Sparkles, color: 'gold' },
  People: { note: 'Who was there', icon: UsersRound, color: 'sage' },
  Places: { note: 'Where it happened', icon: MapPin, color: 'blue' },
  Things: { note: 'Objects & symbols', icon: Tag, color: 'rose' },
  Timeline: { note: 'When it happened', icon: Compass, color: 'sand' },
}
const categories = Object.keys(categoryMeta) as Category[]

function searchableText(item: Saying) {
  return [item.title, item.quote, item.reference, item.event, item.place, item.period, item.context,
    ...item.themes, ...item.people, ...item.things, ...item.sourceTopics.map((topic) => topic.topic),
    ...item.relatedReferences.map((reference) => reference.reference),
    ...item.originalTerms.flatMap((term) => [term.strong, term.lemma, term.transliteration, term.gloss])].join(' ')
}

const searchCandidates = sayings.map((item) => normalizeSearchText(searchableText(item)))
const searchCandidateById = new Map(sayings.map((item, index) => [item.id, searchCandidates[index]]))

function useSavedSayings() {
  const [saved, setSaved] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('woy-saved') ?? '[]') as string[] } catch { return [] }
  })
  useEffect(() => localStorage.setItem('woy-saved', JSON.stringify(saved)), [saved])
  const toggle = (id: string) => setSaved((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  return { saved, toggle }
}

function matchesCategory(item: Saying, category: Category, value: string) {
  if (category === 'Events') return item.event === value
  if (category === 'Themes') return item.themes.includes(value)
  if (category === 'People') return item.people.includes(value)
  if (category === 'Places') return item.place === value
  if (category === 'Things') return item.things.includes(value)
  return item.period === value
}

export default function App() {
  const [settings, setSettings] = useState<AppSettings>(loadAppSettings)
  const [view, setView] = useState<View>(() => settings.startPage)
  const [search, setSearch] = useState('')
  const [activeBook, setActiveBook] = useState('All')
  const [activeCategory, setActiveCategory] = useState<Category | null>(null)
  const [activeValue, setActiveValue] = useState<string | null>(null)
  const [selected, setSelected] = useState<Saying | null>(null)
  const [chapter, setChapter] = useState<{ book: Saying['book']; number: number } | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchPending, setSearchPending] = useState(false)
  const [nativeMatches, setNativeMatches] = useState<{ query: string; ids: string[] } | null>(null)
  const { saved, toggle } = useSavedSayings()

  useEffect(() => {
    saveAppSettings(settings)
    applyAppSettings(settings)
    return () => clearAppliedAppSettings()
  }, [settings])

  const updateSetting = <Key extends keyof AppSettings,>(key: Key, value: AppSettings[Key]) => {
    setSettings((current) => ({ ...current, [key]: value }))
  }

  useEffect(() => {
    const bridge = window.wordsOfYeshua
    const query = normalizeSearchText(search)
    if (!bridge || !query) { setNativeMatches(null); setSearchPending(false); return }
    let cancelled = false
    setSearchPending(true)
    const timer = window.setTimeout(() => {
      bridge.searchBiblicalContent(query, searchCandidates)
        .then((indices) => {
          if (cancelled) return
          const ids = indices.filter((index) => Number.isInteger(index) && index >= 0 && index < sayings.length).map((index) => sayings[index].id)
          setNativeMatches({ query, ids })
          setSearchPending(false)
        })
        .catch(() => {
          if (cancelled) return
          setNativeMatches(null)
          setSearchPending(false)
        })
    }, 120)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [search])

  const filtered = useMemo(() => {
    const query = normalizeSearchText(search)
    const nativeRanks = nativeMatches?.query === query
      ? new Map(nativeMatches.ids.map((id, index) => [id, index]))
      : null
    const fallbackScores = query && !nativeRanks
      ? new Map(sayings.map((item) => [item.id, scoreSearchText(searchCandidateById.get(item.id) ?? '', query)]))
      : null
    return sayings
      .filter((item) => view !== 'saved' || saved.includes(item.id))
      .filter((item) => activeBook === 'All' || item.book === activeBook)
      .filter((item) => !activeCategory || !activeValue || matchesCategory(item, activeCategory, activeValue))
      .filter((item) => {
        if (!query) return true
        if (nativeRanks) return nativeRanks.has(item.id)
        return fallbackScores?.get(item.id) !== null
      })
      .sort((a, b) => {
        if (nativeRanks) return (nativeRanks.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (nativeRanks.get(b.id) ?? Number.MAX_SAFE_INTEGER)
        if (fallbackScores) {
          const scoreDifference = (fallbackScores.get(b.id) ?? 0) - (fallbackScores.get(a.id) ?? 0)
          if (scoreDifference !== 0) return scoreDifference
        }
        return a.sortOrder - b.sortOrder
      })
  }, [activeBook, activeCategory, activeValue, nativeMatches, saved, search, view])

  const clearFilters = () => { setSearch(''); setActiveBook('All'); setActiveCategory(null); setActiveValue(null) }
  const navigate = (next: View) => {
    setView(next); setMenuOpen(false); setSelected(null); setChapter(null)
    if (next === 'home') clearFilters()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const browseCategory = (category: Category, value?: string) => {
    setView('library'); setActiveCategory(category); setActiveValue(value ?? null); setSearch('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="app-shell">
      <Header view={view} count={saved.length} menuOpen={menuOpen} setMenuOpen={setMenuOpen} navigate={navigate} />
      <main>
        {view === 'home' ? (
          <HomeView onBrowse={() => navigate('library')} onCategory={browseCategory} onOpen={setSelected} saved={saved} toggle={toggle} />
        ) : view === 'settings' ? (
          <SettingsView settings={settings} updateSetting={updateSetting} resetSettings={() => setSettings({ ...DEFAULT_APP_SETTINGS })} />
        ) : (
          <LibraryView
            view={view} search={search} setSearch={setSearch} activeBook={activeBook} setActiveBook={setActiveBook}
            activeCategory={activeCategory} setActiveCategory={(category) => { setActiveCategory(category); setActiveValue(null) }}
            activeValue={activeValue} setActiveValue={setActiveValue} results={filtered} saved={saved} toggle={toggle}
            onOpen={setSelected} onClear={clearFilters} onBrowse={() => navigate('library')} searchPending={searchPending}
            resultsPerPage={settings.resultsPerPage}
          />
        )}
      </main>
      <MobileNav view={view} count={saved.length} navigate={navigate} />
      {chapter && <ChapterReader book={chapter.book} chapter={chapter.number} onClose={() => setChapter(null)} onOpenSaying={setSelected} onNavigate={(next) => setChapter(next)} wordsOfChristInRed={settings.wordsOfChristInRed} />}
      {selected && <DetailSheet saying={selected} saved={saved.includes(selected.id)} onToggle={() => toggle(selected.id)} onClose={() => setSelected(null)} settings={settings}
        onReadChapter={() => { setSelected(null); setChapter({ book: selected.book, number: selected.chapter }) }}
        onTag={(category, value) => { setSelected(null); browseCategory(category, value) }} />}
    </div>
  )
}

function Header({ view, count, menuOpen, setMenuOpen, navigate }: {
  view: View; count: number; menuOpen: boolean; setMenuOpen: (open: boolean) => void; navigate: (view: View) => void
}) {
  return (
    <header className="site-header">
      <button className="brand" onClick={() => navigate('home')} aria-label="Words of Yeshua home">
        <span className="brand-mark"><img src={brandLogo} alt="" /></span>
        <span><strong>Words of</strong><em>Yeshua</em></span>
      </button>
      <div className="header-actions">
        <nav className="desktop-nav" aria-label="Main navigation">
          {(['home', 'library', 'saved', 'settings'] as View[]).map((item) => <button key={item} className={view === item ? 'active' : ''} onClick={() => navigate(item)}>
            {item === 'library' ? 'Explore' : item[0].toUpperCase() + item.slice(1)}{item === 'saved' && count > 0 && <span>{count}</span>}
          </button>)}
        </nav>
        {window.wordsOfYeshua?.runtime === 'electron' && <div className="window-controls" aria-label="Window controls">
          <button type="button" onClick={() => window.wordsOfYeshua?.minimizeWindow()} aria-label="Minimize window"><Minus size={17} strokeWidth={2.2} /></button>
          <button type="button" className="window-close" onClick={() => window.wordsOfYeshua?.closeWindow()} aria-label="Close window"><X size={16} strokeWidth={2.2} /></button>
        </div>}
        <button className="menu-button" onClick={() => setMenuOpen(!menuOpen)} aria-expanded={menuOpen} aria-label="Open navigation">{menuOpen ? <X /> : <Menu />}</button>
      </div>
      {menuOpen && <div className="menu-popover">
        <button onClick={() => navigate('home')}>Home</button><button onClick={() => navigate('library')}>Explore</button><button onClick={() => navigate('saved')}>Saved <span>{count}</span></button><button onClick={() => navigate('settings')}>Settings</button>
      </div>}
    </header>
  )
}

function HomeView({ onBrowse, onCategory, onOpen, saved, toggle }: {
  onBrowse: () => void; onCategory: (category: Category, value?: string) => void; onOpen: (item: Saying) => void; saved: string[]; toggle: (id: string) => void
}) {
  const featured = sayings.find((item) => item.id === 'john-8-12-1') ?? sayings[0]
  const timelineIds = ['matthew-4-19-1', 'john-13-34-1', 'acts-1-8-1', 'revelation-22-20-1']
  const timeline = timelineIds.map((id) => sayings.find((item) => item.id === id)).filter((item): item is Saying => Boolean(item))
  return <>
    <section className="hero section-wrap">
      <div className="hero-copy">
        <span className="eyebrow"><span /> The words. The moment. The meaning.</span>
        <h1>Walk through the<br /><em>words of Yeshua.</em></h1>
        <p>Explore the recorded words of Jesus—from his earthly ministry to the risen Christ’s guidance and promised return—organized by event, theme, person, place, and time.</p>
        <button className="primary-button" onClick={onBrowse}>Begin exploring <ArrowRight size={18} /></button>
        <div className="source-note"><BookOpen size={15} /> {catalogueMeta.abbreviation} · Read in scriptural context</div>
      </div>
      <div className="hero-art" aria-hidden="true">
        <div className="sun" /><div className="arch arch-one" /><div className="arch arch-two" />
        <div className="horizon hill-one" /><div className="horizon hill-two" /><div className="path" /><div className="figure"><span /><i /></div>
        <div className="art-caption"><span>Explore the story</span><strong>From Galilee<br />to the New Jerusalem</strong></div>
      </div>
    </section>

    <section className="browse-section section-wrap">
      <SectionHeading eyebrow="Find your way in" title="Explore by category" action="View all" onClick={onBrowse} />
      <div className="category-grid">{categories.map((category) => {
        const meta = categoryMeta[category]; const Icon = meta.icon
        return <button key={category} className={`category-card ${meta.color}`} onClick={() => onCategory(category)}>
          <span className="category-icon"><Icon size={23} strokeWidth={1.7} /></span><span><strong>{category}</strong><small>{meta.note}</small></span><ChevronRight size={18} />
        </button>
      })}</div>
    </section>

    <section className="featured-section"><div className="section-wrap featured-wrap">
      <div className="featured-heading"><span>✦</span><span className="eyebrow">Featured words</span><span className="rule" /></div>
      <blockquote>“{featured.quote}”</blockquote><p className="featured-reference">— {featured.reference}</p>
      <div className="featured-actions"><button className="light-button" onClick={() => onOpen(featured)}>Read in context <ArrowRight size={17} /></button>
        <button className={`round-button ${saved.includes(featured.id) ? 'is-saved' : ''}`} onClick={() => toggle(featured.id)} aria-label={saved.includes(featured.id) ? 'Remove from saved' : 'Save saying'}>
          <Bookmark size={18} fill={saved.includes(featured.id) ? 'currentColor' : 'none'} /></button></div>
    </div></section>

    <section className="journey-section section-wrap">
      <SectionHeading eyebrow="Follow the journey" title="Along the timeline" action="Full timeline" onClick={() => onCategory('Timeline')} />
      <div className="timeline-track">{timeline.map((item, index) => <button key={item.id} className="timeline-stop" onClick={() => onOpen(item)}>
        <span className="timeline-number">{String(index + 1).padStart(2, '0')}</span><span className="timeline-dot" />
        <span className="timeline-copy"><small>{item.period}</small><strong>{item.title}</strong><em>{item.place}</em></span>
      </button>)}</div>
    </section>
    <footer><div className="section-wrap footer-inner"><div><span className="brand-mark"><img src={brandLogo} alt="" /></span><strong>Words of Yeshua</strong></div>
      <p>A Christ-centered Bible reader for exploring the words of Yeshua in their scriptural context.</p></div></footer>
  </>
}

function SectionHeading({ eyebrow, title, action, onClick }: { eyebrow: string; title: string; action: string; onClick: () => void }) {
  return <div className="section-heading"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2></div>
    <button className="text-button" onClick={onClick}>{action} <ArrowRight size={16} /></button></div>
}

type UpdateSetting = <Key extends keyof AppSettings>(key: Key, value: AppSettings[Key]) => void
type SettingOption = { value: string | number; label: string; note?: string; icon?: typeof Sun }

function SettingsView({ settings, updateSetting, resetSettings }: {
  settings: AppSettings; updateSetting: UpdateSetting; resetSettings: () => void
}) {
  const [resetNotice, setResetNotice] = useState(false)
  const reset = () => {
    resetSettings()
    setResetNotice(true)
  }

  return <section className="settings-view section-wrap">
    <div className="settings-intro"><span className="eyebrow">Make it your own</span><h1>Settings</h1>
      <p>Shape a comfortable place to read and study. Every preference stays on this device—no account or connection required.</p></div>
    <div className="local-settings-note"><span><Settings size={19} /></span><div><strong>Private and device-local</strong><p>These choices are saved only in Words of Yeshua on this device. Bookmarks are kept separate and are never removed by resetting settings.</p></div></div>

    <div className="settings-groups">
      <SettingsGroup icon={Type} title="Appearance" description="Choose the paper, type size, and Scripture typeface that feel best to you.">
        <SegmentedSetting label="Color theme" description="White, black, and gold with restrained blue-grey supporting tones." value={settings.theme}
          options={[{ value: 'light', label: 'Light', icon: Sun }, { value: 'dark', label: 'Dark', icon: Moon }, { value: 'slate', label: 'Slate', icon: FileText }]}
          onChange={(value) => updateSetting('theme', value as AppSettings['theme'])} />
        <SegmentedSetting label="Text size" description="Adjusts passages and supporting reading text." value={settings.textSize}
          options={[{ value: 'small', label: 'Small' }, { value: 'medium', label: 'Medium' }, { value: 'large', label: 'Large' }]}
          onChange={(value) => updateSetting('textSize', value as AppSettings['textSize'])} />
        <SegmentedSetting label="Scripture typeface" description="Classic keeps the book-like serif; Clean uses a modern face." value={settings.scriptureFont}
          options={[{ value: 'classic', label: 'Classic' }, { value: 'clean', label: 'Clean' }]}
          onChange={(value) => updateSetting('scriptureFont', value as AppSettings['scriptureFont'])} />
      </SettingsGroup>

      <SettingsGroup icon={LayoutGrid} title="Reading layout" description="Control how much content appears at once without changing the biblical data.">
        <SegmentedSetting label="Reading width" description="Sets the width of the passage context panel." value={settings.readingWidth}
          options={[{ value: 'focused', label: 'Focused' }, { value: 'comfortable', label: 'Comfortable' }, { value: 'wide', label: 'Wide' }]}
          onChange={(value) => updateSetting('readingWidth', value as AppSettings['readingWidth'])} />
        <SegmentedSetting label="Results per page" description="Choose how many passage cards Search and Explore initially show." value={settings.resultsPerPage}
          options={[{ value: 40, label: '40' }, { value: 80, label: '80' }, { value: 120, label: '120' }]}
          onChange={(value) => updateSetting('resultsPerPage', value as ResultsPerPage)} />
        <SettingSwitch icon={Gauge} label="Compact passage cards" description="Shows shorter cards so more results fit on screen." checked={settings.compactCards}
          onChange={(checked) => updateSetting('compactCards', checked)} />
      </SettingsGroup>

      <SettingsGroup icon={Languages} title="Study details" description="Decide how much supporting material is shown in a passage’s context panel.">
        <SettingSwitch icon={FileText} label="Show complete verse" description="Includes the full KJV verse alongside the isolated words of Jesus." checked={settings.showFullVerse}
          onChange={(checked) => updateSetting('showFullVerse', checked)} />
        <SettingSwitch icon={Eye} label="Show Greek and Strong’s" description="Includes original-language lemmas, transliterations, glosses, and Vine’s links." checked={settings.showOriginalTerms}
          onChange={(checked) => updateSetting('showOriginalTerms', checked)} />
        <SettingSwitch icon={Sparkles} label="Words of Christ in red" description="Uses a restrained red accent for Words of Yeshua passages in Read Chapter Mode." checked={settings.wordsOfChristInRed}
          onChange={(checked) => updateSetting('wordsOfChristInRed', checked)} />
      </SettingsGroup>

      <SettingsGroup icon={Gauge} title="Comfort and startup" description="Reduce movement and choose where the app opens next time.">
        <SettingSwitch icon={Gauge} label="Reduce animation" description="Minimizes panel, hover, and scrolling motion throughout the interface." checked={settings.reduceMotion}
          onChange={(checked) => updateSetting('reduceMotion', checked)} />
        <SegmentedSetting label="Open the app to" description="This choice takes effect the next time Words of Yeshua starts." value={settings.startPage}
          options={[{ value: 'home', label: 'Home' }, { value: 'library', label: 'Explore' }, { value: 'saved', label: 'Saved' }]}
          onChange={(value) => updateSetting('startPage', value as StartPage)} />
      </SettingsGroup>
    </div>

    <div className="settings-reset"><div><strong>Restore the original experience</strong><p>Resets only the preferences on this screen. Your saved passages remain untouched.</p></div>
      <button className="outline-button" onClick={reset}><RotateCcw size={16} /> Reset settings</button></div>
    <p className="settings-confirmation" aria-live="polite">{resetNotice ? 'Settings restored to their defaults. Saved passages were not changed.' : ''}</p>
  </section>
}

function SettingsGroup({ icon: Icon, title, description, children }: {
  icon: typeof Settings; title: string; description: string; children: React.ReactNode
}) {
  return <section className="settings-group"><div className="settings-group-heading"><span><Icon size={20} /></span><div><h2>{title}</h2><p>{description}</p></div></div><div className="settings-rows">{children}</div></section>
}

function SegmentedSetting({ label, description, value, options, onChange }: {
  label: string; description: string; value: string | number; options: SettingOption[]; onChange: (value: string | number) => void
}) {
  return <div className="setting-row"><div className="setting-copy"><strong>{label}</strong><p>{description}</p></div>
    <div className="setting-options" aria-label={label}>{options.map((option) => {
      const Icon = option.icon
      return <button key={option.value} className={value === option.value ? 'active' : ''} aria-pressed={value === option.value} onClick={() => onChange(option.value)}>
        {Icon && <Icon size={15} />}<span>{option.label}</span>{option.note && <small>{option.note}</small>}
      </button>
    })}</div></div>
}

function SettingSwitch({ icon: Icon, label, description, checked, onChange }: {
  icon: typeof Settings; label: string; description: string; checked: boolean; onChange: (checked: boolean) => void
}) {
  return <div className="setting-row switch-row"><div className="setting-copy with-icon"><span><Icon size={17} /></span><div><strong>{label}</strong><p>{description}</p></div></div>
    <button className="setting-switch" type="button" role="switch" aria-label={label} aria-checked={checked} onClick={() => onChange(!checked)}><span /></button></div>
}

interface LibraryProps {
  view: View; search: string; setSearch: (value: string) => void; activeBook: string; setActiveBook: (value: string) => void;
  activeCategory: Category | null; setActiveCategory: (value: Category | null) => void; activeValue: string | null;
  setActiveValue: (value: string | null) => void; results: Saying[]; saved: string[]; toggle: (id: string) => void;
  onOpen: (item: Saying) => void; onClear: () => void; onBrowse: () => void; searchPending: boolean; resultsPerPage: ResultsPerPage
}

function LibraryView({ view, search, setSearch, activeBook, setActiveBook, activeCategory, setActiveCategory, activeValue,
  setActiveValue, results, saved, toggle, onOpen, onClear, onBrowse, searchPending, resultsPerPage }: LibraryProps) {
  const [visibleCount, setVisibleCount] = useState<number>(resultsPerPage)
  useEffect(() => setVisibleCount(resultsPerPage), [view, search, activeBook, activeCategory, activeValue, resultsPerPage])
  if (view === 'saved' && saved.length === 0) return <section className="empty-state section-wrap">
    <span className="empty-icon"><Bookmark size={34} /></span><span className="eyebrow">Your collection</span><h1>Keep meaningful words close.</h1>
    <p>Tap the bookmark on any saying to save it here on this device.</p><button className="primary-button" onClick={onBrowse}>Explore the words <ArrowRight size={18} /></button>
  </section>
  const hasFilters = Boolean(search || activeCategory || activeBook !== 'All')
  return <section className="library section-wrap">
    <div className="library-intro"><span className="eyebrow">{view === 'saved' ? 'Your collection' : 'Six New Testament books'}</span>
      <h1>{view === 'saved' ? 'Your saved words' : 'Explore the words'}</h1><p>Search a phrase or narrow the collection by its book and setting.</p></div>
    <label className="search-field"><Search size={20} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search words, people, places…" />
      {search && <button onClick={() => setSearch('')} aria-label="Clear search"><X size={17} /></button>}</label>
    <FilterRow label="Book">{['All', 'Matthew', 'Mark', 'Luke', 'John', 'Acts', 'Revelation'].map((book) => <button key={book} className={activeBook === book ? 'chip active' : 'chip'} onClick={() => setActiveBook(book)}>{book}</button>)}</FilterRow>
    <FilterRow label="Browse by">{categories.map((category) => <button key={category} className={activeCategory === category ? 'chip active' : 'chip'}
      onClick={() => setActiveCategory(activeCategory === category ? null : category)}>{category}</button>)}</FilterRow>
    {activeCategory && <div className="value-filter"><button className={!activeValue ? 'value-pill active' : 'value-pill'} onClick={() => setActiveValue(null)}>All {activeCategory.toLowerCase()}</button>
      {categoryValues[activeCategory].map((value) => <button key={value} className={activeValue === value ? 'value-pill active' : 'value-pill'} onClick={() => setActiveValue(value)}>{value}</button>)}</div>}
    <div className="results-heading" aria-live="polite"><span><strong>{results.length}</strong> {results.length === 1 ? 'passage' : 'passages'}{searchPending && <small> · Searching…</small>}</span>
      {hasFilters && <button onClick={onClear}>Clear filters <X size={14} /></button>}</div>
    {results.length ? <><div className="results-grid">{results.slice(0, visibleCount).map((item) => <SayingCard key={item.id} item={item} saved={saved.includes(item.id)} toggle={() => toggle(item.id)} open={() => onOpen(item)} />)}</div>
      {visibleCount < results.length && <div className="load-more"><button className="outline-button" onClick={() => setVisibleCount((count) => count + resultsPerPage)}>Load {resultsPerPage} more passages</button><span>{Math.min(visibleCount, results.length)} of {results.length} shown</span></div>}</>
      : <div className="no-results"><Search size={28} /><h2>No matching words found</h2><p>Try a wider search or clear the current filters.</p><button className="outline-button" onClick={onClear}>Clear all filters</button></div>}
  </section>
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="filter-group"><span className="filter-label">{label}</span><div className="chip-row">{children}</div></div>
}

function SayingCard({ item, saved, toggle, open }: { item: Saying; saved: boolean; toggle: () => void; open: () => void }) {
  return <article className="saying-card"><div className="card-topline"><span>{item.event}</span><button onClick={toggle} aria-label={saved ? 'Remove from saved' : 'Save saying'}><Bookmark size={18} fill={saved ? 'currentColor' : 'none'} /></button></div>
    <button className="card-body" onClick={open}><h2>{item.title}</h2><blockquote>“{item.quote}”</blockquote><strong>{item.reference}</strong><p>{item.context}</p>
      <span className="read-link">Read in context <ArrowRight size={15} /></span></button>
    <div className="card-tags"><span><MapPin size={13} /> {item.place}</span><span><Tag size={13} /> {item.themes[0]}</span></div></article>
}

function DetailSheet({ saying, saved, onToggle, onClose, onTag, onReadChapter, settings }: { saying: Saying; saved: boolean; onToggle: () => void; onClose: () => void; onTag: (category: Category, value: string) => void; onReadChapter: () => void; settings: AppSettings }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey); document.body.classList.add('sheet-open')
    return () => { document.removeEventListener('keydown', onKey); document.body.classList.remove('sheet-open') }
  }, [onClose])
  return <div className="sheet-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <article className="detail-sheet" role="dialog" aria-modal="true" aria-labelledby="detail-title"><div className="sheet-handle" />
      <div className="sheet-header"><button className="sheet-close" onClick={onClose} aria-label="Close"><ArrowLeft size={21} /></button><span>Words in context</span>
        <button className={saved ? 'sheet-save saved' : 'sheet-save'} onClick={onToggle} aria-label={saved ? 'Remove from saved' : 'Save saying'}><Bookmark size={20} fill={saved ? 'currentColor' : 'none'} /></button></div>
      <div className="detail-hero"><span className="eyebrow">{saying.event}</span><h1 id="detail-title">{saying.title}</h1><blockquote>“{saying.quote}”</blockquote><strong>{saying.reference} · {catalogueMeta.abbreviation}</strong></div>
      <div className="detail-content"><section><span className="detail-label">What was happening</span><p>{saying.context}</p></section>
        {settings.showFullVerse && <section className="verse-context"><span className="detail-label">Complete verse</span><p>{saying.verseText}</p></section>}
        <div className="detail-facts"><DetailFact icon={MapPin} label="Place" values={[saying.place]} click={(v) => onTag('Places', v)} />
          <DetailFact icon={CircleUserRound} label="People" values={saying.people} click={(v) => onTag('People', v)} />
          <DetailFact icon={CalendarDays} label="When" values={[saying.period]} click={(v) => onTag('Timeline', v)} />
          <DetailFact icon={Landmark} label="Things" values={saying.things} click={(v) => onTag('Things', v)} /></div>
        <section><span className="detail-label">Themes</span><div className="detail-tags">{saying.themes.map((theme) => <button key={theme} onClick={() => onTag('Themes', theme)}>{theme}</button>)}</div></section>
        {settings.showOriginalTerms && saying.originalTerms.length > 0 && <section><span className="detail-label">Greek and Strong’s connections</span><div className="lexical-grid">{saying.originalTerms.map((term) => <div key={term.strong}><strong>{term.lemma || term.transliteration}</strong><small>{term.strong} · {term.transliteration}</small><p>{term.gloss}</p>{term.vine && <em>Vine’s: {term.vine.title}, p. {term.vine.page}</em>}</div>)}</div></section>}
        {saying.sourceTopics.length > 0 && <section><span className="detail-label">Local topic matches</span><div className="source-links">{saying.sourceTopics.map((topic) => <span key={topic.topic}>{topic.topic} · {topic.score}</span>)}</div></section>}
        {saying.relatedReferences.length > 0 && <section><span className="detail-label">Cross-references</span><div className="source-links">{saying.relatedReferences.map((related) => <span key={related.reference}>{related.reference} · {related.votes} votes</span>)}</div></section>}
        <button className="chapter-mode-button" onClick={onReadChapter}><BookOpen size={18} /><span><strong>Read Chapter Mode</strong><small>Read the locally catalogued words from {saying.book} {saying.chapter} in sequence.</small></span><ArrowRight size={17} /></button>
        <div className="translation-note"><BookOpen size={18} /><p><strong>Source note</strong> Quotation and complete verse text are from the local King James Version dataset. Speech boundaries, event headings, topics, cross-references, and lexical connections are generated from the reviewed local source files and documented corrections.</p></div>
      </div>
    </article>
  </div>
}

function ChapterReader({ book, chapter, onClose, onOpenSaying, onNavigate, wordsOfChristInRed }: { book: Saying['book']; chapter: number; onClose: () => void; onOpenSaying: (saying: Saying) => void; onNavigate: (chapter: { book: Saying['book']; number: number }) => void; wordsOfChristInRed: boolean }) {
  const chapters = [...new Set(sayings.map((item) => `${item.book}|${item.chapter}`))].map((key) => { const [chapterBook, chapterNumber] = key.split('|'); return { book: chapterBook as Saying['book'], number: Number(chapterNumber) } }).sort((a, b) => sayings.find((item) => item.book === a.book && item.chapter === a.number)!.sortOrder - sayings.find((item) => item.book === b.book && item.chapter === b.number)!.sortOrder)
  const index = chapters.findIndex((item) => item.book === book && item.number === chapter)
  const current = chapters[index]
  const entries = bibleVerses.filter((item) => item.book === book && item.chapter === chapter).sort((a, b) => a.verse - b.verse)
  const speechByVerse = new Map(sayings.filter((item) => item.book === book && item.chapter === chapter).map((item) => [item.verse, item]))
  return <div className="chapter-backdrop"><article className="chapter-reader" role="dialog" aria-modal="true" aria-labelledby="chapter-title">
    <header className="chapter-header"><button className="sheet-close" onClick={onClose} aria-label="Close chapter reader"><ArrowLeft size={21} /></button><span>Read Chapter Mode</span><button className="sheet-close" onClick={onClose} aria-label="Close"><X size={19} /></button></header>
    <div className="chapter-intro"><span className="eyebrow">Complete chapter · KJV</span><h1 id="chapter-title">{current.book} <em>{current.number}</em></h1><p>Read the complete chapter from the local King James Version. Words of Yeshua passages are marked within the chapter and can be opened for their full study context.</p></div>
    <main className="chapter-content"><div className="chapter-bible-text">{entries.map((item) => { const saying = speechByVerse.get(item.verse); return <span className={saying ? 'bible-verse speech-verse' : 'bible-verse'} key={`${item.book}-${item.chapter}-${item.verse}`}><sup>{item.verse}</sup>{saying ? <button className={wordsOfChristInRed ? 'bible-speech red-words' : 'bible-speech'} onClick={() => onOpenSaying(saying)} title={`Open study context for ${saying.reference}`}>{item.text}</button> : item.text} </span> })}</div><p className="chapter-reader-note">Highlighted words open their full study context.</p></main>
    <footer className="chapter-footer"><button className="outline-button" disabled={index <= 0} onClick={() => { const previous = chapters[index - 1]; if (previous) onNavigate(previous) }}>Previous chapter</button><span>{index + 1} of {chapters.length} catalogued chapters</span><button className="outline-button" disabled={index < 0 || index >= chapters.length - 1} onClick={() => { const next = chapters[index + 1]; if (next) onNavigate(next) }}>Next chapter</button></footer>
  </article></div>
}

function DetailFact({ icon: Icon, label, values, click }: { icon: typeof MapPin; label: string; values: string[]; click: (value: string) => void }) {
  return <div className="detail-fact"><span className="fact-icon"><Icon size={18} /></span><div><small>{label}</small>{values.map((value) => <button key={value} onClick={() => click(value)}>{value}</button>)}</div></div>
}

function MobileNav({ view, count, navigate }: { view: View; count: number; navigate: (view: View) => void }) {
  return <nav className="mobile-nav" aria-label="Mobile navigation">
    <button className={view === 'home' ? 'active' : ''} onClick={() => navigate('home')}><Home size={20} /><span>Home</span></button>
    <button className={view === 'library' ? 'active' : ''} onClick={() => navigate('library')}><Search size={20} /><span>Explore</span></button>
    <button className={view === 'saved' ? 'active' : ''} onClick={() => navigate('saved')}><span className="nav-icon"><Heart size={20} />{count > 0 && <i>{count}</i>}</span><span>Saved</span></button>
    <button className={view === 'settings' ? 'active' : ''} onClick={() => navigate('settings')}><Settings size={20} /><span>Settings</span></button>
  </nav>
}
