const { app, BrowserWindow, ipcMain, net, protocol } = require('electron')
const fs = require('node:fs')
const path = require('node:path')
const { pathToFileURL } = require('node:url')

if (process.env.WOY_ELECTRON_SMOKE === '1') {
  app.setPath('userData', path.join(app.getPath('temp'), 'words-of-yeshua-electron-smoke'))
}

if (process.platform === 'win32') {
  app.setAppUserModelId('com.mcographics.wordsofyeshua')
}

let nativeEngine = null
let nativeLoadError = null
const windows = new Set()

protocol.registerSchemesAsPrivileged([{
  scheme: 'woy',
  privileges: {
    standard: true,
    secure: true,
    supportFetchAPI: true,
    corsEnabled: false,
  },
}])

function registerApplicationProtocol() {
  protocol.handle('woy', (request) => {
    const requestUrl = new URL(request.url)
    if (requestUrl.host !== 'app') return new Response('Not found', { status: 404 })

    const distributionRoot = path.resolve(__dirname, '..', 'dist')
    let requestedPath
    try {
      requestedPath = decodeURIComponent(requestUrl.pathname === '/' ? '/index.html' : requestUrl.pathname)
    } catch {
      return new Response('Invalid path', { status: 400 })
    }

    const targetPath = path.resolve(distributionRoot, `.${requestedPath}`)
    const insideDistribution = targetPath === distributionRoot || targetPath.startsWith(`${distributionRoot}${path.sep}`)
    if (!insideDistribution) return new Response('Forbidden', { status: 403 })
    return net.fetch(pathToFileURL(targetPath).toString())
  })
}

function writeSmokeResult(result) {
  const outputPath = process.env.WOY_ELECTRON_SMOKE_RESULT
  if (!outputPath) return
  try {
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf8')
  } catch (error) {
    console.error(error)
  }
}

function getNativeModulePath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'words_of_yeshua_native.node')
  }
  return path.join(__dirname, '..', 'native', 'build', 'Release', 'words_of_yeshua_native.node')
}

function getApplicationIconPath() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'icon.ico')
    : path.join(__dirname, '..', 'Assets', 'icon.ico')
}

function loadNativeEngine() {
  if (nativeEngine || nativeLoadError) return nativeEngine
  try {
    nativeEngine = require(getNativeModulePath())
  } catch (error) {
    nativeLoadError = error instanceof Error ? error.message : String(error)
  }
  return nativeEngine
}

function validateSearchRequest(payload) {
  if (!payload || typeof payload !== 'object') throw new TypeError('Search request must be an object.')
  const { query, candidates } = payload
  if (typeof query !== 'string' || query.length > 200) throw new TypeError('Search query is invalid.')
  if (!Array.isArray(candidates) || candidates.length > 5000) throw new TypeError('Search candidates are invalid.')
  if (candidates.some((value) => typeof value !== 'string' || value.length > 20000)) throw new TypeError('A search candidate is invalid.')
  return { query, candidates }
}

function normalizeSearchText(value) {
  return (value.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) || []).join(' ')
}

function matchesSearchText(candidate, query) {
  const terms = normalizeSearchText(query).split(' ').filter(Boolean)
  if (terms.length === 0) return true
  const normalizedCandidate = normalizeSearchText(candidate)
  return terms.every((term) => normalizedCandidate.includes(term))
}

ipcMain.handle('native:health', () => {
  const engine = loadNativeEngine()
  return engine ? engine.health() : { ok: false, engine: 'javascript-fallback', error: nativeLoadError }
})

ipcMain.handle('biblical-content:search', (_event, payload) => {
  const { query, candidates } = validateSearchRequest(payload)
  const engine = loadNativeEngine()
  if (!engine) {
    return candidates.flatMap((candidate, index) => matchesSearchText(candidate, query) ? [index] : [])
  }
  return engine.search(query, candidates)
})

function getTrustedWindowForEvent(event) {
  if (event.senderFrame !== event.sender.mainFrame) return null
  const targetWindow = BrowserWindow.fromWebContents(event.sender)
  if (!targetWindow || targetWindow.isDestroyed() || !windows.has(targetWindow)) return null
  return targetWindow
}

ipcMain.on('window:minimize', (event) => {
  const targetWindow = getTrustedWindowForEvent(event)
  if (targetWindow && !targetWindow.isMinimized()) targetWindow.minimize()
})

