import { describe, expect, it } from 'vitest'
import { compareAndroidVersions, fetchLatestAndroidRelease, normalizeAndroidReleaseTag } from './mobile-update-checker'

describe('Android update checker', () => {
  it('accepts only the independent Android release tag format', () => {
    expect(normalizeAndroidReleaseTag('android-v0.1.1')).toBe('android-v0.1.1')
    expect(normalizeAndroidReleaseTag('v0.5.5')).toBe('')
    expect(normalizeAndroidReleaseTag('android-v0.1')).toBe('')
  })

  it('compares Android versions independently from the Windows version', () => {
    expect(compareAndroidVersions('0.2.0', '0.1.9')).toBe(1)
    expect(compareAndroidVersions('android-v0.1.0', '0.1.0')).toBe(0)
    expect(compareAndroidVersions('0.1.0-beta.1', '0.1.0')).toBe(-1)
  })

  it('selects the newest stable release and its exact APK asset', async () => {
    const fetchImpl = async () => new Response(JSON.stringify([
      { tag_name: 'android-v0.1.0', draft: false, prerelease: false, assets: [{ name: 'Words-of-Yeshua-Android-0.1.0.apk', size: 100, digest: 'sha256:' + '1'.repeat(64) }] },
      { tag_name: 'android-v0.2.0', draft: false, prerelease: false, assets: [{ name: 'Words-of-Yeshua-Android-0.2.0.apk', size: 200, digest: 'sha256:' + '2'.repeat(64) }] },
      { tag_name: 'android-v9.0.0', draft: true, prerelease: false, assets: [{ name: 'Words-of-Yeshua-Android-9.0.0.apk', size: 900 }] },
    ]), { status: 200, headers: { 'content-length': '500' } })
    const result = await fetchLatestAndroidRelease({ fetchImpl, currentVersion: '0.1.0', now: 123 })
    expect(result.latestTag).toBe('android-v0.2.0')
    expect(result.updateAvailable).toBe(true)
    expect(result.apkUrl).toBe('https://github.com/mcographics/WordsofYeshua/releases/download/android-v0.2.0/Words-of-Yeshua-Android-0.2.0.apk')
    expect(result.apkSha256).toBe('2'.repeat(64))
    expect(result.checkedAt).toBe(123)
  })

  it('reports when no stable Android release has been published', async () => {
    const fetchImpl = async () => new Response(JSON.stringify([
      { tag_name: 'v0.5.4', draft: false, prerelease: false, assets: [] },
    ]), { status: 200, headers: { 'content-length': '100' } })
    await expect(fetchLatestAndroidRelease({ fetchImpl, currentVersion: '0.1.0' }))
      .rejects.toThrow('No stable Android releases are published yet.')
  })
})
