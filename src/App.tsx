import { useEffect, useState } from 'react'
import { SpatialShelf } from './components/spatial/SpatialShelf'
import type { BookVolumeSpec } from './components/spatial/BookCoverMesh'
import { CANON } from './canon/volumes'
import { loadLastShelfIndex, saveLastShelfIndex } from './lib/progress'
import { Reader } from './reader/Reader'
import { AlexandriaTokens } from './styles/tokens'
import type { Volume } from './catalog/types'

type View = 'shelf' | 'reader'
type Mode = 'shelf' | 'inspect'

function toReaderVolume(spec: BookVolumeSpec): Volume {
  return {
    id: spec.id,
    gutenbergId: spec.gutenbergId,
    title: spec.title,
    subtitle: spec.subtitle ?? null,
    authors: [spec.author],
    language: 'en',
    year: 0,
    shelf: 'foundations',
    sort: 0,
    status: 'ready',
    blurb: spec.blurb,
    cover: '',
    cloth: {
      board: spec.bindingColor,
      spine: spec.bindingColor,
      foil: AlexandriaTokens.foils[spec.foilKey].base,
      endpaper: spec.bindingColor,
    },
    spineMotif: spec.motif,
    binding: {
      height: (spec.height ?? 0.64) / 0.62,
      depth: (spec.width ?? 0.42) / 0.42,
      thickness: (spec.depth ?? 0.07) / 0.062,
    },
    readerTheme: {
      displayFamily: 'Cinzel',
      bodyFamily: 'EB Garamond',
      ink: spec.readerTheme.ink,
      paper: spec.readerTheme.paper,
      accent: spec.readerTheme.accent,
      measureCh: spec.readerTheme.measureCh,
      dropCaps: spec.readerTheme.dropCaps,
    },
    samplePages: [
      { title: spec.title, body: spec.subtitle ?? spec.author },
      { title: 'Alexandria', body: spec.blurb },
    ],
  }
}

export default function App() {
  const volumes = CANON
  const [view, setView] = useState<View>('shelf')
  const [mode, setMode] = useState<Mode>('shelf')
  const [index, setIndex] = useState(() =>
    Math.min(loadLastShelfIndex(), Math.max(0, volumes.length - 1)),
  )
  const [coverOpen, setCoverOpen] = useState(0)
  const [active, setActive] = useState<BookVolumeSpec | null>(null)
  const [reducedMotion, setReducedMotion] = useState(false)

  const volume = volumes[index] ?? volumes[0]
  const foil = AlexandriaTokens.foils[volume.foilKey].base

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(mq.matches)
    const onChange = () => setReducedMotion(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    if (mode === 'shelf') setCoverOpen(0)
  }, [mode, index])

  return (
    <div className="relative h-full min-h-full overflow-hidden bg-[#12141a] text-[#f3ebdc]">
      <div className="absolute inset-0" aria-hidden={view === 'reader'}>
        <SpatialShelf
          volumes={volumes}
          index={index}
          onIndexChange={(i) => {
            setIndex(i)
            saveLastShelfIndex(i)
          }}
          mode={mode}
          onModeChange={setMode}
          coverOpen={coverOpen}
          onCoverOpenChange={setCoverOpen}
          reducedMotion={reducedMotion}
          onRead={(spec) => {
            setActive(spec)
            setView('reader')
          }}
        />
      </div>

      {view === 'shelf' && (
        <>
          <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between bg-gradient-to-b from-black/60 to-transparent px-6 py-5 md:px-10">
            <div>
              <p className="font-[family-name:var(--font-display)] text-3xl tracking-[0.04em] md:text-4xl">
                Alexandria
              </p>
              <p className="mt-1 text-[0.7rem] uppercase tracking-[0.2em] text-white/55">
                Five foundations · Western canon
              </p>
            </div>
            <p className="font-mono text-sm tracking-widest text-white/55">
              {String(index + 1).padStart(2, '0')} / {String(volumes.length).padStart(2, '0')}
            </p>
          </header>

          <footer className="absolute inset-x-0 bottom-0 z-10 grid grid-cols-1 items-end gap-4 bg-gradient-to-t from-black/75 via-black/40 to-transparent px-6 pb-6 pt-24 md:grid-cols-[1fr_auto_1fr] md:px-10">
            <div className="max-w-md">
              <p className="font-mono text-xs tracking-[0.16em] text-white/50">
                {String(index + 1).padStart(2, '0')} / {String(volumes.length).padStart(2, '0')}
              </p>
              <h1 className="mt-1 font-[family-name:var(--font-display-alt)] text-3xl font-medium tracking-wide md:text-4xl">
                {volume.title}
              </h1>
              <p className="mt-1 text-sm text-white/60">
                {volume.subtitle ? `${volume.subtitle} · ` : ''}
                {volume.author}
              </p>
              <p className="mt-3 hidden text-[0.95rem] leading-relaxed text-white/65 md:block">
                {volume.blurb}
              </p>
            </div>

            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                aria-label="Previous"
                className="h-11 min-w-11 border border-white/20 bg-black/40 px-3 backdrop-blur-md"
                onClick={() => setIndex((i) => Math.max(0, i - 1))}
              >
                ‹
              </button>
              {mode === 'shelf' ? (
                <button
                  type="button"
                  className="h-11 border px-5 font-[family-name:var(--font-display-alt)] text-sm uppercase tracking-[0.14em] backdrop-blur-md"
                  style={{
                    borderColor: `${foil}99`,
                    background: `${foil}33`,
                  }}
                  onClick={() => setMode('inspect')}
                >
                  Open
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className="h-11 border border-white/20 bg-black/40 px-4 backdrop-blur-md"
                    onClick={() => setMode('shelf')}
                  >
                    Shelf
                  </button>
                  <button
                    type="button"
                    className="h-11 border px-5 font-[family-name:var(--font-display-alt)] text-sm uppercase tracking-[0.14em]"
                    style={{ borderColor: `${foil}99`, background: `${foil}33` }}
                    onClick={() => {
                      if (coverOpen < 0.9) setCoverOpen(1)
                      else {
                        setActive(volume)
                        setView('reader')
                      }
                    }}
                  >
                    {coverOpen < 0.9 ? 'Cover' : 'Read'}
                  </button>
                </>
              )}
              <button
                type="button"
                aria-label="Next"
                className="h-11 min-w-11 border border-white/20 bg-black/40 px-3 backdrop-blur-md"
                onClick={() => setIndex((i) => Math.min(volumes.length - 1, i + 1))}
              >
                ›
              </button>
            </div>

            <div className="flex flex-col items-start gap-2 md:items-end">
              <div className="flex gap-1.5" role="tablist" aria-label="Volumes">
                {volumes.map((v, i) => (
                  <button
                    key={v.id}
                    type="button"
                    role="tab"
                    aria-selected={i === index}
                    aria-label={v.title}
                    className="h-[3px] transition-all"
                    style={{
                      width: i === index ? 28 : 16,
                      background: i === index ? foil : 'rgba(255,255,255,0.28)',
                    }}
                    onClick={() => {
                      setIndex(i)
                      setMode('shelf')
                    }}
                  />
                ))}
              </div>
              <p className="text-[0.65rem] uppercase tracking-[0.16em] text-white/45">
                Wheel · arrows · select
              </p>
            </div>
          </footer>
        </>
      )}

      {view === 'reader' && active && (
        <Reader
          volume={toReaderVolume(active)}
          onBack={() => {
            setView('shelf')
            setMode('inspect')
          }}
        />
      )}
    </div>
  )
}
