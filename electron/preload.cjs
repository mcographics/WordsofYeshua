const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('wordsOfYeshua', Object.freeze({
  runtime: 'electron',
  getNativeHealth: () => ipcRenderer.invoke('native:health'),
  searchBiblicalContent: (query, candidates) => ipcRenderer.invoke('biblical-content:search', { query, candidates }),
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  closeWindow: () => ipcRenderer.send('window:close'),
  setDisplaySettings: (settings) => ipcRenderer.send('window:display-settings', settings),
}))
