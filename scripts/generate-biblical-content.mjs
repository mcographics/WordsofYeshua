import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import AdmZip from 'adm-zip'

const root = process.cwd()
const dataRoot = path.join(root, 'data')
const outputPath = path.join(dataRoot, 'words-of-yeshua', 'generated-catalogue.json')
const catalogueBooks = ['Matthew', 'Mark', 'Luke', 'John', 'Acts', 'Revelation']
const bookOrder = new Map(catalogueBooks.map((book, index) => [book, index]))
const osisToBook = { Matt: 'Matthew', Mark: 'Mark', Luke: 'Luke', John: 'John', Acts: 'Acts', Rev: 'Revelation' }
const strongFiles = { Matthew: 'Mat.json', Mark: 'Mar.json', Luke: 'Luk.json', John: 'Jhn.json', Acts: 'Act.json', Revelation: 'Rev.json' }
const strongBookKeys = { Matthew: 'Mat', Mark: 'Mar', Luke: 'Luk', John: 'Jhn', Acts: 'Act', Revelation: 'Rev' }

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

function readStrongJson(file) {
  const raw = fs.readFileSync(file, 'utf8')
  try {
    return JSON.parse(raw)
  } catch (error) {
    const repaired = raw.replaceAll('\\\\"', '\\"')
    if (repaired === raw) throw error
    return JSON.parse(repaired)
  }
}

function loadSpeakerMap(verses) {
  const sourcePath = path.join(dataRoot, 'speaker_segments', 'kjv_speaker_map.json')
  if (fs.existsSync(sourcePath)) return readJson(sourcePath)

  // The old speaker_segments folder was copied from another Bible project and
  // is not a Words of Yeshua source. When it is absent, preserve the current
  // local catalogue by rebuilding ranges from its own reviewed speech units.
  const cataloguePath = path.join(dataRoot, 'words-of-yeshua', 'generated-catalogue.json')
  if (!fs.existsSync(cataloguePath)) throw new Error(`Missing local Words of Yeshua catalogue: ${cataloguePath}`)
  const catalogue = readJson(cataloguePath)
  const divine = {}
  for (const saying of catalogue.sayings ?? []) {
    const key = `${saying.book}|${saying.chapter}|${saying.verse}`
    const source = verses.get(key)?.text ?? saying.verseText
    if (!source) continue
    const quote = String(saying.quote ?? '').trim()
    const start = quote ? source.indexOf(quote) : -1
    const ranges = divine[key] ?? []
    ranges.push(start >= 0 ? [start, start + quote.length] : [0, source.length])
    divine[key] = ranges
  }
  return { source: 'data/words-of-yeshua/generated-catalogue.json', divine }
}

function decodeXml(value) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_, decimal) => String.fromCodePoint(Number(decimal)))
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
}

function paragraphText(xml) {
  return [...xml.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g)]
    .map((match) => decodeXml(match[1]))
    .join('')
}

function cleanEvent(value, fallback) {
  const cleaned = value.replace(/\([^)]*(?:Matthew|Mark|Luke|John|Acts|Revelation)[^)]*\)\s*$/i, '').trim()
  return cleaned || fallback
}

function parseKjvDocx() {
  const zip = new AdmZip(path.join(dataRoot, 'translations', 'kjv.docx'))
  const documentXml = zip.readAsText('word/document.xml')
  const paragraphs = [...documentXml.matchAll(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g)].map((match) => paragraphText(match[0]))
  const verses = new Map()
  let book = null
  let chapter = null
  let event = ''

  for (const paragraph of paragraphs) {
    const chapterMatch = paragraph.match(/^((?:[1-3] )?[A-Za-z]+(?: [A-Za-z]+)*) (\d+)$/)
    if (chapterMatch) {
      book = catalogueBooks.includes(chapterMatch[1]) ? chapterMatch[1] : null
      chapter = Number(chapterMatch[2])
      event = book ? `${book} ${chapter}` : ''
      continue
    }
    if (!book || !chapter || !paragraph || /^KJV\s/.test(paragraph)) continue

    const markers = [...paragraph.matchAll(/(\d+)\u202f/g)]
    if (!markers.length) {
      event = cleanEvent(paragraph, `${book} ${chapter}`)
      continue
    }

    markers.forEach((marker, index) => {
      const verse = Number(marker[1])
      const start = marker.index + marker[0].length
      const end = index + 1 < markers.length ? markers[index + 1].index : paragraph.length
      const text = paragraph.slice(start, end).trim()
      verses.set(`${book}|${chapter}|${verse}`, { book, chapter, verse, text, event })
    })
  }
  return verses
}

