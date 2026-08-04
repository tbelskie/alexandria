import { useEffect, useRef, useState } from 'react'
import catalogJson from './catalog/generated.json'
import type { Catalog, Volume } from './catalog/types'
import { loadLastShelfIndex, saveLastShelfIndex } from './lib/progress'
import { Reader } from './reader/Reader'
import { ShelfEngine, type ShelfMode } from './shelf/ShelfEngine'
import './styles/app.css'

const catalog = catalogJson as Catalog

type View = 'shelf' | 'reader'

export default function App() {
  const hostRef = useRef<HTMLDivElement>(null)
  const engineRef = useRef<ShelfEngine | null>(null)
  const [view, setView] = useState<View>('shelf')
  const [index, setIndex] = useState(() =>
    Math.min(loadLastShelfIndex(), Math.max(0, catalog.volumes.length - 1)),
  )
  const [mode, setMode] = useState<ShelfMode>('shelf')
  const [activeVolume, setActiveVolume] = useState<Volume | null>(null)
  const [reducedMotion, setReducedMotion] = useState(false)

  const volumes = catalog.volumes
  const volume = volumes[index] ?? volumes[0]

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
      onModeChange: setMode,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [volumes, reducedMotion])

  if (!volumes.length) {
    return (
      <div className="empty">
        <h1>Alexandria</h1>
        <p>No ready volumes in the working collection.</p>
      </div>
    )
  }

  const foil = volume.cloth.foil

  return (
    <div className="app" style={{ ['--volume-foil' as string]: foil }}>
      <div ref={hostRef} className="shelf-host" aria-hidden={view === 'reader'} />

      {view === 'shelf' && (
        <>
          <header className="chrome chrome--top">
            <div>
              <p className="brand">Alexandria</p>
              <p className="eyebrow">Five foundations · Western canon</p>
            </div>
            <p className="meta">
              {String(index + 1).padStart(2, '0')} / {String(volumes.length).padStart(2, '0')}
            </p>
          </header>

          <footer className="chrome chrome--bottom">
            <div className="caption">
              <p className="caption__index">
                {String(index + 1).padStart(2, '0')} / {String(volumes.length).padStart(2, '0')}
              </p>
              <h1>{volume.title}</h1>
              <p className="caption__sub">
                {volume.subtitle ? `${volume.subtitle} · ` : ''}
                {volume.authors.join(', ')}
              </p>
              <p className="caption__blurb">{volume.blurb}</p>
            </div>

            <div className="controls" role="group" aria-label="Shelf navigation">
              <button type="button" className="btn" aria-label="Previous volume" onClick={() => engineRef.current?.prev()}>
                ‹
              </button>
              {mode === 'shelf' ? (
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={() => engineRef.current?.enterInspect()}
                >
                  Open
                </button>
              ) : (
                <>
                  <button type="button" className="btn" onClick={() => engineRef.current?.exitInspect()}>
                    Shelf
                  </button>
                  <button
                    type="button"
                    className="btn btn--primary"
                    onClick={() => {
                      if ((engineRef.current?.getMode() === 'inspect')) {
                        setActiveVolume(volume)
                        setView('reader')
                      }
                    }}
                  >
                    Read
                  </button>
                </>
              )}
              <button type="button" className="btn" aria-label="Next volume" onClick={() => engineRef.current?.next()}>
                ›
              </button>
            </div>

            <div className="markers" role="tablist" aria-label="Volumes">
              {volumes.map((v, i) => (
                <button
                  key={v.id}
                  type="button"
                  role="tab"
                  aria-selected={i === index}
                  aria-label={v.title}
                  className={`marker ${i === index ? 'is-active' : ''}`}
                  onClick={() => engineRef.current?.setIndex(i)}
                />
              ))}
              <p className="hint">Wheel · arrows · select</p>
            </div>
          </footer>
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