ipcMain.on('window:close', (event) => {
  const targetWindow = getTrustedWindowForEvent(event)
  if (targetWindow) targetWindow.close()
})

function createWindow() {
  const smokeTest = process.env.WOY_ELECTRON_SMOKE === '1'
  const smokeEvents = []
  const traceSmoke = (event, details = {}) => {
    if (smokeTest) smokeEvents.push({ event, details, at: Date.now() })
  }
  const window = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: 360,
    minHeight: 640,
    frame: false,
    thickFrame: false,
    transparent: true,
    backgroundColor: '#00000000',
    roundedCorners: true,
    hasShadow: false,
    show: false,
    title: 'Words of Yeshua',
    icon: getApplicationIconPath(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      devTools: !app.isPackaged,
    },
  })
  windows.add(window)
  window.on('close', () => traceSmoke('window-close'))
  window.once('closed', () => {
    traceSmoke('window-closed')
    windows.delete(window)
  })
  window.webContents.on('destroyed', () => traceSmoke('web-contents-destroyed'))
  window.webContents.on('render-process-gone', (_event, details) => traceSmoke('render-process-gone', details))

  const devUrl = process.env.VITE_DEV_SERVER_URL
  const appUrl = devUrl || 'woy://app/index.html'
  const trustedOrigin = new URL(appUrl).origin

  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('will-navigate', (event, url) => {
    if (new URL(url).origin !== trustedOrigin) event.preventDefault()
  })
  if (!smokeTest) window.once('ready-to-show', () => window.show())
  if (smokeTest) {
    window.webContents.once('did-finish-load', async () => {
      try {
        const result = await window.webContents.executeJavaScript(`(async () => {
          const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
          await wait(250)
          const health = await window.wordsOfYeshua.getNativeHealth()
          const matches = await window.wordsOfYeshua.searchBiblicalContent('love mercy', [
            'love only',
            'mercy only',
            'love and mercy together'
          ])
          document.querySelector('.hero .primary-button')?.click()
          await wait(100)
          const input = document.querySelector('.search-field input')
          const setSearch = async (value) => {
            const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
            valueSetter.call(input, value)
            input.dispatchEvent(new Event('input', { bubbles: true }))
            await wait(350)
            return {
              count: Number(document.querySelector('.results-heading strong')?.textContent || -1),
              firstReference: document.querySelector('.saying-card .card-body > strong')?.textContent || null,
              noResults: Boolean(document.querySelector('.no-results'))
            }
          }
          const uiSearch = {
            exactReference: await setSearch('John 8:12'),
            actsReference: await setSearch('Acts 9:5'),
            revelationReference: await setSearch('Revelation 3:20'),
            contextualPerson: await setSearch('Lazarus'),
            multiTerm: await setSearch('love mercy'),
            strongNumber: await setSearch('G2424'),
            greekLemma: await setSearch('Ἰησοῦς'),
            noMatch: await setSearch('zzzz-no-match')
          }
          document.querySelector('[aria-label="Clear search"]')?.click()
          await wait(200)
          uiSearch.afterClear = {
            value: input.value,
            count: Number(document.querySelector('.results-heading strong')?.textContent || -1)
          }
          const clickTextButton = (selector, label) => {
            const button = Array.from(document.querySelectorAll(selector)).find((candidate) => candidate.textContent.trim() === label)
            button?.click()
            return Boolean(button)
          }
          clickTextButton('.desktop-nav button', 'Settings')
          await wait(100)
          const settingsRendered = document.querySelectorAll('.settings-group').length === 4
          clickTextButton('.setting-options button', 'Dark')
          clickTextButton('.setting-options button', 'Large')
          clickTextButton('.setting-options button', '40')
          document.querySelector('[role="switch"][aria-label="Compact passage cards"]')?.click()
          document.querySelector('[role="switch"][aria-label="Show complete verse"]')?.click()
          document.querySelector('[role="switch"][aria-label="Show Greek and Strong’s"]')?.click()
          document.querySelector('[role="switch"][aria-label="Reduce animation"]')?.click()
          await wait(100)
          const settingsApplied = {
            theme: document.documentElement.dataset.theme,
            textSize: document.documentElement.dataset.textSize,
            compactCards: document.documentElement.dataset.compactCards,
            reduceMotion: document.documentElement.dataset.reduceMotion,
            stored: JSON.parse(localStorage.getItem('woy-settings') || '{}')
          }
          clickTextButton('.desktop-nav button', 'Explore')
          await wait(150)
          const resultPageSize = document.querySelectorAll('.saying-card').length
          clickTextButton('.desktop-nav button', 'Home')
          await wait(100)
          document.querySelector('.featured-section .light-button')?.click()
          await wait(100)
          const hiddenStudyDetails = {
            fullVerseHidden: !Array.from(document.querySelectorAll('.detail-label')).some((label) => label.textContent === 'Complete verse'),
            originalTermsHidden: !Array.from(document.querySelectorAll('.detail-label')).some((label) => label.textContent === 'Greek and Strong’s connections')
          }
          document.querySelector('.sheet-close')?.click()
          clickTextButton('.desktop-nav button', 'Settings')
          await wait(100)
          clickTextButton('.settings-reset button', 'Reset settings')
          await wait(100)
          const settingsReset = {
            theme: document.documentElement.dataset.theme,
            confirmation: document.querySelector('.settings-confirmation')?.textContent || '',
            stored: JSON.parse(localStorage.getItem('woy-settings') || '{}')
          }
          return {
            title: document.title,
            bridge: window.wordsOfYeshua.runtime,
            health,
            matches,
            rendered: Boolean(document.querySelector('.app-shell .settings-view')),
            uiSearch,
            uiSettings: { settingsRendered, settingsApplied, resultPageSize, hiddenStudyDetails, settingsReset }
          }
        })()`)
        console.log(JSON.stringify(result))
        const passed = result.title === 'Words of Yeshua' && result.bridge === 'electron' && result.health.ok &&
          result.matches.length === 1 && result.matches[0] === 2 && result.rendered &&
          result.uiSearch.exactReference.firstReference === 'John 8:12' &&
          result.uiSearch.actsReference.firstReference === 'Acts 9:5' &&
          result.uiSearch.revelationReference.firstReference === 'Revelation 3:20' &&
          result.uiSearch.contextualPerson.count > 0 && result.uiSearch.multiTerm.count > 0 &&
          result.uiSearch.strongNumber.count > 0 && result.uiSearch.greekLemma.count > 0 &&
          result.uiSearch.noMatch.count === 0 && result.uiSearch.noMatch.noResults &&
          result.uiSearch.afterClear.value === '' && result.uiSearch.afterClear.count > 0 &&
          result.uiSettings.settingsRendered && result.uiSettings.settingsApplied.theme === 'dark' &&
          result.uiSettings.settingsApplied.textSize === 'large' && result.uiSettings.settingsApplied.compactCards === 'true' &&
          result.uiSettings.settingsApplied.reduceMotion === 'true' && result.uiSettings.settingsApplied.stored.resultsPerPage === 40 &&
          result.uiSettings.resultPageSize === 40 && result.uiSettings.hiddenStudyDetails.fullVerseHidden &&
          result.uiSettings.hiddenStudyDetails.originalTermsHidden && result.uiSettings.settingsReset.theme === 'light' &&
          result.uiSettings.settingsReset.stored.resultsPerPage === 80 && result.uiSettings.settingsReset.confirmation.includes('Saved passages were not changed')
        writeSmokeResult({ passed, result, events: smokeEvents, argv: process.argv })
        app.exit(passed ? 0 : 1)
      } catch (error) {
        console.error(error)
        writeSmokeResult({ passed: false, error: error instanceof Error ? error.stack : String(error), events: smokeEvents, argv: process.argv })
        app.exit(1)
      }
    })
    window.webContents.on('did-fail-load', (_event, code, description, validatedUrl, isMainFrame) => {
      traceSmoke('did-fail-load', { code, description, validatedUrl, isMainFrame })
      if (isMainFrame) {
        console.error(`Renderer failed to load (${code}): ${description}`)
        writeSmokeResult({ passed: false, error: `Renderer failed to load (${code}): ${description}`, events: smokeEvents, argv: process.argv })
        app.exit(1)
      }
    })
  }
  window.loadURL(appUrl)
}

app.whenReady().then(() => {
  registerApplicationProtocol()
  loadNativeEngine()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