function normalizeRanges(value) {
  if (!Array.isArray(value)) return []
  if (value.length === 2 && value.every(Number.isFinite)) return [value]
  return value.filter((range) => Array.isArray(range) && range.length === 2 && range.every(Number.isFinite))
}

function osisParts(value) {
  const match = value.match(/^([1-3]?[A-Za-z]+)\.(\d+)\.(\d+)(?:-([1-3]?[A-Za-z]+)\.(\d+)\.(\d+))?$/)
  if (!match || !osisToBook[match[1]]) return null
  return {
    book: osisToBook[match[1]], chapter: Number(match[2]), verse: Number(match[3]),
    endBook: osisToBook[match[4] ?? match[1]], endChapter: Number(match[5] ?? match[2]), endVerse: Number(match[6] ?? match[3]),
  }
}

function formatOsis(value) {
  const parsed = osisParts(value)
  if (!parsed) return value
  const start = `${parsed.book} ${parsed.chapter}:${parsed.verse}`
  if (parsed.chapter === parsed.endChapter && parsed.verse === parsed.endVerse) return start
  return parsed.chapter === parsed.endChapter ? `${start}–${parsed.endVerse}` : `${start}–${parsed.endBook} ${parsed.endChapter}:${parsed.endVerse}`
}

function buildTopicIndex(verses) {
  const topics = new Map()
  const topicPath = path.join(dataRoot, 'topic-scores', 'topic-scores.txt')
  if (!fs.existsSync(topicPath)) return topics
  const lines = fs.readFileSync(topicPath, 'utf8').split(/\r?\n/).slice(1)
  for (const line of lines) {
    if (!line) continue
    const [topic, osis, scoreText] = line.split('\t')
    const ref = osisParts(osis)
    if (!ref || ref.book !== ref.endBook) continue
    const score = Number(scoreText) || 0
    for (let chapter = ref.chapter; chapter <= ref.endChapter; chapter += 1) {
      const startVerse = chapter === ref.chapter ? ref.verse : 1
      const endVerse = chapter === ref.endChapter ? ref.endVerse : 200
      for (let verse = startVerse; verse <= endVerse; verse += 1) {
        const key = `${ref.book}|${chapter}|${verse}`
        if (!verses.has(key)) continue
        const current = topics.get(key) ?? []
        current.push({ topic, score })
        topics.set(key, current)
      }
    }
  }
  for (const [key, values] of topics) {
    const unique = [...new Map(values.sort((a, b) => b.score - a.score).map((item) => [item.topic, item])).values()]
    topics.set(key, unique.slice(0, 8))
  }
  return topics
}

function buildCrossReferenceIndex() {
  const references = new Map()
  const lines = fs.readFileSync(path.join(dataRoot, 'cross-references', 'cross_references.txt'), 'utf8').split(/\r?\n/).slice(1)
  for (const line of lines) {
    if (!line) continue
    const [from, to, votesText] = line.split('\t')
    const parsed = osisParts(from)
    if (!parsed || parsed.chapter !== parsed.endChapter || parsed.verse !== parsed.endVerse) continue
    const key = `${parsed.book}|${parsed.chapter}|${parsed.verse}`
    const current = references.get(key) ?? []
    current.push({ reference: formatOsis(to), votes: Number(votesText) || 0 })
    references.set(key, current)
  }
  for (const [key, values] of references) references.set(key, values.sort((a, b) => b.votes - a.votes).slice(0, 5))
  return references
}

function normalizeStrong(value) {
  const match = value?.match(/^([GH])(\d+)$/i)
  return match ? `${match[1].toUpperCase()}${match[2].padStart(4, '0')}` : value
}

