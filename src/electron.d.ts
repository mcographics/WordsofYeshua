interface NativeEngineHealth {
  ok: boolean
  engine: string
  apiVersion?: number
  cppStandard?: string
  architecture?: string
  error?: string
}

type UpdatePhase = 'idle' | 'unsupported' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'installing' | 'current' | 'error'

interface UpdateState {
  phase: UpdatePhase
  message: string
  currentVersion: string
  availableVersion: string | null
  percent: number | null
  transferred: number
  total: number
  bytesPerSecond: number
}

interface WordsOfYeshuaBridge {
  readonly runtime: 'electron' | 'browser' | 'capacitor'
  getNativeHealth: () => Promise<NativeEngineHealth>
  searchBiblicalContent: (query: string, candidates: string[]) => Promise<number[]>
  minimizeWindow: () => void
  closeWindow: () => void
  setDisplaySettings?: (settings: { displayScale: number; windowResolution: string }) => void
  getUpdateState?: () => Promise<UpdateState>
  checkForUpdates?: () => Promise<UpdateState>
  installUpdate?: () => Promise<UpdateState>
  openLatestRelease?: () => Promise<boolean>
  onUpdateState?: (listener: (state: UpdateState) => void) => () => void
}

interface Window {
  wordsOfYeshua?: WordsOfYeshuaBridge
}
