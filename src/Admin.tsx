import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { ArrowRight, CalendarDays, Check, ChevronDown, CircleDollarSign, ClipboardList, LogOut, Plus, RefreshCw, Search, ShieldCheck, Truck, UserRound, X } from 'lucide-react'
import DisplayHeading from './components/ui/DisplayHeading'
import SectionEyebrow from './components/ui/SectionEyebrow'
import './admin.css'

type Session = { access_token:string; refresh_token:string }
type Reservation = { id:string; reference:string; customer_name:string; customer_email:string; customer_phone:string; status:string; customer_type:string; quoted_total:number|null; quote_required:boolean; created_at:string; contact_method:string; messenger_contact:string|null; request_payload:Record<string,unknown> }
type Day = { id:string; reservation_id:string; position:number; service_date:string; pickup_time:string; service_code:string; vehicle_class:string; pickup_address:string; destination_address:string; flight_number:string|null; quoted_amount:number|null }
type Assignment = {id:string;reservation_day_id:string;status:string;supplier_id:string|null;driver_id:string|null;vehicle_cost:number|null;driver_cost:number|null;vehicle_identifier:string|null}
type Supplier = {id:string;company_name:string;contact_name:string|null;contact_phone:string|null;contact_email:string|null}
type Driver = {id:string;full_name:string;phone:string|null;email:string|null;supplier_id:string|null}
type Payment = {id:string;reservation_id:string;kind:string;method:string;status:string;amount:number;created_at:string}
type Expense = {id:string;reservation_id:string;amount:number;category:string}
type Snapshot = {role:string;reservations:Reservation[];days:Day[];assignments:Assignment[];suppliers:Supplier[];drivers:Driver[];payments:Payment[];expenses:Expense[]}

