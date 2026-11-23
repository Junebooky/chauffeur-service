import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowRight, CalendarDays, Check, ClipboardList, Clock3, CreditCard, Database, RefreshCw, Search, ShieldCheck, Truck } from 'lucide-react'
import DisplayHeading from './components/ui/DisplayHeading'
import SectionEyebrow from './components/ui/SectionEyebrow'
import './admin.css'
import './admin-overview.css'

type Stage = 'requested' | 'reviewing' | 'quoted' | 'awaiting_deposit' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'declined'
type LiveRow = {
  number: number
  maskedReference: string
  status: Stage
  createdAt: string
  dayCount: number
  assignmentCount: number
  paymentRecorded: boolean
  service: string | null
  fleet: string | null
}
type Board = {
  scope: string
  updatedAt: string
  metrics: { requests: number; new: number; sourcing: number; awaitingPayment: number; confirmed: number }
  reservations: LiveRow[]
}
const statusLabel = (value: string) => value.replaceAll('_',' ').replace(/\b\w/g,s=>s.toUpperCase())
const when = (value: string) => new Intl.DateTimeFormat('en-GB', {
  day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit',
  timeZone:'Asia/Seoul',
}).format(new Date(value))
const friendlyService = (service: string | null) =>
  service === 'airport' ? 'Pick-up Service'
  : service === 'day' ? 'Schedule Service'
  : service === 'hourly' ? 'Hourly Charter' : 'Journey request'
