import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const root = process.cwd()
const file = path.join(root, 'data', 'words-of-yeshua', 'generated-catalogue.json')
const catalogue = JSON.parse(fs.readFileSync(file, 'utf8'))
const errors = []
const books = new Set(['Matthew', 'Mark', 'Luke', 'John', 'Acts', 'Revelation'])
const ids = new Set()

if (catalogue.meta.baseTranslation !== 'King James Version') errors.push('Base translation is not documented as KJV')
if (catalogue.sayings.length < 2_150) errors.push(`Catalogue is unexpectedly small: ${catalogue.sayings.length}`)
if (catalogue.meta.speechUnits !== catalogue.sayings.length) errors.push('Metadata speech-unit count does not match catalogue')

for (const item of catalogue.sayings) {
  if (ids.has(item.id)) errors.push(`Duplicate ID: ${item.id}`)
  ids.add(item.id)
  if (!books.has(item.book)) errors.push(`Unknown book: ${item.book}`)
  if (!new RegExp(`^${item.book} \\d+:\\d+$`).test(item.reference)) errors.push(`Malformed reference: ${item.reference}`)
  for (const field of ['title', 'quote', 'verseText', 'event', 'place', 'period', 'context']) if (!item[field]?.trim()) errors.push(`${item.reference} has an empty ${field}`)
  for (const field of ['themes', 'people', 'things', 'sourceTopics', 'relatedReferences', 'originalTerms']) if (!Array.isArray(item[field])) errors.push(`${item.reference} has invalid ${field}`)
}

const byReference = new Map()
for (const item of catalogue.sayings) {
  const values = byReference.get(item.reference) ?? []
  values.push(item.quote)
  byReference.set(item.reference, values)
}

const required = new Map([
  ['Matthew 4:19', 'Follow me, and I will make you fishers of men.'],
  ['Matthew 5:3', 'Blessed [are] the poor in spirit: for theirs is the kingdom of heaven.'],
  ['John 8:12', 'I am the light of the world:'],
  ['John 11:25', 'I am the resurrection, and the life:'],
  ['Matthew 28:19', 'Go ye therefore, and teach all nations'],
  ['John 21:22', 'If I will that he tarry till I come'],
  ['Acts 1:8', 'ye shall be witnesses unto me'],
  ['Acts 9:5', 'I am Jesus whom thou persecutest'],
  ['Acts 20:35', 'It is more blessed to give than to receive.'],
  ['Revelation 1:18', 'I am alive for evermore'],
  ['Revelation 2:4', 'thou hast left thy first love'],
  ['Revelation 3:20', 'Behold, I stand at the door, and knock'],
  ['Revelation 16:15', 'Behold, I come as a thief.'],
  ['Revelation 22:16', 'I Jesus have sent mine angel'],
  ['Revelation 22:20', 'Surely I come quickly.'],
])
for (const [reference, excerpt] of required) {
  if (!(byReference.get(reference) ?? []).some((quote) => quote.includes(excerpt))) errors.push(`Required saying is missing or malformed: ${reference}`)
}

for (const reference of [
  'Matthew 15:21', 'Matthew 15:29', 'Mark 4:38', 'Mark 8:24', 'Matthew 26:65',
  'Acts 7:59', 'Acts 13:2', 'Revelation 1:8', 'Revelation 10:4', 'Revelation 14:13', 'Revelation 19:5',
]) {
  if (byReference.has(reference)) errors.push(`Known non-Jesus speech or narration leaked into catalogue: ${reference}`)
}

for (const [book, minimum] of Object.entries({ Acts: 26, Revelation: 62 })) {
  if ((catalogue.meta.coverage?.[book]?.speechUnits ?? 0) < minimum) errors.push(`${book} coverage is unexpectedly low`)
}
if (catalogue.meta.documentedPostGospelInclusions !== 88) errors.push('Reviewed Acts and Revelation inclusion count is not 88')

if (errors.length) {
  console.error(`Biblical content validation failed with ${errors.length} issue(s):`)
  for (const error of errors.slice(0, 50)) console.error(`- ${error}`)
  process.exitCode = 1
} else {
  console.log(`Validated ${catalogue.sayings.length} speech units across ${catalogue.meta.speechVerses} New Testament verses.`)
  console.log(`Source candidates: ${catalogue.meta.sourceDivineVerseCandidates}; rejected non-speech spans: ${catalogue.meta.rejectedNonSpeechSpans}; documented exclusions: ${catalogue.meta.documentedExcludedReferences}; reviewed Acts/Revelation inclusions: ${catalogue.meta.documentedPostGospelInclusions}.`)
}
