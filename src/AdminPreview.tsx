import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowRight, CalendarDays, Check, ClipboardList, CreditCard, RotateCcw, Search, ShieldCheck, Truck, UserRound } from 'lucide-react'
import DisplayHeading from './components/ui/DisplayHeading'
import SectionEyebrow from './components/ui/SectionEyebrow'
import './admin.css'
import './admin-preview.css'

type Status = 'requested' | 'reviewing' | 'quoted' | 'awaiting_deposit' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled'
type Booking = {
  id: string
  reference: string
  guest: string
  email: string
  contact: string
  company: string
  created: string
  status: Status
  vehicle: string
  service: string
  total: number
  paid: number
  method: string
  days: { day: string; time: string; pickup: string; dropoff: string }[]
  supplier: string
  driver: string
}
type Partner = { id: string; name: string }
const INITIAL_BOOKINGS: Booking[] = [
  {
    id: 'sample-001', reference: 'SAMPLE-001', guest: 'Sample Guest A',
    email: 'guest-a@example.invalid', contact: 'Sample contact only', company: 'Example Holdings',
    created: '2026-11-23T05:00:00Z', status: 'requested', vehicle: 'Genesis G90',
    service: 'Pick-up Service', total: 300000, paid: 0, method: 'Bank transfer',
    days: [{ day: '2026-12-04', time: '10:30', pickup: 'Incheon Airport', dropoff: 'Gangnam, Seoul' }],
    supplier: '', driver: '',
  },
  {
    id: 'sample-002', reference: 'SAMPLE-002', guest: 'Sample Guest B',
    email: 'guest-b@example.invalid', contact: 'Sample contact only', company: 'Example International',
    created: '2026-11-22T06:20:00Z', status: 'reviewing', vehicle: 'Staria Limousine',
    service: 'Schedule Service', total: 860000, paid: 0, method: 'PayPal Invoice',
    days: [
      { day: '2026-12-06', time: '09:00', pickup: 'Grand Hyatt Seoul', dropoff: 'COEX, Seoul' },
      { day: '2026-12-07', time: '09:00', pickup: 'Grand Hyatt Seoul', dropoff: 'Seoul Station' },
    ],
    supplier: 'Example Vehicle Partner', driver: '',
  },
  {
    id: 'sample-003', reference: 'SAMPLE-003', guest: 'Sample Guest C',
    email: 'guest-c@example.invalid', contact: 'Sample contact only', company: 'Example Corporation',
    created: '2026-11-21T03:00:00Z', status: 'awaiting_deposit', vehicle: 'Carnival Hi-Limousine',
    service: 'Pick-up Service', total: 200000, paid: 0, method: 'Bank transfer',
    days: [{ day: '2026-12-10', time: '14:00', pickup: 'Gimpo Airport', dropoff: 'Jamsil, Seoul' }],
    supplier: 'Example Vehicle Partner', driver: 'Sample Chauffeur',
  },
  {
    id: 'sample-004', reference: 'SAMPLE-004', guest: 'Sample Guest D',
    email: 'guest-d@example.invalid', contact: 'Sample contact only', company: 'Example Group',
    created: '2026-11-19T04:40:00Z', status: 'confirmed', vehicle: 'Mercedes-Benz Sprinter',
    service: 'Schedule Service', total: 530000, paid: 265000, method: 'International wire',
    days: [{ day: '2026-12-12', time: '08:30', pickup: 'The Shilla Seoul', dropoff: 'Seoul City Hall' }],
    supplier: 'Example Vehicle Partner', driver: 'Sample Chauffeur',
  },
]
const STATUS_OPTIONS: Status[] = ['requested', 'reviewing', 'quoted', 'awaiting_deposit', 'confirmed', 'in_progress', 'completed', 'cancelled']
const money = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(value)
const label = (s: string) => s.replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase())
const initialSuppliers: Partner[] = [{ id: 'supplier-sample', name: 'Example Vehicle Partner' }]
const initialDrivers: Partner[] = [{ id: 'driver-sample', name: 'Sample Chauffeur' }]

