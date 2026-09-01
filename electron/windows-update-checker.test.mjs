import { describe, expect, it } from 'vitest'
import {
  compareWindowsVersions,
  fetchLatestWindowsRelease,
  normalizeWindowsReleaseTag,
} from './windows-update-checker.cjs'

describe('Windows update checker', () => {
  it('accepts only stable Windows release tags', () => {
    expect(normalizeWindowsReleaseTag('v0.5.5')).toBe('v0.5.5')
    expect(normalizeWindowsReleaseTag('android-v0.1.0')).toBe('')
    expect(normalizeWindowsReleaseTag('v0.5.5-beta.1')).toBe('')
  })

  it('compares Windows versions independently from Android versions', () => {
    expect(compareWindowsVersions('0.5.5', '0.5.4')).toBe(1)
    expect(compareWindowsVersions('v0.5.4', '0.5.4')).toBe(0)
    expect(() => compareWindowsVersions('android-v0.1.0', '0.5.4')).toThrow()
  })

  it('selects the newest stable Windows release with complete updater assets', async () => {
    const fetchImpl = async () => new Response(JSON.stringify([
      { tag_name: 'android-v9.0.0', draft: false, prerelease: false, assets: [{ name: 'Words-of-Yeshua-Android-9.0.0.apk' }] },
      { tag_name: 'v0.5.4', draft: false, prerelease: false, assets: [{ name: 'latest.yml' }, { name: 'Words-of-Yeshua-Setup-0.5.4.exe' }, { name: 'Words-of-Yeshua-Setup-0.5.4.exe.blockmap' }] },
      { tag_name: 'v0.5.5', draft: false, prerelease: false, assets: [{ name: 'latest.yml' }, { name: 'Words-of-Yeshua-Setup-0.5.5.exe' }, { name: 'Words-of-Yeshua-Setup-0.5.5.exe.blockmap' }] },
      { tag_name: 'v9.0.0', draft: true, prerelease: false, assets: [{ name: 'latest.yml' }, { name: 'installer.exe' }, { name: 'installer.exe.blockmap' }] },
    ]), { status: 200, headers: { 'content-length': '500' } })
    const result = await fetchLatestWindowsRelease({ fetchImpl, currentVersion: '0.5.4', now: 123 })
    expect(result.latestTag).toBe('v0.5.5')
    expect(result.updateAvailable).toBe(true)
    expect(result.feedUrl).toBe('https://github.com/mcographics/WordsofYeshua/releases/download/v0.5.5/')
    expect(result.checkedAt).toBe(123)
  })

  it('rejects a release list containing only Android or incomplete Windows releases', async () => {
    const fetchImpl = async () => new Response(JSON.stringify([
      { tag_name: 'android-v0.1.0', draft: false, prerelease: false, assets: [{ name: 'Words-of-Yeshua-Android-0.1.0.apk' }] },
      { tag_name: 'v0.5.5', draft: false, prerelease: false, assets: [{ name: 'latest.yml' }] },
    ]), { status: 200, headers: { 'content-length': '100' } })
    await expect(fetchLatestWindowsRelease({ fetchImpl, currentVersion: '0.5.4' }))
      .rejects.toThrow('No stable Windows releases with updater metadata are published yet.')
  })
})
