const { app } = require('electron')
const fs = require('node:fs')
const path = require('node:path')

function searchableText(item) {
  return [item.title, item.quote, item.reference, item.event, item.place, item.period, item.context,
    ...item.themes, ...item.people, ...item.things, ...item.sourceTopics.map((topic) => topic.topic),
    ...item.relatedReferences.map((reference) => reference.reference),
    ...item.originalTerms.flatMap((term) => [term.strong, term.lemma, term.transliteration, term.gloss])].join(' ')
}

function normalizeSearchText(value) {
  return (value.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) || []).join(' ')
}

app.whenReady().then(() => {
  try {
    const addonPath = path.join(__dirname, '..', 'native', 'build', 'Release', 'words_of_yeshua_native.node')
    const engine = require(addonPath)
    const health = engine.health()
    const matches = engine.search('love mercy', [
      'Blessed are the merciful, for they shall obtain mercy.',
      'Love your enemies and pray for those who persecute you.',
      'Love one another and walk in mercy.',
    ])
    const cataloguePath = path.join(__dirname, '..', 'data', 'words-of-yeshua', 'generated-catalogue.json')
    const catalogue = JSON.parse(fs.readFileSync(cataloguePath, 'utf8')).sayings
    const candidates = catalogue.map((item) => normalizeSearchText(searchableText(item)))
    const actualSearches = {
      exactReference: engine.search(normalizeSearchText('John 8:12'), candidates),
      actsReference: engine.search(normalizeSearchText('Acts 9:5'), candidates),
      revelationReference: engine.search(normalizeSearchText('Revelation 3:20'), candidates),
      contextualPerson: engine.search(normalizeSearchText('Lazarus'), candidates),
      multiTerm: engine.search(normalizeSearchText('love mercy'), candidates),
      strongNumber: engine.search(normalizeSearchText('G2424'), candidates),
      greekLemma: engine.search(normalizeSearchText('Ἰησοῦς'), candidates),
      noMatch: engine.search(normalizeSearchText('zzzz-no-match'), candidates),
    }
    const johnEightTwelve = catalogue.findIndex((item) => item.reference === 'John 8:12')
    const actsNineFive = catalogue.findIndex((item) => item.reference === 'Acts 9:5')
    const revelationThreeTwenty = catalogue.findIndex((item) => item.reference === 'Revelation 3:20')
    const passed = health.ok && matches.length === 1 && matches[0] === 2 &&
      actualSearches.exactReference[0] === johnEightTwelve &&
      actualSearches.actsReference[0] === actsNineFive &&
      actualSearches.revelationReference[0] === revelationThreeTwenty &&
      actualSearches.contextualPerson.length > 0 && actualSearches.multiTerm.length > 0 &&
      actualSearches.strongNumber.length > 0 && actualSearches.greekLemma.length > 0 &&
      actualSearches.noMatch.length === 0
    console.log(JSON.stringify({ health, fixtureMatches: matches, catalogueSize: catalogue.length, actualSearchCounts: Object.fromEntries(Object.entries(actualSearches).map(([key, value]) => [key, value.length])), passed }))
    app.exit(passed ? 0 : 1)
  } catch (error) {
    console.error(error)
    app.exit(1)
  }
})
