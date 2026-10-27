import { Component } from 'react'

/** Catches render errors so a bad chart or row can't blank the whole app. */
export class ErrorBoundary extends Component {
  state = { error: null }
  static getDerivedStateFromError(error) {
    return { error }
  }
  render() {
    if (!this.state.error) return this.props.children
    return (
      <div role="alert" className="mx-auto mt-24 max-w-md rounded-card border border-line bg-surface p-6 text-center shadow-card">
        <h1 className="text-lg font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted">{String(this.state.error.message || this.state.error)}</p>
        <p className="mt-2 text-xs text-muted">Your data is safe in browser storage. Reload to continue, or download a backup from Import/Export.</p>
        <button type="button" className="mt-4 rounded-input bg-primary px-4 py-2 text-sm font-medium text-white" onClick={() => location.reload()}>Reload</button>
      </div>
    )
  }
}