function buildLexicalSources() {
  const alignment = readJson(path.join(dataRoot, 'strongs', 'strongs_n1904_word_alignment.json'))
  const vines = readJson(path.join(dataRoot, 'vines', 'vines_entries.json'))
  const vineByStrong = new Map()
  for (const entry of vines.entries ?? []) {
    for (const term of entry.terms ?? []) {
      const strong = normalizeStrong(term.strong)
      if (strong?.startsWith('G') && !vineByStrong.has(strong)) vineByStrong.set(strong, { title: entry.title, page: entry.page })
    }
  }
  return { alignment, vineByStrong }
}

function loadStrongVerses() {
  const result = new Map()
  for (const book of catalogueBooks) {
    const abbreviation = strongBookKeys[book]
    const data = readStrongJson(path.join(dataRoot, 'strongs', 'kjv-HG num', strongFiles[book]))[abbreviation]
    for (const chapterData of Object.values(data)) {
      for (const [key, translations] of Object.entries(chapterData)) {
        const [, chapter, verse] = key.split('|')
        result.set(`${book}|${chapter}|${verse}`, translations)
      }
    }
  }
  return result
}

function inferThemes(sourceTopics, text) {
  const source = `${sourceTopics.map((item) => item.topic).join(' ')} ${text}`.toLowerCase()
  const rules = [
    ['Kingdom of God', /kingdom|king of heaven/], ['Faith', /faith|belie|trust/], ['Prayer', /pray|prayer|ask.*father/],
    ['Love', /love|charity|neighbou?r/], ['Forgiveness', /forgiv|debt|trespass/], ['Mercy', /merc|compassion/],
    ['Discipleship', /disciple|follow me|take up.*cross/], ['Salvation', /salvation|saved|born again|eternal life/],
    ['Repentance', /repent|turn away|sin no more/], ['Judgment', /judg|condemn|hell|gehenna|woe/],
    ['Resurrection', /resurrect|rise again|raised.*dead/], ['Holy Spirit', /holy (ghost|spirit)|comforter/],
    ['Father', /\bfather\b/], ['Service', /servant|serve|least|wash.*feet/], ['Healing', /heal|whole|sick|blind|leper/],
    ['Peace', /peace|fear not|be not afraid/], ['Sabbath', /sabbath/], ['Marriage', /marriage|marry|wife|husband|divorce/],
    ['Money and Stewardship', /money|rich|treasure|mammon|talent|steward/], ['Prophecy and Fulfillment', /prophe|fulfilled|written/],
    ['Light', /\blight\b|darkness/], ['Truth', /\btruth\b|true witness/], ['Life', /\blife\b|living water/],
    ['Mission', /all nations|all the world|preach.*gospel|make disciples|be witnesses|send thee/],
    ['Return of Christ', /come quickly|i come|coming as a thief/], ['The Church', /church|churches|candlestick/],
    ['Perseverance', /overcometh|hold fast|be faithful|patience|endure/], ['Victory', /crown of life|power over the nations|morning star/],
  ]
  const themes = rules.filter(([, pattern]) => pattern.test(source)).map(([name]) => name)
  return themes.length ? themes.slice(0, 5) : ['Teaching of Jesus']
}

const peopleRules = [
  ['The disciples', /disciples?|apostles?|the twelve|the eleven/], ['The crowds', /multitude|crowd|people gathered/],
  ['Peter', /\bpeter\b|\bsimon\b/], ['James', /\bjames\b/], ['John', /\bjohn\b/], ['Andrew', /\bandrew\b/],
  ['Mary', /\bmary\b/], ['Martha', /\bmartha\b/], ['Lazarus', /\blazarus\b/], ['Thomas', /\bthomas\b/],
  ['Nicodemus', /\bnicodemus\b/], ['The Samaritan woman', /samaritan woman|woman of samaria/],
  ['Pharisees', /pharisees?/], ['Sadducees', /sadducees?/], ['Scribes', /scribes?/], ['Chief priests', /chief priests?/],
  ['A ruler', /\bruler\b/], ['A lawyer', /\blawyer\b/], ['A leper', /\bleper\b/], ['A blind person', /\bblind\b/],
  ['Pilate', /\bpilate\b/], ['Judas', /\bjudas\b/], ['Satan', /\bsatan\b|\bdevil\b|tempter/],
  ['Paul', /\bpaul\b|\bsaul\b/], ['Ananias', /\bananias\b/], ['The seven churches', /seven churches|church of|church in|churches/],
]

