const PREFIX = 'alexandria.progress.'

export interface ReadingProgress {
  volumeId: string
  pageIndex: number
  updatedAt: string
  bookmarkLabels?: string[]
}

export function loadProgress(volumeId: string): ReadingProgress | null {
  try {
    const raw = localStorage.getItem(PREFIX + volumeId)
    if (!raw) return null
    return JSON.parse(raw) as ReadingProgress
  } catch {
    return null
  }
}

export function saveProgress(progress: ReadingProgress): void {
  localStorage.setItem(
    PREFIX + progress.volumeId,
    JSON.stringify({ ...progress, updatedAt: new Date().toISOString() }),
  )
}

export function loadLastShelfIndex(): number {
  const n = Number(localStorage.getItem('alexandria.shelfIndex') ?? '0')
  return Number.isFinite(n) ? n : 0
}

export function saveLastShelfIndex(index: number): void {
  localStorage.setItem('alexandria.shelfIndex', String(index))
}
