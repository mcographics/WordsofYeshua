interface NativeEngineHealth {
  ok: boolean
  engine: string
  apiVersion?: number
  cppStandard?: string
  architecture?: string
  error?: string
}

interface WordsOfYeshuaBridge {
  readonly runtime: 'electron'
  getNativeHealth: () => Promise<NativeEngineHealth>
  searchBiblicalContent: (query: string, candidates: string[]) => Promise<number[]>
  minimizeWindow: () => void
  closeWindow: () => void
}

interface Window {
  wordsOfYeshua?: WordsOfYeshuaBridge
}