const placeRules = [
  ['Jerusalem', /jerusalem/], ['The temple in Jerusalem', /\btemple\b/], ['Galilee', /galilee/], ['Capernaum', /capernaum/],
  ['Nazareth', /nazareth/], ['Bethlehem', /bethlehem/], ['Bethany', /bethany/], ['Jericho', /jericho/],
  ['The Jordan region', /\bjordan\b/], ['Samaria', /samaria/], ['A synagogue', /synagogue/],
  ['The Sea of Galilee', /sea of galilee|sea of tiberias|\bsea\b.*boat/], ['Golgotha', /golgotha|calvary|the cross/],
  ['Damascus', /damascus|street which is called straight/], ['Corinth', /corinth/], ['Rome', /\brome\b/], ['Patmos', /patmos/],
]

const thingRules = [
  ['Bread', /\bbread\b|loaves/], ['Water', /\bwater\b|well/], ['Light', /\blight\b|lamp|candle/], ['Seed', /\bseed\b|sower/],
  ['A cross', /\bcross\b/], ['A cup', /\bcup\b/], ['A sword', /\bsword\b/], ['A net', /\bnets?\b|fishers?/],
  ['A boat', /\bship\b|\bboat\b/], ['A mountain', /\bmountain\b|\bmount\b/], ['A tree', /\btree\b|fig tree|vine/],
  ['Sheep', /\bsheep\b|shepherd|flock/], ['A door', /\bdoor\b|\bgate\b/], ['Money', /money|coin|penny|tribute|talent/],
  ['The Scriptures', /scripture|it is written|law and the prophets/], ['The tomb', /tomb|sepulchre/],
  ['A crown', /\bcrown\b/], ['Stars and lampstands', /stars?|candlesticks?/], ['A throne', /\bthrone\b/],
  ['A book', /\bbook\b|write/], ['Garments', /garments?|raiment|clothed/], ['Keys', /\bkeys?\b/],
]

function inferPeople(text) {
  const values = peopleRules.filter(([, pattern]) => pattern.test(text)).map(([name]) => name)
  return values.length ? values.slice(0, 5) : ['Hearers in the biblical account']
}

function inferPlace(book, chapter, verse, text) {
  const match = placeRules.find(([, pattern]) => pattern.test(text))
  if (match) return match[0]
  if (book === 'John' && chapter === 21) return 'The Sea of Tiberias in Galilee'
  if (book === 'John' && chapter === 11) return 'Bethany and the surrounding Judean region'
  if (book === 'John' && chapter >= 7 && chapter <= 10) return 'Jerusalem and the temple area'
  if (book === 'Matthew' && chapter === 28 && verse >= 16) return 'A mountain in Galilee'
  if ((book === 'Matthew' && chapter >= 21) || (book === 'Mark' && chapter >= 11) || (book === 'Luke' && chapter >= 19) || (book === 'John' && chapter >= 12)) return 'Jerusalem and its surroundings'
  if (book === 'Acts' && chapter === 1) return 'Jerusalem before the ascension'
  if (book === 'Acts' && [9, 22, 26].includes(chapter)) return text.includes('damascus') ? 'The road to Damascus and related visions' : 'A vision of the risen Christ'
  if (book === 'Acts' && chapter === 18) return 'Corinth during Paul’s ministry'
  if (book === 'Acts') return 'The apostolic mission'
  if (book === 'Revelation' && chapter === 1) return 'The vision on Patmos'
  if (book === 'Revelation' && [2, 3].includes(chapter)) return 'The seven churches of Asia'
  if (book === 'Revelation') return 'The apocalyptic vision shown to John'
  return 'Galilee and Judea'
}

function inferThings(text) {
  const values = thingRules.filter(([, pattern]) => pattern.test(text)).map(([name]) => name)
  return values.length ? values.slice(0, 5) : ['Spoken teaching']
}