export default function AdminPreview() {
  const [view, setView] = useState<'reservations' | 'partners' | 'payments'>('reservations')
  const [bookings, setBookings] = useState<Booking[]>(INITIAL_BOOKINGS)
  const [suppliers, setSuppliers] = useState<Partner[]>(initialSuppliers)
  const [drivers, setDrivers] = useState<Partner[]>(initialDrivers)
  const [selectedId, setSelectedId] = useState(INITIAL_BOOKINGS[0].id)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [supplierName, setSupplierName] = useState('')
  const [driverName, setDriverName] = useState('')
  const [paymentInput, setPaymentInput] = useState('')
  const [notice, setNotice] = useState('')
  const selected = bookings.find(booking => booking.id === selectedId) ?? bookings[0]
  const filtered = useMemo(() => bookings.filter(booking =>
    (filter === 'all' || booking.status === filter) &&
    [booking.reference, booking.guest, booking.company].some(value => value.toLowerCase().includes(query.toLowerCase()))
  ), [bookings, filter, query])
  const stats = [
    { label: 'New requests', value: bookings.filter(b => b.status === 'requested').length },
    { label: 'In review', value: bookings.filter(b => ['reviewing', 'quoted', 'awaiting_deposit'].includes(b.status)).length },
    { label: 'Confirmed', value: bookings.filter(b => b.status === 'confirmed').length },
    { label: 'Completed', value: bookings.filter(b => b.status === 'completed').length },
  ]
  const updateBooking = (id: string, patch: Partial<Booking>, message: string) => {
    setBookings(prev => prev.map(booking => booking.id === id ? { ...booking, ...patch } : booking))
    setNotice(message + ' — preview only')
  }
  const addSupplier = (event: FormEvent) => {
    event.preventDefault()
    if (!supplierName.trim()) return
    setSuppliers(prev => [...prev, { id: 'demo-supplier-' + prev.length, name: supplierName.trim() }])
    setSupplierName('')
    setNotice('Supplier added to preview only')
  }
  const addDriver = (event: FormEvent) => {
    event.preventDefault()
    if (!driverName.trim()) return
    setDrivers(prev => [...prev, { id: 'demo-driver-' + prev.length, name: driverName.trim() }])
    setDriverName('')
    setNotice('Chauffeur added to preview only')
  }
  const reset = () => {
    setBookings(INITIAL_BOOKINGS)
    setSuppliers(initialSuppliers)
    setDrivers(initialDrivers)
    setSelectedId(INITIAL_BOOKINGS[0].id)
    setNotice('Sample data restored')
  }
  return <div className="admin-root admin-preview">
    <aside className="admin-sidebar">
      <div className="admin-logo"><span className="admin-preview-logo">J</span><span>CHAUFFEUR <small>OPERATIONS</small></span></div>
      <p className="admin-sidebar-eyebrow">WORKSPACE</p>
      <button className={view === 'reservations' ? 'selected' : ''} onClick={() => setView('reservations')}><ClipboardList size={16}/> Reservations</button>
      <button className={view === 'partners' ? 'selected' : ''} onClick={() => setView('partners')}><Truck size={16}/> Suppliers & drivers</button>
      <button className={view === 'payments' ? 'selected' : ''} onClick={() => setView('payments')}><CreditCard size={16}/> Payments</button>
      <div className="admin-sidebar-bottom">
        <span><ShieldCheck size={14}/> Public preview</span>
        <button onClick={reset}><RotateCcw size={15}/> Reset sample data</button>
        <a href="/">Return to website <ArrowRight size={13}/></a>
      </div>
    </aside>
    <main className="admin-main">
      <header className="admin-topbar"><span>CHAUFFEUR / OPERATIONS</span><span className="admin-preview-chip">DEMO ACCESS · NO SIGN-IN</span></header>
      <div className="admin-content">
        <div className="admin-preview-banner" role="status"><ShieldCheck size={16}/><div><strong>Preview mode</strong><span>No sign-in required. This page uses sample data only. Customer details and Supabase operations remain protected.</span></div></div>
        {notice && <div className="admin-success admin-banner" role="status">{notice}<button onClick={() => setNotice('')}>Dismiss</button></div>}
        {view === 'reservations' && <>
          <div className="admin-heading">
            <div><SectionEyebrow>THE OPERATIONS DESK</SectionEyebrow><DisplayHeading as="h1">Reservations.</DisplayHeading><p>A complete preview of the request-to-confirmation workflow.</p></div>
            <span className="admin-count">Sample bookings</span>
          </div>
          <div className="admin-stats">{stats.map(stat => <div key={stat.label}><span>{stat.label}</span><strong>{stat.value}</strong></div>)}</div>
          <div className="admin-board">
            <section className="admin-list">
              <div className="admin-panel-heading"><h2>Booking requests</h2><span>Sample data</span></div>
              <div className="admin-filters">
                <div className="admin-search"><Search size={15}/><input aria-label="Search sample bookings" placeholder="Search reference or guest" value={query} onChange={e => setQuery(e.target.value)}/></div>
                <div className="admin-select-wrap"><select aria-label="Filter sample bookings" value={filter} onChange={e => setFilter(e.target.value)}><option value="all">All statuses</option>{STATUS_OPTIONS.map(status => <option key={status} value={status}>{label(status)}</option>)}</select></div>
              </div>
              {filtered.length === 0 ? <div className="admin-empty">No sample bookings match your filters.</div> :
                <div className="admin-booking-list">{filtered.map(booking => <button className={'admin-booking ' + (selected?.id === booking.id ? 'active' : '')} key={booking.id} onClick={() => setSelectedId(booking.id)}>
                  <div><strong>{booking.reference}</strong><span>{booking.guest}</span><small>{booking.company}</small></div>
                  <div className="admin-booking-right"><span className={'admin-status ' + booking.status}>{label(booking.status)}</span><small>{booking.days.length} {booking.days.length === 1 ? 'day' : 'days'}</small></div>
                </button>)}</div>}
            </section>
            <section className="admin-detail">
              <div className="admin-panel-heading"><div><span className="admin-eyebrow">BOOKING DETAILS / SAMPLE</span><h2>{selected.reference}</h2></div><span className={'admin-status ' + selected.status}>{label(selected.status)}</span></div>
              <div className="admin-detail-scroll">
                <div className="admin-section"><h3>Guest information</h3>
                  <div className="admin-info-grid"><div><small>NAME</small><strong>{selected.guest}</strong></div><div><small>COMPANY</small><strong>{selected.company}</strong></div><div className="wide"><small>CONTACT</small><strong>{selected.email}</strong></div></div>
                </div>
                <div className="admin-section"><h3>Reservation status</h3><div className="admin-inline"><select aria-label="Change sample booking status" value={selected.status} onChange={e => updateBooking(selected.id, {status: e.target.value as Status}, 'Reservation updated')}>{STATUS_OPTIONS.map(status => <option key={status} value={status}>{label(status)}</option>)}</select><span>Local preview update</span></div></div>
                <div className="admin-section"><h3><CalendarDays size={16}/> Itinerary <span>{selected.days.length} {selected.days.length === 1 ? 'day' : 'days'}</span></h3>
                  {selected.days.map((day, i) => <div className="admin-day" key={day.day}><div className="admin-day-top"><span>DAY {String(i+1).padStart(2,'0')}</span><strong>{day.day} · {day.time}</strong></div><h4>{selected.vehicle} · {selected.service}</h4><p>{day.pickup} <ArrowRight size={12}/> {day.dropoff}</p></div>)}
                </div>
                <div className="admin-section"><h3><Truck size={16}/> Vehicle & chauffeur assignment</h3><div className="admin-field-grid">
                  <label>Vehicle supplier<select aria-label="Choose sample supplier" value={selected.supplier} onChange={e => updateBooking(selected.id, {supplier:e.target.value}, 'Assignment updated')}><option value="">Not assigned</option>{suppliers.map(p => <option value={p.name} key={p.id}>{p.name}</option>)}</select></label>
                  <label>Chauffeur<select aria-label="Choose sample chauffeur" value={selected.driver} onChange={e => updateBooking(selected.id, {driver:e.target.value}, 'Assignment updated')}><option value="">Not assigned</option>{drivers.map(p => <option value={p.name} key={p.id}>{p.name}</option>)}</select></label>
                </div></div>
                <div className="admin-section"><h3><CreditCard size={16}/> Payment & settlement</h3>
                  <div className="admin-money"><span>Quoted total</span><strong>{money(selected.total)}</strong></div>
                  <div className="admin-money"><span>Deposit received</span><strong>{money(selected.paid)}</strong></div>
                  <div className="admin-money"><span>Remaining balance</span><strong>{money(Math.max(0,selected.total-selected.paid))}</strong></div>
                  <div className="admin-preview-payment"><span>Method: {selected.method}</span><button className="admin-secondary" type="button" onClick={() => updateBooking(selected.id, {paid:selected.total}, 'Payment marked as paid')}><Check size={14}/> Mark paid (sample)</button></div>
                </div>
              </div>
            </section>
          </div>
        </>}
        {view === 'partners' && <>
          <div className="admin-heading"><div><SectionEyebrow>OPERATIONS NETWORK</SectionEyebrow><DisplayHeading as="h1">Partners.</DisplayHeading><p>Try managing sample vehicle suppliers and chauffeurs.</p></div></div>
          <div className="admin-partner-grid"><section className="admin-partner-panel"><h2><Truck size={18}/> Vehicle suppliers <span>{suppliers.length}</span></h2>
            {suppliers.map(p => <div className="admin-partner-line" key={p.id}><strong>{p.name}</strong><small>Sample entry</small></div>)}
            <form className="admin-stack" onSubmit={addSupplier}><label>Supplier name<input required placeholder="Enter a supplier" value={supplierName} onChange={e => setSupplierName(e.target.value)}/></label><button className="admin-secondary" type="submit">Add supplier <ArrowRight size={14}/></button></form>
          </section><section className="admin-partner-panel"><h2><UserRound size={18}/> Chauffeurs <span>{drivers.length}</span></h2>
            {drivers.map(p => <div className="admin-partner-line" key={p.id}><strong>{p.name}</strong><small>Sample entry</small></div>)}
            <form className="admin-stack" onSubmit={addDriver}><label>Chauffeur name<input required placeholder="Enter a chauffeur" value={driverName} onChange={e => setDriverName(e.target.value)}/></label><button className="admin-secondary" type="submit">Add chauffeur <ArrowRight size={14}/></button></form>
          </section></div>
        </>}
        {view === 'payments' && <>
          <div className="admin-heading"><div><SectionEyebrow>PAYMENT CONTROL</SectionEyebrow><DisplayHeading as="h1">Payments.</DisplayHeading><p>Simulate manual deposit and settlement updates.</p></div></div>
          <section className="admin-partner-panel admin-preview-payments">
            <h2>Payment overview <span>Sample data</span></h2>
            {bookings.map(b => <div className="admin-preview-payment-row" key={b.id}><div><strong>{b.reference}</strong><small>{b.guest} · {b.method}</small></div><div><small>{money(b.paid)} / {money(b.total)}</small><button className="admin-secondary" onClick={() => updateBooking(b.id, {paid:b.total}, 'Payment marked as paid')} disabled={b.paid===b.total}>Mark paid</button></div></div>)}
            <form onSubmit={e => {e.preventDefault(); if (!paymentInput) return; const amount = Math.min(selected.total, Math.max(0, Number(paymentInput))); updateBooking(selected.id, {paid:amount}, 'Payment amount updated'); setPaymentInput('')}} className="admin-stack admin-preview-payment-form">
              <label>Selected booking<select value={selectedId} onChange={e=>setSelectedId(e.target.value)}>{bookings.map(b=><option value={b.id} key={b.id}>{b.reference}</option>)}</select></label>
              <label>Sample amount received (KRW)<input type="number" min="0" max={selected.total} value={paymentInput} onChange={e=>setPaymentInput(e.target.value)} placeholder="0" required/></label>
              <button className="admin-secondary" type="submit">Update sample payment <Check size={14}/></button>
            </form>
          </section>
        </>}
      </div>
    </main>
  </div>
}
