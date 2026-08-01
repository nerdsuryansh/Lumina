import React from 'react'
import ReactDOM from 'react-dom/client'
import { Desktop } from './index.tsx'
import './index.css'

class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: any}> {
  constructor(props: any) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error: any) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) {
      return <div style={{color:'red', background:'black', padding:20, zIndex:99999, position:'fixed', inset:0}}><h1>Crash!</h1><pre>{this.state.error?.toString()}</pre><pre>{this.state.error?.stack}</pre></div>;
    }
    return this.props.children; 
  }
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <Desktop />
    </ErrorBoundary>
  </React.StrictMode>,
)