function inferPeriod(book, chapter) {
  if (book === 'Matthew') return chapter <= 4 ? 'Beginning of the ministry' : chapter <= 18 ? 'Galilean ministry' : chapter <= 20 ? 'Journey toward Jerusalem' : chapter <= 25 ? 'Jerusalem ministry' : chapter <= 27 ? 'Passion and crucifixion' : 'Resurrection appearances'
  if (book === 'Mark') return chapter <= 1 ? 'Beginning of the ministry' : chapter <= 9 ? 'Galilean ministry' : chapter <= 10 ? 'Journey toward Jerusalem' : chapter <= 13 ? 'Jerusalem ministry' : chapter <= 15 ? 'Passion and crucifixion' : 'Resurrection appearances'
  if (book === 'Luke') return chapter <= 3 ? 'Early life and preparation' : chapter <= 9 ? 'Galilean ministry' : chapter <= 19 ? 'Journey toward Jerusalem' : chapter <= 21 ? 'Jerusalem ministry' : chapter <= 23 ? 'Passion and crucifixion' : 'Resurrection appearances'
  if (book === 'John') return chapter <= 4 ? 'Early Judean and Galilean ministry' : chapter <= 10 ? 'Signs and festival ministry' : chapter <= 12 ? 'Final public ministry' : chapter <= 17 ? 'Farewell teaching' : chapter <= 19 ? 'Passion and crucifixion' : 'Resurrection appearances'
  if (book === 'Acts') return chapter === 1 ? 'Ascension and apostolic commission' : [9, 22, 26].includes(chapter) ? 'Appearances to Saul and Paul' : chapter <= 18 ? 'The risen Christ guides the early mission' : 'The risen Christ strengthens apostolic witness'
  return chapter === 1 ? 'The vision of the risen Christ' : [2, 3].includes(chapter) ? 'Messages to the seven churches' : chapter === 16 ? 'The visions of judgment' : 'The promise of Christ’s return'
}

function expandIncludedReferences(specs = []) {
  const references = new Set()
  for (const spec of specs) {
    const match = spec.match(/^(Matthew|Mark|Luke|John|Acts|Revelation) (\d+):(\d+)(?:-(\d+))?$/)
    if (!match) throw new Error(`Invalid included-reference specification: ${spec}`)
    const [, book, chapter, startText, endText] = match
    const start = Number(startText)
    const end = Number(endText ?? startText)
    for (let verse = start; verse <= end; verse += 1) references.add(`${book} ${chapter}:${verse}`)
  }
  return references
}

function speechOnly(value) {
  let quote = value.trim()
  const patterns = [
    /^(?=[\s\S]{0,180}\b(?:Jesus|he|He|the Lord|The Lord)\b)[\s\S]{0,180}?\b(?:answered(?: and said)?|said|saith|say|saying|spake|cried|crieth|asked|commanded|charged|prayed)(?: [^,]{0,100})?,\s*/,
    /^(?:And |Then |But |So |Now )?Jesus [^,]{0,100}\bsaying,\s*/,
    /^From that time Jesus [^,]{0,100}\bto say,\s*/,
    /^saying,\s*/i,
  ]
  for (const pattern of patterns) quote = quote.replace(pattern, '')
  return quote.trim()
}

function clearlyNotJesusSpeech(segment, source) {
  const text = segment.trim()
  const eventAllowsNarrative = /parable|sermon|discourse|teaching|beatitudes|woes|commission/i.test(source.event)
  const jesusAttribution = /\b(?:Jesus|he|He|the Lord|The Lord)\b[\s\S]{0,150}\b(?:answered|said|saith|spake|cried|crieth|asked|commanded|charged|prayed|saying)\b[^,]{0,100},/.test(text)
  const otherAttribution = /\b(?:Peter|disciples?|Pharisees?|Sadducees?|scribes?|priests?|Pilate|governor|woman|man|multitude|people|they|devil|spirit|centurion|ruler|servant)\b[\s\S]{0,100}\b(?:answered|said|saith|cried|asked|saying)\b/i.test(text)
  if (otherAttribution && !jesusAttribution && !eventAllowsNarrative) return true
  if (eventAllowsNarrative) return false
  if (/\bJesus\b[\s\S]{0,80}\b(?:went|departed|came|saw|stood|walked|sat|entered|appeared|met|was baptized)\b/i.test(text) && !jesusAttribution) return true
  if (/^(?:And |Then |But |So |Now )?(?:he|He)\s+(?:\w+\s+){0,2}(?:went|left|departed|came|cometh|arose|took|stretched|looked|saw|stood|walked|sat|entered|sent|slept|was|charged|taught|began|laid|held|spake)\b/i.test(text) && !jesusAttribution) return true
  if (/\b(?:said|saith|say) unto (?:Jesus|him)\b/i.test(text) && !jesusAttribution) return true
  return false
}

