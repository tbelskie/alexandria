import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import type { Volume } from '../catalog/types'
import { loadEpub, paginateText } from '../lib/epub'
import { loadProgress, saveProgress } from '../lib/progress'
import './reader.css'

interface Props {
  volume: Volume
  onBack: () => void
}

type Status = 'loading' | 'ready' | 'error'

export function Reader({ volume, onBack }: Props) {
  const [status, setStatus] = useState<Status>('loading')
  const [error, setError] = useState<string | null>(null)
  const [pages, setPages] = useState<string[]>([])
  const [titles, setTitles] = useState<string[]>([])
  const [pageIndex, setPageIndex] = useState(0)
  const [chromeVisible, setChromeVisible] = useState(true)
  const theme = volume.readerTheme

  useEffect(() => {
    let cancelled = false
    setStatus('loading')
    setError(null)

    void loadEpub(`/epubs/${volume.id}.epub`)
      .then((book) => {
        if (cancelled) return
        const builtPages: string[] = []
        const builtTitles: string[] = []
        for (const ch of book.chapters) {
          const chunks = paginateText(ch.text, Math.round(theme.measureCh * 22))
          chunks.forEach((chunk, i) => {
            builtPages.push(chunk)
            builtTitles.push(i === 0 ? ch.title : `${ch.title} · continued`)
          })
        }
        setPages(builtPages)
        setTitles(builtTitles)
        const saved = loadProgress(volume.id)
        setPageIndex(
          saved ? Math.min(saved.pageIndex, Math.max(0, builtPages.length - 1)) : 0,
        )
        setStatus('ready')
      })
      .catch((err: Error) => {
        if (cancelled) return
        // Fallback: sample pages so the ritual still works without EPUB
        const fallback = [
          ...(volume.samplePages ?? []).map((p) => `${p.title}\n\n${p.body}`),
          volume.blurb,
          'This volume’s EPUB could not be loaded yet. Run npm run catalog:fetch, then rebuild.',
        ]
        setPages(fallback)
        setTitles(fallback.map((_, i) => (i === 0 ? volume.title : 'Front matter')))
        setStatus('ready')
        setError(err.message)
      })

    return () => {
      cancelled = true
    }
  }, [volume, theme.measureCh])

  useEffect(() => {
    if (status !== 'ready') return
    saveProgress({ volumeId: volume.id, pageIndex, updatedAt: new Date().toISOString() })
  }, [pageIndex, status, volume.id])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault()
        setPageIndex((i) => Math.min(i + 1, pages.length - 1))
      } else if (e.key === 'ArrowLeft') {
        setPageIndex((i) => Math.max(i - 1, 0))
      } else if (e.key === 'Escape') {
        onBack()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pages.length, onBack])

  const style = useMemo(
    () =>
      ({
        '--ink': theme.ink,
        '--paper': theme.paper,
        '--accent': theme.accent,
        '--measure': `${theme.measureCh}ch`,
        '--display': theme.displayFamily,
        '--body': theme.bodyFamily,
      }) as CSSProperties,
    [theme],
  )

  const pageText = pages[pageIndex] ?? ''
  const showDrop = theme.dropCaps && pageIndex > 0 && pageText.length > 80

  return (
    <div
      className={`reader ${chromeVisible ? '' : 'reader--immersive'}`}
      style={style}
      onClick={() => setChromeVisible((v) => !v)}
    >
      <div className="reader__atmosphere" aria-hidden />
      <header className="reader__chrome reader__top" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="reader__btn" onClick={onBack}>
          ← Shelf
        </button>
        <div className="reader__meta">
          <p className="reader__title">{volume.title}</p>
          <p className="reader__author">{volume.authors.join(', ')}</p>
        </div>
        <p className="reader__progress">
          {status === 'ready' ? `${pageIndex + 1} / ${pages.length}` : '…'}
        </p>
      </header>

      <main className="reader__stage" aria-live="polite">
        {status === 'loading' && <p className="reader__status">Opening the volume…</p>}
        {status === 'ready' && (
          <article
            className="reader__page"
            onClick={(e) => {
              e.stopPropagation()
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
              const x = e.clientX - rect.left
              if (x > rect.width * 0.66) setPageIndex((i) => Math.min(i + 1, pages.length - 1))
              else if (x < rect.width * 0.33) setPageIndex((i) => Math.max(i - 1, 0))
              else setChromeVisible((v) => !v)
            }}
          >
            <p className="reader__running">{titles[pageIndex]}</p>
            <div className={`reader__body ${showDrop ? 'reader__body--drop' : ''}`}>
              {showDrop ? (
                <>
                  <span className="drop">{pageText[0]}</span>
                  {pageText.slice(1)}
                </>
              ) : (
                pageText
              )}
            </div>
            <div className="reader__folio">{pageIndex + 1}</div>
          </article>
        )}
        {error && status === 'ready' && (
          <p className="reader__hint" role="status">
            Using front matter while EPUB is unavailable ({error})
          </p>
        )}
      </main>

      <footer className="reader__chrome reader__bottom" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="reader__btn"
          disabled={pageIndex <= 0}
          onClick={() => setPageIndex((i) => Math.max(0, i - 1))}
        >
          Previous leaf
        </button>
        <button
          type="button"
          className="reader__btn reader__btn--primary"
          disabled={pageIndex >= pages.length - 1}
          onClick={() => setPageIndex((i) => Math.min(pages.length - 1, i + 1))}
        >
          Next leaf
        </button>
      </footer>
    </div>
  )
}
