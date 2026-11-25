import { Component, type ErrorInfo, type ReactNode } from 'react'

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Application error', error, info)
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6">
        <div className="max-w-xl rounded-xl border border-rose-500/40 bg-slate-900 p-6 text-slate-200">
          <h1 className="text-xl font-bold text-rose-300">The workspace could not be loaded</h1>
          <p className="mt-2 text-sm text-slate-400">{this.state.error.message}</p>
          <button
            className="mt-5 rounded-lg bg-cyan-500 px-4 py-2 text-sm font-bold text-slate-950"
            onClick={() => {
              localStorage.clear()
              window.location.reload()
            }}
          >
            Reset local state and reload
          </button>
        </div>
      </div>
    )
  }
}