const DB_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined
const PUBLIC_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined
const STATUS = ['requested','reviewing','quoted','awaiting_deposit','confirmed','in_progress','completed','cancelled','declined']
const money=(v:number|null|undefined)=>v==null?'Quote required':new Intl.NumberFormat('en-US',{style:'currency',currency:'KRW',maximumFractionDigits:0}).format(v)
const date=(v:string)=>new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'short',year:'numeric',timeZone:'Asia/Seoul'}).format(new Date(v))
const statusLabel=(v:string)=>v.replaceAll('_',' ').replace(/\b\w/g,s=>s.toUpperCase())
const safeSession=():Session|null=>{try{const raw=sessionStorage.getItem('chauffeur-admin-session');return raw?JSON.parse(raw) as Session:null}catch{return null}}
const Empty=({children}:{children:ReactNode})=><div className="admin-empty">{children}</div>
function SignIn({onSignedIn}:{onSignedIn:(s:Session)=>void}) {
  const [email,setEmail]=useState('')
  const [password,setPassword]=useState('')
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const submit=async(e:React.FormEvent)=>{
    e.preventDefault();setError('')
    if(!DB_URL||!PUBLIC_KEY){setError('Supabase is not configured for this environment.');return}
    setBusy(true)
    try{
      const response=await fetch(DB_URL+'/auth/v1/token?grant_type=password',{
        method:'POST',headers:{apikey:PUBLIC_KEY,'Content-Type':'application/json'},
        body:JSON.stringify({email,password})
      })
      const data=await response.json()
      if(!response.ok||!data.access_token||!data.refresh_token)throw new Error('Email or password was not accepted.')
      onSignedIn({access_token:data.access_token,refresh_token:data.refresh_token})
    }catch(err){setError(err instanceof Error?err.message:'Sign in failed.')}
    finally{setBusy(false)}
  }
  return <main className="admin-root admin-login">
    <div className="admin-login-card">
      <div className="admin-logo"><img src="/media/brand/chauffeur-mark.png" alt="" /><span>CHAUFFEUR <small>OPERATIONS</small></span></div>
      <SectionEyebrow>PRIVATE ACCESS</SectionEyebrow>
      <DisplayHeading as="h1">Welcome back.</DisplayHeading>
      <p>Sign in with your authorized operations account.</p>
      <form onSubmit={submit} className="admin-stack">
        <label>Email<input type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)} /></label>
        <label>Password<input type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)} /></label>
        {error&&<p className="admin-error" role="alert">{error}</p>}
        <button disabled={busy} className="admin-primary" type="submit">{busy?'Signing in…':'Sign in'} <ArrowRight size={15}/></button>
      </form>
      <a className="admin-back" href="/">Return to the website</a>
    </div>
  </main>
}
export default function Admin(){
  const [session,setSession]=useState<Session|null>(safeSession)
  const [snapshot,setSnapshot]=useState<Snapshot|null>(null)
  const [loading,setLoading]=useState(false)
  const [message,setMessage]=useState('')
  const [error,setError]=useState('')
  const [selectedId,setSelectedId]=useState('')
  const [search,setSearch]=useState('')
  const [filter,setFilter]=useState('all')
  const [tab,setTab]=useState<'reservations'|'suppliers'>('reservations')
  const [supplierName,setSupplierName]=useState('')
  const [driverName,setDriverName]=useState('')
  const [driverPhone,setDriverPhone]=useState('')
  const [driverSupplier,setDriverSupplier]=useState('')
  const [pending,setPending]=useState(false)
  const [assignForm,setAssignForm]=useState<Record<string,string>>({})
  const [paymentAmount,setPaymentAmount]=useState('')
  const [paymentKind,setPaymentKind]=useState('deposit')
  const [paymentMethod,setPaymentMethod]=useState('bank_transfer')
  const [paymentStatus,setPaymentStatus]=useState('requested')
  const signOut=()=>{sessionStorage.removeItem('chauffeur-admin-session');setSession(null);setSnapshot(null);setSelectedId('')}
  const api=useCallback(async(method:'GET'|'POST',body?:unknown)=>{
    if(!session)throw new Error('Please sign in.')
    const response=await fetch('/api/admin',{
      method,headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token},
      ...(body?{body:JSON.stringify(body)}:{})
    })
    if(response.status===401){signOut();throw new Error('Your session has expired. Please sign in again.')}
    const data=await response.json()
    if(!response.ok)throw new Error(data.error||'This operation could not be completed.')
    return data
  },[session])
  const refresh=useCallback(async()=>{
    if(!session)return
    setLoading(true);setError('')
    try{
      const data=await api('GET') as Snapshot
      setSnapshot(data)
      setSelectedId(prev=>prev||data.reservations?.[0]?.id||'')
    }catch(err){setError(err instanceof Error?err.message:'Could not load reservations.')}
    finally{setLoading(false)}
  },[api,session])
  useEffect(()=>{void refresh()},[refresh])
  const signedIn=(s:Session)=>{sessionStorage.setItem('chauffeur-admin-session',JSON.stringify(s));setSession(s);setSnapshot(null)}
  const mutation=async(body:Record<string,unknown>,success:string)=>{
    setPending(true);setError('');setMessage('')
    try{await api('POST',body);setMessage(success);await refresh()}
    catch(err){setError(err instanceof Error?err.message:'Operation failed.')}
    finally{setPending(false)}
  }
  const reservations=snapshot?.reservations||[]
  const filtered=useMemo(()=>reservations.filter(r=>
    (filter==='all'||r.status===filter)&&
    [r.reference,r.customer_name,r.customer_email].some(v=>v.toLowerCase().includes(search.toLowerCase()))
  ),[reservations,search,filter])
  const selected=reservations.find(r=>r.id===selectedId)||null
  const days=(snapshot?.days||[]).filter(d=>d.reservation_id===selectedId).sort((a,b)=>a.position-b.position)
  const payments=(snapshot?.payments||[]).filter(p=>p.reservation_id===selectedId)
  const expenses=(snapshot?.expenses||[]).filter(e=>e.reservation_id===selectedId)
  const canOperate=!!snapshot&&['owner','admin','operator'].includes(snapshot.role)
  const canFinance=!!snapshot&&['owner','admin','finance'].includes(snapshot.role)
  const stats=[
    {label:'New requests',value:reservations.filter(r=>r.status==='requested').length},
    {label:'In review',value:reservations.filter(r=>['reviewing','quoted','awaiting_deposit'].includes(r.status)).length},
    {label:'Confirmed',value:reservations.filter(r=>r.status==='confirmed').length},
    {label:'Completed',value:reservations.filter(r=>r.status==='completed').length}
  ]
  if(!session)return <SignIn onSignedIn={signedIn}/>
  return <div className="admin-root">
    <aside className="admin-sidebar">
      <div className="admin-logo"><img src="/media/brand/chauffeur-mark.png" alt="" /><span>CHAUFFEUR <small>OPERATIONS</small></span></div>
      <p className="admin-sidebar-eyebrow">WORKSPACE</p>
      <button className={tab==='reservations'?'selected':''} onClick={()=>setTab('reservations')}><ClipboardList size={16}/> Reservations</button>
      <button className={tab==='suppliers'?'selected':''} onClick={()=>setTab('suppliers')}><Truck size={16}/> Suppliers & drivers</button>
      <div className="admin-sidebar-bottom"><span><ShieldCheck size={14}/> {snapshot?.role||'Verifying'}</span><button onClick={signOut}><LogOut size={15}/> Sign out</button><a href="/">View customer website <ArrowRight size={13}/></a></div>
    </aside>
    <main className="admin-main">
      <header className="admin-topbar"><span>CHAUFFEUR / {tab==='reservations'?'RESERVATIONS':'PARTNERS'}</span><button onClick={()=>void refresh()} disabled={loading}><RefreshCw size={14}/> Refresh</button></header>
      <div className="admin-content">
        {error&&<div className="admin-error admin-banner" role="alert">{error}<button aria-label="Dismiss" onClick={()=>setError('')}><X size={14}/></button></div>}
        {message&&<div className="admin-success admin-banner" role="status">{message}<button aria-label="Dismiss" onClick={()=>setMessage('')}><X size={14}/></button></div>}
        {tab==='reservations'?<>
          <div className="admin-heading"><div><SectionEyebrow>THE OPERATIONS DESK</SectionEyebrow><DisplayHeading as="h1">Reservations.</DisplayHeading><p>Manage every journey from request to final confirmation.</p></div><span className="admin-count">{reservations.length} requests</span></div>
          <div className="admin-stats">{stats.map(s=><div key={s.label}><span>{s.label}</span><strong>{s.value}</strong></div>)}</div>
          <div className="admin-board">
            <section className="admin-list">
              <div className="admin-panel-heading"><h2>Booking requests</h2><span>Latest 150</span></div>
              <div className="admin-filters"><div className="admin-search"><Search size={15}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search guest or reference" aria-label="Search reservations"/></div><div className="admin-select-wrap"><select value={filter} onChange={e=>setFilter(e.target.value)} aria-label="Filter by status"><option value="all">All statuses</option>{STATUS.map(s=><option key={s} value={s}>{statusLabel(s)}</option>)}</select><ChevronDown size={14}/></div></div>
              {loading&&!snapshot?<Empty>Loading reservations…</Empty>:filtered.length===0?<Empty>No reservations to display.</Empty>:<div className="admin-booking-list">{filtered.map(r=><button key={r.id} className={'admin-booking '+(selectedId===r.id?'active':'')} onClick={()=>setSelectedId(r.id)}><div><strong>{r.reference}</strong><span>{r.customer_name}</span></div><div className="admin-booking-right"><span className={'admin-status '+r.status}>{statusLabel(r.status)}</span><small>{date(r.created_at)}</small></div></button>)}</div>}
            </section>
            <section className="admin-detail">
              {!selected?<Empty>Choose a booking to see its itinerary and operations details.</Empty>:<>
                <div className="admin-panel-heading"><div><span className="admin-eyebrow">RESERVATION DETAILS</span><h2>{selected.reference}</h2></div><span className={'admin-status '+selected.status}>{statusLabel(selected.status)}</span></div>
                <div className="admin-detail-scroll">
                  <div className="admin-section"><h3>Guest</h3><div className="admin-info-grid"><div><small>NAME</small><strong>{selected.customer_name}</strong></div><div><small>PHONE</small><strong>{selected.customer_phone}</strong></div><div className="wide"><small>EMAIL</small><strong>{selected.customer_email}</strong></div></div></div>
                  <div className="admin-section"><h3>Reservation status</h3><div className="admin-inline"><select aria-label="Reservation status" disabled={!canOperate||pending} value={selected.status} onChange={e=>void mutation({action:'status',reservation_id:selected.id,status:e.target.value},'Reservation updated.')}>{STATUS.map(s=><option key={s} value={s}>{statusLabel(s)}</option>)}</select><span>{canOperate?'Changes save immediately':'View only'}</span></div></div>
                  <div className="admin-section"><h3><CalendarDays size={16}/> Journey days <span>{days.length}</span></h3>{days.map(d=>{
                    const a=snapshot?.assignments.find(a=>a.reservation_day_id===d.id)
                    const f=assignForm[d.id]||''
                    const format=(field:string,fallback:string)=> f?JSON.parse(f)[field]??fallback:fallback
                    return <div className="admin-day" key={d.id}>
                      <div className="admin-day-top"><span>DAY {String(d.position).padStart(2,'0')}</span><strong>{d.service_date} · {d.pickup_time.slice(0,5)}</strong></div>
                      <h4>{d.vehicle_class.replaceAll('_',' ')} · {d.service_code}</h4>
                      <p>{d.pickup_address} <ArrowRight size={12}/> {d.destination_address}</p>
                      {d.flight_number&&<small>Flight: {d.flight_number}</small>}
                      <div className="admin-assign"><span className="admin-eyebrow">VEHICLE & CHAUFFEUR ASSIGNMENT</span>
                        <div className="admin-field-grid"><label>Vehicle supplier<select disabled={!canOperate||pending} value={format('supplier_id',a?.supplier_id||'')} onChange={e=>setAssignForm(v=>({...v,[d.id]:JSON.stringify({...JSON.parse(v[d.id]||'{}'),supplier_id:e.target.value})}))}><option value="">Not assigned</option>{snapshot?.suppliers.map(s=><option key={s.id} value={s.id}>{s.company_name}</option>)}</select></label>
                        <label>Chauffeur<select disabled={!canOperate||pending} value={format('driver_id',a?.driver_id||'')} onChange={e=>setAssignForm(v=>({...v,[d.id]:JSON.stringify({...JSON.parse(v[d.id]||'{}'),driver_id:e.target.value})}))}><option value="">Not assigned</option>{snapshot?.drivers.map(dr=><option key={dr.id} value={dr.id}>{dr.full_name}</option>)}</select></label>
                        <label>Assignment status<select disabled={!canOperate||pending} value={format('status',a?.status||'sourcing')} onChange={e=>setAssignForm(v=>({...v,[d.id]:JSON.stringify({...JSON.parse(v[d.id]||'{}'),status:e.target.value})}))}>{['sourcing','proposed','assigned','confirmed','completed','cancelled'].map(s=><option key={s} value={s}>{statusLabel(s)}</option>)}</select></label>
                        <label>Vehicle cost (KRW)<input disabled={!canOperate||pending} type="number" min="0" placeholder="—" value={format('vehicle_cost',a?.vehicle_cost?.toString()||'')} onChange={e=>setAssignForm(v=>({...v,[d.id]:JSON.stringify({...JSON.parse(v[d.id]||'{}'),vehicle_cost:e.target.value})}))}/></label>
                        <label>Driver cost (KRW)<input disabled={!canOperate||pending} type="number" min="0" placeholder="—" value={format('driver_cost',a?.driver_cost?.toString()||'')} onChange={e=>setAssignForm(v=>({...v,[d.id]:JSON.stringify({...JSON.parse(v[d.id]||'{}'),driver_cost:e.target.value})}))}/></label></div>
                        {canOperate&&<button className="admin-secondary" disabled={pending} onClick={()=>void mutation({action:'assignment',reservation_day_id:d.id,supplier_id:format('supplier_id',a?.supplier_id||''),driver_id:format('driver_id',a?.driver_id||''),status:format('status',a?.status||'sourcing'),vehicle_cost:format('vehicle_cost',a?.vehicle_cost?.toString()||''),driver_cost:format('driver_cost',a?.driver_cost?.toString()||'')},'Assignment saved.')}>Save assignment <Check size={14}/></button>}
                      </div>
                    </div>
                  })}</div>
                  <div className="admin-section"><h3><CircleDollarSign size={16}/> Payment & settlement</h3><div className="admin-money"><span>Quoted total</span><strong>{money(selected.quoted_total)}</strong></div>{canFinance&&<><div className="admin-money"><span>Payments received</span><strong>{money(payments.filter(p=>p.status==='paid'&&p.kind!=='refund').reduce((n,p)=>n+Number(p.amount),0))}</strong></div><div className="admin-money"><span>Recorded expenses</span><strong>{money(expenses.reduce((n,p)=>n+Number(p.amount),0))}</strong></div><div className="admin-payments">{payments.map(p=><div key={p.id}><span>{statusLabel(p.kind)} · {p.method.replaceAll('_',' ')}</span><strong>{money(p.amount)}</strong><span className={'admin-status '+p.status}>{statusLabel(p.status)}</span></div>)}</div>
                    <form className="admin-payment-form" onSubmit={e=>{e.preventDefault();void mutation({action:'payment',reservation_id:selected.id,kind:paymentKind,method:paymentMethod,status:paymentStatus,amount:paymentAmount},'Payment record added.')}}><div className="admin-field-grid"><label>Type<select value={paymentKind} onChange={e=>setPaymentKind(e.target.value)}>{['deposit','balance','full','refund','adjustment'].map(v=><option key={v} value={v}>{statusLabel(v)}</option>)}</select></label><label>Method<select value={paymentMethod} onChange={e=>setPaymentMethod(e.target.value)}>{['bank_transfer','paypal_invoice','international_wire','other'].map(v=><option key={v} value={v}>{statusLabel(v)}</option>)}</select></label><label>Status<select value={paymentStatus} onChange={e=>setPaymentStatus(e.target.value)}>{['requested','pending','paid'].map(v=><option key={v} value={v}>{statusLabel(v)}</option>)}</select></label><label>Amount (KRW)<input type="number" min="0" required value={paymentAmount} onChange={e=>setPaymentAmount(e.target.value)}/></label></div><button className="admin-secondary" disabled={pending} type="submit"><Plus size={14}/> Add payment record</button></form>
                  </>}</div>
                </div>
              </>}
            </section>
          </div>
        </>:<>
          <div className="admin-heading"><div><SectionEyebrow>OPERATIONS NETWORK</SectionEyebrow><DisplayHeading as="h1">Partners.</DisplayHeading><p>Maintain your vehicle suppliers and professional chauffeurs.</p></div></div>
          <div className="admin-partner-grid">
            <section className="admin-partner-panel"><h2><Truck size={18}/> Vehicle suppliers <span>{snapshot?.suppliers.length||0}</span></h2>{snapshot?.suppliers.map(s=><div className="admin-partner-line" key={s.id}><strong>{s.company_name}</strong><small>{s.contact_name||s.contact_phone||'Contact not set'}</small></div>)}{snapshot?.suppliers.length===0&&<Empty>No suppliers yet.</Empty>}{canOperate&&<form className="admin-stack" onSubmit={e=>{e.preventDefault();void mutation({action:'supplier',company_name:supplierName},'Supplier added.');setSupplierName('')}}><label>New supplier name<input value={supplierName} onChange={e=>setSupplierName(e.target.value)} required placeholder="Vehicle company"/></label><button className="admin-secondary" type="submit" disabled={pending}><Plus size={14}/> Add supplier</button></form>}</section>
            <section className="admin-partner-panel"><h2><UserRound size={18}/> Chauffeurs <span>{snapshot?.drivers.length||0}</span></h2>{snapshot?.drivers.map(d=><div className="admin-partner-line" key={d.id}><strong>{d.full_name}</strong><small>{d.phone||'Phone not set'}</small></div>)}{snapshot?.drivers.length===0&&<Empty>No chauffeurs yet.</Empty>}{canOperate&&<form className="admin-stack" onSubmit={e=>{e.preventDefault();void mutation({action:'driver',full_name:driverName,phone:driverPhone,supplier_id:driverSupplier},'Chauffeur added.');setDriverName('');setDriverPhone('')}}><label>Chauffeur name<input value={driverName} onChange={e=>setDriverName(e.target.value)} required placeholder="Full name"/></label><label>Phone<input value={driverPhone} onChange={e=>setDriverPhone(e.target.value)} placeholder="+82 ..."/></label><label>Affiliated supplier<select value={driverSupplier} onChange={e=>setDriverSupplier(e.target.value)}><option value="">Independent</option>{snapshot?.suppliers.map(s=><option key={s.id} value={s.id}>{s.company_name}</option>)}</select></label><button className="admin-secondary" type="submit" disabled={pending}><Plus size={14}/> Add chauffeur</button></form>}</section>
          </div>
        </>}
      </div>
    </main>
  </div>
}
