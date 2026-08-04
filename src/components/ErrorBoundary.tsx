import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  error: Error | null
}

/** Keeps the HUD alive if WebGL / a child tree blows up. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[Alexandria]', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        this.props.fallback ?? (
          <div className="flex h-full min-h-[50vh] items-center justify-center bg-[#12141a] px-6 text-center text-[#f3ebdc]">
            <div>
              <p className="font-[family-name:var(--font-display)] text-2xl tracking-wide">
                The shelf could not open
              </p>
              <p className="mt-3 max-w-md text-sm text-white/60">
                This device may not support WebGL, or a cached build is stale. Hard-refresh
                (Cmd+Shift+R) or try another browser.
              </p>
              <p className="mt-4 font-mono text-xs text-red-300/80">
                {this.state.error.message}
              </p>
            </div>
          </div>
        )
      )
    }
    return this.props.children
  }
}
