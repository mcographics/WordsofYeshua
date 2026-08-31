import { App as CapacitorApp } from '@capacitor/app'
import { Browser } from '@capacitor/browser'
import { Capacitor, registerPlugin } from '@capacitor/core'
import { normalizeSearchText } from './search'
import { fetchLatestAndroidRelease } from './mobile-update-checker'

interface AndroidUpdaterPlugin {
  downloadAndInstall(options: { downloadUrl: string; version: string }): Promise<{ started: boolean; version: string }>
  addListener(eventName: 'downloadProgress', listener: (progress: { percent?: number; transferred?: number; total?: number; bytesPerSecond?: number }) => void): Promise<{ remove: () => Promise<void> }>
}

const isNativeAndroid = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'

if (isNativeAndroid && !window.wordsOfYeshua) {
  const AndroidUpdater = registerPlugin<AndroidUpdaterPlugin>('AndroidUpdater')
  const listeners = new Set<(state: UpdateState) => void>()
  let currentState: UpdateState = {
    phase: 'idle', message: 'Ready to check for an Android update.', currentVersion: '', availableVersion: null,
    percent: 0, transferred: 0, total: 0, bytesPerSecond: 0,
  }
  let currentRelease: Awaited<ReturnType<typeof fetchLatestAndroidRelease>> | null = null
  let operation: Promise<UpdateState> | null = null

  const emit = (next: Partial<UpdateState>) => {
    currentState = { ...currentState, ...next }
    listeners.forEach((listener) => listener(currentState))
    return currentState
  }

  const getCurrentVersion = async () => (await CapacitorApp.getInfo()).version

  const checkForUpdates = async () => {
    if (operation) return operation
    operation = (async () => {
      const version = await getCurrentVersion()
      emit({ phase: 'checking', message: 'Checking GitHub for the latest Android release…', currentVersion: version, availableVersion: null, percent: null, transferred: 0, total: 0, bytesPerSecond: 0 })
      try {
        currentRelease = await fetchLatestAndroidRelease({ fetchImpl: window.fetch.bind(window), currentVersion: version })
        return emit(currentRelease.updateAvailable
          ? { phase: 'available', message: `Android version ${currentRelease.latestVersion} is available.`, currentVersion: version, availableVersion: currentRelease.latestVersion, percent: 0 }
          : { phase: 'current', message: `You already have the latest Android version (v${version}).`, currentVersion: version, availableVersion: null, percent: 100 })
      } catch (error) {
        currentRelease = null
        return emit({ phase: 'error', message: `Android update check failed: ${error instanceof Error ? error.message : String(error)}`, currentVersion: version, availableVersion: null, percent: 0 })
      } finally {
        operation = null
      }
    })()
    return operation
  }

  void AndroidUpdater.addListener('downloadProgress', (progress) => {
    const percent = Math.max(0, Math.min(100, Number(progress.percent) || 0))
    emit({ phase: 'downloading', message: `Downloading Android update… ${percent.toFixed(0)}%`, percent, transferred: Number(progress.transferred) || 0, total: Number(progress.total) || 0, bytesPerSecond: Number(progress.bytesPerSecond) || 0 })
  })

  window.wordsOfYeshua = {
    runtime: 'capacitor',
    getNativeHealth: async () => ({ ok: true, engine: 'javascript-mobile-runtime' }),
    searchBiblicalContent: async (query, candidates) => {
      const terms = normalizeSearchText(query).split(' ').filter(Boolean)
      return candidates.flatMap((candidate, index) => terms.every((term) => candidate.includes(term)) ? [index] : [])
    },
    minimizeWindow: () => undefined,
    closeWindow: () => undefined,
    getUpdateState: async () => {
      const version = await getCurrentVersion()
      if (!currentState.currentVersion) currentState = { ...currentState, currentVersion: version }
      return currentState
    },
    checkForUpdates,
    installUpdate: async () => {
      const status = await checkForUpdates()
      if (!status.availableVersion || !currentRelease?.updateAvailable) return status
      emit({ phase: 'downloading', message: `Downloading Android version ${status.availableVersion}…`, percent: 0 })
      try {
        await AndroidUpdater.downloadAndInstall({ downloadUrl: currentRelease.apkUrl, version: currentRelease.latestVersion })
        return emit({ phase: 'installing', message: 'Android’s installer is open. Approve the update to finish installation.', percent: 100 })
      } catch (error) {
        return emit({ phase: 'error', message: `Android installation failed: ${error instanceof Error ? error.message : String(error)}`, percent: 0 })
      }
    },
    openLatestRelease: async () => {
      const releaseUrl = currentRelease?.releaseUrl ?? 'https://github.com/mcographics/WordsofYeshua/releases'
      await Browser.open({ url: releaseUrl })
      return true
    },
    onUpdateState: (listener) => { listeners.add(listener); return () => listeners.delete(listener) },
  }
}
