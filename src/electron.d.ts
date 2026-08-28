interface NativeEngineHealth {
  ok: boolean
  engine: string
  apiVersion?: number
  cppStandard?: string
  architecture?: string
  error?: string
}

interface WordsOfYeshuaBridge {
  readonly runtime: 'electron' | 'browser' | 'capacitor'
  getNativeHealth: () => Promise<NativeEngineHealth>
  searchBiblicalContent: (query: string, candidates: string[]) => Promise<number[]>
  minimizeWindow: () => void
  closeWindow: () => void
  setDisplaySettings?: (settings: { displayScale: number; windowResolution: string }) => void
}

interface Window {
  wordsOfYeshua?: WordsOfYeshuaBridge
}
