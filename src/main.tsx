import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
const GlassLab = React.lazy(() => import('./GlassLab'))
const Admin = React.lazy(() => import('./Admin'))
const AdminPreview = React.lazy(() => import('./AdminPreview'))
import './styles.css'
import './tailwind.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {window.location.pathname.replace(/\/$/, '') === '/admin' ? (
      <React.Suspense fallback={<div style={{ minHeight: '100vh', background: '#0b0d10' }} />}><AdminPreview /></React.Suspense>
    ) : window.location.pathname.replace(/\/$/, '') === '/admin/live' ? (
      <React.Suspense fallback={<div style={{ minHeight: '100vh', background: '#0b0d10' }} />}><Admin /></React.Suspense>
    ) : new URLSearchParams(window.location.search).get('glass-lab') === '1' ? (
      <React.Suspense fallback={<div className="glass-lab">Loading optical comparison…</div>}>
        <GlassLab />
      </React.Suspense>
    ) : <App />}
  </React.StrictMode>,
)
