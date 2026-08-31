const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('wordsOfYeshua', Object.freeze({
  runtime: 'electron',
  getNativeHealth: () => ipcRenderer.invoke('native:health'),
  searchBiblicalContent: (query, candidates) => ipcRenderer.invoke('biblical-content:search', { query, candidates }),
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  closeWindow: () => ipcRenderer.send('window:close'),
  setDisplaySettings: (settings) => ipcRenderer.send('window:display-settings', settings),
  getUpdateState: () => ipcRenderer.invoke('updates:get-state'),
  checkForUpdates: () => ipcRenderer.invoke('updates:check'),
  installUpdate: () => ipcRenderer.invoke('updates:install'),
  openLatestRelease: () => ipcRenderer.invoke('updates:view-latest'),
  onUpdateState: (listener) => {
    const handler = (_event, state) => listener(state)
    ipcRenderer.on('updates:state', handler)
    return () => ipcRenderer.removeListener('updates:state', handler)
  },
}))
