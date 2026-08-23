/**
 * ErrorBoundary.tsx
 *
 * Fix #6 – Catches unhandled errors thrown during the React render phase so a
 * single crashed subtree doesn't take down the entire renderer window.
 *
 * Usage:
 *   <ErrorBoundary>
 *     <ChildThatMightCrash />
 *   </ErrorBoundary>
 *
 *   Or with a custom fallback:
 *   <ErrorBoundary fallback={<MyErrorUI />}>
 *     ...
 *   </ErrorBoundary>
 */

import { Component, ReactNode, ErrorInfo } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface Props {
  children: ReactNode
  /** Custom fallback UI.  Receives the caught error. */
  fallback?: (error: Error, reset: () => void) => ReactNode
  /** Optional identifier shown in the error panel for easier debugging. */
  label?: string
}

interface State {
  error: Error | null
  errorInfo: ErrorInfo | null
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ errorInfo: info })
    console.error(`[ErrorBoundary${this.props.label ? `:${this.props.label}` : ''}] Uncaught error:`, error, info)
  }

  reset = () => this.setState({ error: null, errorInfo: null })

  render() {
    const { error } = this.state
    const { children, fallback, label } = this.props

    if (error) {
      if (fallback) return fallback(error, this.reset)

      return (
        <div
          className="flex flex-col items-center justify-center h-full gap-4 p-8"
          style={{ background: 'var(--bg)', color: 'var(--text)' }}
        >
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center border"
            style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.2)' }}
          >
            <AlertTriangle className="w-8 h-8" style={{ color: 'var(--red)' }} />
          </div>

          <div className="text-center max-w-sm">
            <p className="font-semibold mb-1" style={{ color: 'var(--text)' }}>
              Something went wrong{label ? ` in ${label}` : ''}
            </p>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              {error.message || 'An unexpected error occurred.'}
            </p>
          </div>

          <details className="text-left max-w-lg w-full">
            <summary
              className="text-xs cursor-pointer select-none mb-2"
              style={{ color: 'var(--muted)' }}
            >
              Stack trace
            </summary>
            <pre
              className="text-[10px] p-3 rounded-lg overflow-auto max-h-40"
              style={{
                background: 'var(--card)',
                color: 'var(--sub)',
                border: '1px solid var(--border)',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
              }}
            >
              {error.stack ?? String(error)}
            </pre>
          </details>

          <button
            onClick={this.reset}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      )
    }

    return children
  }
}