const stageNames = ['Request received','Vehicle & driver assignment','Payment verification','Booking confirmed']
const completedStages = (row: LiveRow) => {
  let stages = 1
  if (row.assignmentCount > 0) stages = 2
  if (row.paymentRecorded) stages = 3
  if (['confirmed','in_progress','completed'].includes(row.status)) stages = 4
  return stages
}
export default function AdminOverview() {
  const [board, setBoard] = useState<Board|null>(null)
  const [error,setError] = useState('')
  const [busy,setBusy] = useState(false)
  const [selected,setSelected] = useState<number|null>(null)
  const [search,setSearch] = useState('')
  const [filter,setFilter] = useState('all')
  const refresh = useCallback(async (silent = false) => {
    if (!silent) setBusy(true)
    try {
      const response = await fetch('/api/admin-overview', {
        method:'GET', headers: { Accept:'application/json' }, cache:'no-store',
      })
      const data = await response.json()
      if (!response.ok || !Array.isArray(data.reservations))
        throw new Error(data.error || 'Could not load live reservations.')
      setBoard(data as Board)
      setError('')
      setSelected(previous => previous && data.reservations.some((r:LiveRow)=>r.number===previous) ?
        previous : data.reservations[0]?.number ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load live reservations.')
    } finally { setBusy(false) }
  }, [])
  useEffect(() => {
    void refresh()
    const interval = window.setInterval(() => { if (!document.hidden) void refresh(true) },30000)
    return () => window.clearInterval(interval)
  },[refresh])
  const rows = board?.reservations || []
  const filtered = useMemo(() => rows.filter(row =>
    (filter === 'all' || row.status === filter) &&
    [row.maskedReference, friendlyService(row.service), row.fleet || ''].some(s=>
      s.toLowerCase().includes(search.toLowerCase()))
  ),[rows,search,filter])
  const current = rows.find(row => row.number === selected) ?? null
  const stats = [
    { label:'Recent requests', value: board?.metrics.requests ?? 0 },
    { label:'New requests', value: board?.metrics.new ?? 0 },
    { label:'Sourcing', value: board?.metrics.sourcing ?? 0 },
    { label:'Awaiting payment', value: board?.metrics.awaitingPayment ?? 0 },
  ]
  return <div className="admin-root admin-overview">
    <aside className="admin-sidebar">
      <div className="admin-logo"><span className="admin-brand-mark">J</span><span>CHAUFFEUR <small>OPERATIONS</small></span></div>
      <p className="admin-sidebar-eyebrow">WORKSPACE</p>
      <a className="admin-nav-item selected" href="/admin"><ClipboardList size={16}/> Reservations</a>
      <a className="admin-nav-item" href="/admin/live"><Truck size={16}/> Dispatch & payments <ArrowRight size={13}/></a>
      <div className="admin-sidebar-bottom">
        <span><ShieldCheck size={14}/> Live summary · read only</span>
        <a href="/admin/live">Private operations <ArrowRight size={13}/></a>
        <a href="/">Customer website <ArrowRight size={13}/></a>
      </div>
    </aside>
    <main className="admin-main">
      <header className="admin-topbar"><span>CHAUFFEUR / OPERATIONS</span><button onClick={()=>void refresh()} disabled={busy}><RefreshCw size={14}/> Refresh data</button></header>
      <div className="admin-content">
        <div className="admin-live-banner"><Database size={16}/><div><strong>Live Supabase reservations</strong>
          <span>New customer booking requests appear here automatically. This public view hides guest information, exact itineraries and payment amounts.</span>
        </div><span className="admin-live-dot" aria-label="Live database"/></div>
        {error && <div className="admin-error admin-banner" role="alert">{error}<button onClick={()=>void refresh()}>Retry</button></div>}
        <div className="admin-heading"><div><SectionEyebrow>THE OPERATIONS DESK</SectionEyebrow>
          <DisplayHeading as="h1">Reservations.</DisplayHeading>
          <p>Actual customer requests, from first submission through confirmation.</p></div>
          <div className="admin-heading-side"><span className="admin-count">Live data</span><small>{board ? 'Updated ' + when(board.updatedAt) : 'Connecting to database'}</small></div>
        </div>
        <div className="admin-stats">{stats.map(s=><div key={s.label}><span>{s.label}</span><strong>{s.value}</strong></div>)}</div>
        <div className="admin-board">
          <section className="admin-list">
            <div className="admin-panel-heading"><h2>Booking requests</h2><span>Latest 100</span></div>
            <div className="admin-filters">
              <div className="admin-search"><Search size={15}/><input aria-label="Search reservations" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Reference, vehicle or service"/></div>
              <div className="admin-select-wrap"><select aria-label="Filter by status" value={filter} onChange={e=>setFilter(e.target.value)}>
                <option value="all">All statuses</option>
                {['requested','reviewing','quoted','awaiting_deposit','confirmed','in_progress','completed','cancelled','declined'].map(x=><option value={x} key={x}>{statusLabel(x)}</option>)}
              </select></div>
            </div>
            {!board && !error ? <div className="admin-empty"><RefreshCw size={19} className="admin-spin"/> Connecting to live reservations…</div>
              : filtered.length===0 ? <div className="admin-empty"><CalendarDays size={26}/>
                <strong>{rows.length===0 ? 'No bookings have been received yet.' : 'No bookings match this filter.'}</strong>
                <span>{rows.length===0 ? 'When a guest completes a reservation on the customer website, it will appear here automatically.' : 'Try a different search or status.'}</span>
                {rows.length===0 && <a href="/">Go to customer booking <ArrowRight size={13}/></a>}
              </div>
              : <div className="admin-booking-list">{filtered.map(row=><button key={row.number}
                  className={'admin-booking '+(current?.number===row.number?'active':'')} onClick={()=>setSelected(row.number)}>
                <div><strong>{row.maskedReference}</strong><span>{friendlyService(row.service)}</span><small>{row.dayCount} journey day{row.dayCount===1?'':'s'}</small></div>
                <div className="admin-booking-right"><span className={'admin-status '+row.status}>{statusLabel(row.status)}</span><small>{when(row.createdAt)}</small></div>
              </button>)}</div>}
          </section>
          <section className="admin-detail">
            {!current?<div className="admin-empty"><ClipboardList size={24}/><strong>No reservation selected</strong><span>Real booking activity will appear here when requests arrive.</span></div>:<>
              <div className="admin-panel-heading"><div><span className="admin-eyebrow">LIVE RESERVATION / REDACTED</span><h2>{current.maskedReference}</h2></div><span className={'admin-status '+current.status}>{statusLabel(current.status)}</span></div>
              <div className="admin-detail-scroll">
                <div className="admin-section"><h3>Journey overview</h3><div className="admin-info-grid">
                  <div><small>SERVICE</small><strong>{friendlyService(current.service)}</strong></div>
                  <div><small>VEHICLE CLASS</small><strong>{statusLabel(current.fleet||'Unspecified')}</strong></div>
                  <div><small>JOURNEY DAYS</small><strong>{current.dayCount}</strong></div>
                  <div><small>REQUEST RECEIVED</small><strong>{when(current.createdAt)}</strong></div>
                </div></div>
                <div className="admin-section"><h3>Operations progress</h3>
                  <div className="admin-live-timeline">{stageNames.map((stage,index)=>{
                    const isCompleted = index < completedStages(current)
                    return <div className={'admin-live-stage '+(isCompleted?'done':'')} key={stage}>
                      <span className="admin-live-node">{isCompleted?<Check size={12}/>:index+1}</span>
                      <div><strong>{stage}</strong><small>{index===0?'Recorded in Supabase'
                        :index===1?current.assignmentCount+'/'+current.dayCount+' day(s) assigned'
                        :index===2?(current.paymentRecorded?'Payment confirmed':'Awaiting verified payment')
                        :index===3?statusLabel(current.status):''}</small></div>
                    </div>
                  })}</div>
                </div>
                <div className="admin-section"><h3><Clock3 size={15}/> Status</h3><p className="admin-live-note">This view is updated from actual reservation records. Customer contact details, exact trip routes and any changes are available only in the private operations workspace.</p></div>
                <a className="admin-primary admin-live-action" href="/admin/live">Open private operations <ArrowRight size={15}/></a>
              </div>
            </>}
          </section>
        </div>
        <div className="admin-live-footer"><CreditCard size={15}/> Booking requests are stored by the customer booking API. Dispatch and payments are recorded in the protected operations console.</div>
      </div>
    </main>
  </div>
}
