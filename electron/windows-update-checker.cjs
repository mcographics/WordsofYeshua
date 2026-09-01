const RELEASES_API_URL = 'https://api.github.com/repos/mcographics/WordsofYeshua/releases?per_page=100'
const RELEASE_PAGE_ROOT = 'https://github.com/mcographics/WordsofYeshua/releases/tag/'
const DOWNLOAD_ROOT = 'https://github.com/mcographics/WordsofYeshua/releases/download/'
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024
const MAX_RELEASES = 100

function normalizeWindowsReleaseTag(value) {
  if (typeof value !== 'string') return ''
  const tag = value.trim()
  return /^v\d+\.\d+\.\d+$/.test(tag) && tag.length <= 80 ? tag : ''
}

function parseWindowsVersion(value) {
  const raw = String(value ?? '').trim()
  const tag = normalizeWindowsReleaseTag(raw) || normalizeWindowsReleaseTag(`v${raw}`)
  if (!tag) return null
  return { core: tag.slice(1).split('.').map(Number) }
}

function compareWindowsVersions(left, right) {
  const a = parseWindowsVersion(left)
  const b = parseWindowsVersion(right)
  if (!a || !b) throw new Error('Unable to compare an invalid Windows application version.')
  for (let index = 0; index < 3; index += 1) {
    if (a.core[index] !== b.core[index]) return a.core[index] > b.core[index] ? 1 : -1
  }
  return 0
}

function hasExpectedWindowsAssets(release) {
  if (!Array.isArray(release?.assets)) return false
  const names = release.assets.map((asset) => asset?.name).filter((name) => typeof name === 'string')
  return names.includes('latest.yml') && names.some((name) => name.toLowerCase().endsWith('.exe')) && names.some((name) => name.toLowerCase().endsWith('.blockmap'))
}

async function fetchLatestWindowsRelease({
  fetchImpl = globalThis.fetch,
  currentVersion,
  now = Date.now(),
} = {}) {
  if (typeof fetchImpl !== 'function') throw new Error('The Windows update service is unavailable.')
  if (!parseWindowsVersion(currentVersion)) throw new Error('The installed Windows application version is invalid.')

  const response = await fetchImpl(RELEASES_API_URL, {
    method: 'GET',
    redirect: 'error',
    headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
    signal: AbortSignal.timeout(12_000),
  })
  if (!response.ok) throw new Error(`GitHub returned ${response.status} while checking Windows updates.`)
  const declaredLength = Number(response.headers.get('content-length')) || 0
  if (declaredLength > MAX_RESPONSE_BYTES) throw new Error('GitHub returned an unexpectedly large Windows update response.')
  const text = await response.text()
  if (new TextEncoder().encode(text).byteLength > MAX_RESPONSE_BYTES) throw new Error('GitHub returned an unexpectedly large Windows update response.')

  let releases
  try { releases = JSON.parse(text) } catch { throw new Error('GitHub returned invalid Windows update information.') }
  if (!Array.isArray(releases) || releases.length > MAX_RELEASES) throw new Error('GitHub returned an invalid Windows release list.')

  const candidates = releases.filter((release) => {
    return Boolean(normalizeWindowsReleaseTag(release?.tag_name)) && !release?.draft && !release?.prerelease && hasExpectedWindowsAssets(release)
  })
  candidates.sort((left, right) => compareWindowsVersions(String(right.tag_name), String(left.tag_name)))

  const release = candidates[0]
  const latestTag = normalizeWindowsReleaseTag(release?.tag_name)
  if (!release || !latestTag) throw new Error('No stable Windows releases with updater metadata are published yet.')

  const latestVersion = latestTag.slice(1)
  return {
    checkedAt: now,
    currentVersion: String(currentVersion).replace(/^v/i, ''),
    latestTag,
    latestVersion,
    updateAvailable: compareWindowsVersions(latestVersion, currentVersion) > 0,
    releaseUrl: `${RELEASE_PAGE_ROOT}${encodeURIComponent(latestTag)}`,
    feedUrl: `${DOWNLOAD_ROOT}${encodeURIComponent(latestTag)}/`,
  }
}

module.exports = {
  RELEASES_API_URL,
  normalizeWindowsReleaseTag,
  compareWindowsVersions,
  hasExpectedWindowsAssets,
  fetchLatestWindowsRelease,
}
