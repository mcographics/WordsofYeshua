const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('wordsOfYeshua', Object.freeze({
  runtime: 'electron',
  getNativeHealth: () => ipcRenderer.invoke('native:health'),
  searchBiblicalContent: (query, candidates) => ipcRenderer.invoke('biblical-content:search', { query, candidates }),
}))