function makeTitle(quote) {
  const phrase = quote.replace(/^['“”]+|['“”]+$/g, '').split(/[.!?;]/)[0].replace(/\s+/g, ' ').trim()
  const words = phrase.split(' ')
  return words.slice(0, 9).join(' ') + (words.length > 9 ? '…' : '')
}

function originalTermsFor(key, strongVerses, lexical) {
  const verse = strongVerses.get(key)
  if (!verse?.en) return []
  const codes = [...verse.en.matchAll(/\[(G\d+)\]/g)].map((match) => normalizeStrong(match[1]))
  const terms = []
  for (const strong of [...new Set(codes)]) {
    const source = lexical.alignment[strong]?.n1904
    if (!source || ['conjunction', 'preposition', 'particle', 'article'].includes(source.pos)) continue
    const vine = lexical.vineByStrong.get(strong)
    terms.push({
      strong, lemma: source.lemma ?? '', transliteration: source.translit ?? '', gloss: source.gloss ?? '',
      partOfSpeech: source.pos ?? '', ...(vine ? { vine } : {}),
    })
    if (terms.length === 6) break
  }
  return terms
}

function main() {
  const verses = parseKjvDocx()
  const speakerMap = loadSpeakerMap(verses)
  const overrides = readJson(path.join(dataRoot, 'words-of-yeshua', 'speaker-overrides.json'))
  const excluded = new Set(overrides.excludedReferences)
  const includedPostGospel = expandIncludedReferences(overrides.includedPostGospelReferences)
  const topics = buildTopicIndex(verses)
  const crossReferences = buildCrossReferenceIndex()
  const strongVerses = loadStrongVerses()
  const lexical = buildLexicalSources()
  const sayings = []
  const rejectedSourceSpans = []
  const coverage = Object.fromEntries(catalogueBooks.map((book) => [book, { speechVerses: 0, speechUnits: 0 }]))
  const problems = []

  const candidateKeys = new Set([...Object.keys(speakerMap.divine), ...Object.keys(overrides.quoteOverrides ?? {}).map((reference) => reference.replace(' ', '|').replace(':', '|'))])
  for (const key of candidateKeys) {
    const rawRanges = speakerMap.divine[key] ?? []
    const [book, chapterText, verseText] = key.split('|')
    if (!bookOrder.has(book)) continue
    const chapter = Number(chapterText)
    const verse = Number(verseText)
    const reference = `${book} ${chapter}:${verse}`
    if (excluded.has(reference)) continue
    if (['Acts', 'Revelation'].includes(book) && !includedPostGospel.has(reference)) continue
    const source = verses.get(key)
    if (!source) { problems.push(`Missing KJV text for ${reference}`); continue }
    const quoteOverrides = overrides.quoteOverrides?.[reference]
    const override = overrides.rangeOverrides[reference]
    const ranges = normalizeRanges(override ?? rawRanges)
    if (!quoteOverrides?.length && !ranges.length) { problems.push(`Missing valid speech range for ${reference}`); continue }
    const previous = [3, 2, 1].map((offset) => verses.get(`${book}|${chapter}|${verse - offset}`)?.text ?? '').join(' ')
    const next = verses.get(`${book}|${chapter}|${verse + 1}`)?.text ?? ''
    const contextText = `${source.event} ${previous} ${source.text} ${next}`.toLowerCase()
    const sourceTopics = topics.get(key) ?? []

    const speechSegments = quoteOverrides ?? ranges.map(([start, end]) => {
      if (start < 0 || end > source.text.length || start >= end) {
        problems.push(`Out-of-bounds range ${start}-${end} for ${reference} (${source.text.length})`)
        return ''
      }
      return source.text.slice(start, end)
    })

    let generatedForVerse = 0
    speechSegments.forEach((segment, index) => {
      if (!quoteOverrides && clearlyNotJesusSpeech(segment, source)) { rejectedSourceSpans.push({ reference, reason: 'clearly non-Jesus narration or speech' }); return }
      const quote = quoteOverrides ? segment.trim() : speechOnly(segment)
      if (!quote) { rejectedSourceSpans.push({ reference, reason: 'speech introduction with no words in this verse' }); return }
      const id = `${book.toLowerCase()}-${chapter}-${verse}-${index + 1}`
      const people = inferPeople(contextText)
      const event = source.event || `${book} ${chapter}`
      sayings.push({
        id, title: makeTitle(quote), quote, verseText: source.text, reference, book, chapter, verse,
        event, themes: inferThemes(sourceTopics, `${quote} ${event}`), people,
        place: inferPlace(book, chapter, verse, contextText), things: inferThings(contextText), period: inferPeriod(book, chapter),
        context: `At ${reference}, the biblical account records these words of Jesus during “${event}.” The surrounding account identifies the audience and circumstances shown below.`,
        sourceTopics: sourceTopics.slice(0, 5), relatedReferences: crossReferences.get(key) ?? [],
        originalTerms: originalTermsFor(key, strongVerses, lexical),
        sortOrder: bookOrder.get(book) * 1_000_000 + chapter * 10_000 + verse * 10 + index,
      })
      generatedForVerse += 1
      coverage[book].speechUnits += 1
    })
    if (generatedForVerse) coverage[book].speechVerses += 1
  }

  sayings.sort((a, b) => a.sortOrder - b.sortOrder)
  const ids = new Set(sayings.map((item) => item.id))
  if (ids.size !== sayings.length) problems.push('Duplicate generated IDs')
  const minimumCoverage = { Matthew: 600, Mark: 250, Luke: 600, John: 450, Acts: 20, Revelation: 55 }
  for (const book of catalogueBooks) if (coverage[book].speechUnits < minimumCoverage[book]) problems.push(`Unexpectedly low ${book} coverage: ${coverage[book].speechUnits}`)
  if (problems.length) throw new Error(`Biblical content generation failed:\n- ${problems.slice(0, 30).join('\n- ')}${problems.length > 30 ? `\n- …and ${problems.length - 30} more` : ''}`)

  const output = {
    meta: {
      baseTranslation: 'King James Version', abbreviation: 'KJV', scope: 'Words attributed to Jesus in Matthew, Mark, Luke, John, Acts, and Revelation',
      speechUnits: sayings.length, speechVerses: Object.values(coverage).reduce((sum, item) => sum + item.speechVerses, 0), coverage,
      sourceDivineVerseCandidates: Object.keys(speakerMap.divine).filter((key) => catalogueBooks.includes(key.split('|')[0])).length,
      rejectedNonSpeechSpans: rejectedSourceSpans.length, documentedExcludedReferences: excluded.size,
      documentedPostGospelInclusions: includedPostGospel.size,
      sources: [
        'data/translations/kjv.docx', 'data/words-of-yeshua/generated-catalogue.json',
        'data/topic-scores/topic-scores.txt', 'data/cross-references/cross_references.txt',
        'data/strongs/kjv-HG num/*.json', 'data/strongs/strongs_n1904_word_alignment.json', 'data/vines/vines_entries.json',
      ],
      reviewStatus: 'Generated from local source data; speaker overrides are documented and the catalogue still requires human editorial review.',
    },
    sayings,
    // Keep the complete local KJV passage available to the reader. The saying
    // catalogue is intentionally selective, but chapter mode must not be.
    bibleVerses: [...verses.values()].filter((verse) => catalogueBooks.includes(verse.book)),
  }
  fs.writeFileSync(outputPath, `${JSON.stringify(output)}\n`)
  console.log(`Generated ${sayings.length} speech units from ${output.meta.speechVerses} New Testament verses.`)
  for (const [book, result] of Object.entries(coverage)) console.log(`${book}: ${result.speechUnits} units across ${result.speechVerses} verses`)
}

main()
