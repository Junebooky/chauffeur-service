import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
const GlassLab = React.lazy(() => import('./GlassLab'))
import './styles.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {new URLSearchParams(window.location.search).get('glass-lab') === '1' ? (
      <React.Suspense fallback={<div className="glass-lab">Loading optical comparison…</div>}>
        <GlassLab />
      </React.Suspense>
    ) : <App />}
  </React.StrictMode>,
)
