import { useEffect, useMemo, useRef, useState } from 'react'
import catalogJson from './catalog/generated.json'
import type { Catalog, Volume } from './catalog/types'
import { loadLastShelfIndex, saveLastShelfIndex } from './lib/progress'
import { Reader } from './reader/Reader'
import { ShelfEngine } from './shelf/ShelfEngine'
import './styles/app.css'

const catalog = catalogJson as Catalog

type View = 'shelf' | 'reader'

export default function App() {
  const hostRef = useRef<HTMLDivElement>(null)
  const engineRef = useRef<ShelfEngine | null>(null)
  const [view, setView] = useState<View>('shelf')
  const [index, setIndex] = useState(() => loadLastShelfIndex())
  const [mode, setMode] = useState<'shelf' | 'inspect'>('shelf')
  const [activeVolume, setActiveVolume] = useState<Volume | null>(null)
  const [reducedMotion, setReducedMotion] = useState(false)

  const volumes = catalog.volumes
  const volume = volumes[index] ?? volumes[0]

  const shelfLabel = useMemo(() => {
    const shelf = catalog.shelves.find((s) => s.id === volume?.shelf)
    return shelf?.title ?? 'Collection'
  }, [volume])

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(mq.matches)
    const onChange = () => setReducedMotion(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    if (!hostRef.current || !volumes.length) return
    const engine = new ShelfEngine({
      container: hostRef.current,
      volumes,
      initialIndex: Math.min(index, volumes.length - 1),
      reducedMotion,
      onIndexChange: (i) => {
        setIndex(i)
        saveLastShelfIndex(i)
      },
      onOpenReader: (vol) => {
        setActiveVolume(vol)
        setView('reader')
      },
    })
    engineRef.current = engine
    return () => {
      engine.dispose()
      engineRef.current = null
    }
    // Recreate when volume set or motion preference changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [volumes, reducedMotion])

  useEffect(() => {
    const id = window.setInterval(() => {
      const eng = engineRef.current
      if (!eng) return
      setMode(eng.getMode())
    }, 200)
    return () => clearInterval(id)
  }, [])

  if (!volumes.length) {
    return (
      <div className="empty">
        <h1>Alexandria</h1>
        <p>No ready volumes yet. Mark a volume <code>status: ready</code> and run catalog:build.</p>
      </div>
    )
  }

  return (
    <div className="app">
      <div ref={hostRef} className="shelf-host" aria-hidden={view === 'reader'} />

      {view === 'shelf' && (
        <>
          <header className="top">
            <div>
              <p className="brand">Alexandria</p>
              <p className="tag">A working collection · free forever</p>
            </div>
            <p className="count">
              {catalog.stats.ready} volumes · {shelfLabel}
            </p>
          </header>

          <aside className="panel" aria-live="polite">
            <p className="panel__kicker">{shelfLabel}</p>
            <h1>{volume.title}</h1>
            {volume.subtitle && <p className="panel__sub">{volume.subtitle}</p>}
            <p className="panel__authors">{volume.authors.join(', ')}</p>
            <p className="panel__blurb">{volume.blurb}</p>
            <div className="panel__actions">
              {mode === 'shelf' ? (
                <>
                  <button type="button" className="btn" onClick={() => engineRef.current?.prev()}>
                    Previous
                  </button>
                  <button
                    type="button"
                    className="btn btn--primary"
                    onClick={() => engineRef.current?.enterInspect()}
                  >
                    Pull from shelf
                  </button>
                  <button type="button" className="btn" onClick={() => engineRef.current?.next()}>
                    Next
                  </button>
                </>
              ) : (
                <>
                  <button type="button" className="btn" onClick={() => engineRef.current?.exitInspect()}>
                    Return
                  </button>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => engineRef.current?.openCoverFully()}
                  >
                    Open cover
                  </button>
                  <button
                    type="button"
                    className="btn btn--primary"
                    onClick={() => {
                      setActiveVolume(volume)
                      setView('reader')
                    }}
                  >
                    Begin reading
                  </button>
                </>
              )}
            </div>
            <p className="panel__hint">
              Wheel or arrows to browse · Enter to inspect · Esc to return
            </p>
          </aside>

          <div className="markers" role="tablist" aria-label="Volumes">
            {volumes.map((v, i) => (
              <button
                key={v.id}
                type="button"
                role="tab"
                aria-selected={i === index}
                className={`marker ${i === index ? 'is-active' : ''}`}
                title={v.title}
                onClick={() => {
                  engineRef.current?.setIndex(i)
                  setIndex(i)
                }}
              />
            ))}
          </div>
        </>
      )}

      {view === 'reader' && activeVolume && (
        <Reader
          volume={activeVolume}
          onBack={() => {
            setView('shelf')
            engineRef.current?.exitInspect()
          }}
        />
      )}
    </div>
  )
}
