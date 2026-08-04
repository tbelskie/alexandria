export interface Shelf {
  id: string
  title: string
  subtitle: string
  sort: number
}

export interface Cloth {
  board: string
  spine: string
  foil: string
  endpaper: string
}

export interface ReaderTheme {
  displayFamily: string
  bodyFamily: string
  ink: string
  paper: string
  accent: string
  measureCh: number
  dropCaps: boolean
}

export interface SamplePage {
  title: string
  body: string
}

export interface Volume {
  id: string
  gutenbergId: number
  title: string
  subtitle?: string | null
  authors: string[]
  language: string
  year: number
  shelf: string
  sort: number
  status: 'draft' | 'ready'
  blurb: string
  cover: string
  cloth: Cloth
  spineMotif: string
  readerTheme: ReaderTheme
  samplePages: SamplePage[]
}

export interface Catalog {
  generatedAt: string
  shelves: Shelf[]
  volumes: Volume[]
  stats: { ready: number; draft: number; total: number }
}
