import { useState } from 'react'
import { ArrowRight, CalendarDays, ChevronLeft, ChevronRight, ClipboardList, Mail } from 'lucide-react'
import DisplayHeading from './components/ui/DisplayHeading'
import SectionEyebrow from './components/ui/SectionEyebrow'
import { bookingStatusKo, serviceKo, vehicleKo } from './admin-locale'
export type BoardReservation={id:string;reference:string;customer_name:string;status:string}
export type BoardDay={id:string;reservation_id:string;service_date:string;pickup_time:string;service_code:string;vehicle_class:string;pickup_address:string;destination_address:string}
export type BoardDelivery={reservation_id:string;status:string}
const key=(y:number,m:number,d:number)=>[y,String(m+1).padStart(2,'0'),String(d).padStart(2,'0')].join('-')
export const todayKst=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
const active=new Set(['confirmed','in_progress'])
export default function AdminSchedule({mode,reservations,days,deliveries,openBooking,openFilter,loading}:{
 mode:'home'|'calendar';reservations:BoardReservation[];days:BoardDay[];deliveries:BoardDelivery[];
 openBooking:(id:string)=>void;openFilter:(status:string)=>void;loading:boolean
}){
 const today=todayKst()
 const [date,setDate]=useState(today)
 const [year,month]=date.split('-').map(Number)
 const [view,setView]=useState({year,month:month-1})
 const byId=new Map(reservations.map(r=>[r.id,r]))
 const live=days.filter(d=>{const r=byId.get(d.reservation_id);return r&&!['cancelled','declined'].includes(r.status)})
 const sorted=(rows:BoardDay[])=>[...rows].sort((a,b)=>(a.service_date+a.pickup_time).localeCompare(b.service_date+b.pickup_time))
 const todayRows=sorted(live.filter(d=>d.service_date===today&&active.has(byId.get(d.reservation_id)!.status)))
 const upcoming=sorted(live.filter(d=>d.service_date>today&&active.has(byId.get(d.reservation_id)!.status)))
 const selectedRows=sorted(live.filter(d=>d.service_date===date))
 const mail=deliveries.filter(d=>['failed','pending','sending','uncertain'].includes(d.status)&&active.has(byId.get(d.reservation_id)?.status||''))
 const missing=reservations.filter(r=>r.status==='confirmed'&&!deliveries.some(d=>d.reservation_id===r.id))
 const fresh=reservations.filter(r=>r.status==='requested')
 const review=reservations.filter(r=>['reviewing','quoted','awaiting_deposit'].includes(r.status))
 const changeMonth=(step:number)=>{
   const next=new Date(Date.UTC(view.year,view.month+step,1))
   setView({year:next.getUTCFullYear(),month:next.getUTCMonth()});setDate(key(next.getUTCFullYear(),next.getUTCMonth(),1))
 }
 const dayCount=new Date(Date.UTC(view.year,view.month+1,0)).getUTCDate()
 const offset=(new Date(Date.UTC(view.year,view.month,1)).getUTCDay()+6)%7
 const row=(d:BoardDay)=>{
  const r=byId.get(d.reservation_id)!
  return <button className="admin-schedule-row" key={d.id} onClick={()=>openBooking(r.id)}>
    <span className="admin-schedule-time">{d.service_date.slice(5)} · {d.pickup_time.slice(0,5)}</span>
    <span className="admin-schedule-info"><strong>{r.customer_name} · {vehicleKo(d.vehicle_class)}</strong><span className={'admin-schedule-tone '+d.service_code}>{serviceKo(d.service_code)}</span><small>{d.pickup_address} → {d.destination_address}</small></span>
    <span className="admin-status">{bookingStatusKo[r.status]||r.status}</span><ArrowRight size={14}/>
  </button>
 }
 if(loading&&!reservations.length)return <div className="admin-empty">예약을 불러오고 있어요…</div>
 return <>
  <div className="admin-heading"><div><SectionEyebrow>운영 일정</SectionEyebrow><DisplayHeading as="h1">{mode==='home'?'오늘의 업무':'운행 일정'}</DisplayHeading><p>{mode==='home'?'새 예약과 필요한 안내를 놓치지 마세요.':'날짜를 선택하면 해당 일정을 확인할 수 있어요.'}</p></div></div>
  {mode==='home'?<>
    <div className="admin-stats">{[['새 예약',fresh.length],['오늘의 운행',todayRows.length],['다가오는 운행',upcoming.length]].map(([label,n])=><div key={label}><span>{label}</span><strong>{n}</strong></div>)}</div>
    <section className="admin-ops-panel"><h2>지금 확인해 주세요</h2>
      <button className="admin-task-row" onClick={()=>openFilter('requested')}><ClipboardList size={17}/><span>새 예약</span><strong>{fresh.length}건</strong><ArrowRight size={14}/></button>
      <button className="admin-task-row" onClick={()=>openFilter('reviewing')}><ClipboardList size={17}/><span>확인 중인 예약</span><strong>{review.length}건</strong><ArrowRight size={14}/></button>
      {[...mail.map(d=>d.reservation_id),...missing.map(r=>r.id)].map(id=><button className="admin-task-row" key={id} onClick={()=>openBooking(id)}><Mail size={17}/><span>확정 이메일 확인 · {byId.get(id)?.reference}</span><ArrowRight size={14}/></button>)}
      {!mail.length&&!missing.length&&<p className="admin-ko-caption">확인할 확정 이메일이 없어요.</p>}
    </section>
    <section className="admin-ops-panel"><h2>오늘의 운행 · {today}</h2>{todayRows.length?todayRows.map(row):<p className="admin-ko-caption">오늘 예정된 확정 일정이 없어요.</p>}</section>
    <section className="admin-ops-panel"><h2>다가오는 운행</h2>{upcoming.length?upcoming.slice(0,8).map(row):<p className="admin-ko-caption">예정된 확정 일정이 없어요.</p>}</section>
  </>:<section className="admin-ops-panel">
    <div className="admin-calendar-header"><h2><CalendarDays size={17}/> {view.year}년 {view.month+1}월</h2><div><button aria-label="이전 달" onClick={()=>changeMonth(-1)}><ChevronLeft size={17}/></button><button onClick={()=>{setView({year:Number(today.slice(0,4)),month:Number(today.slice(5,7))-1});setDate(today)}}>오늘</button><button aria-label="다음 달" onClick={()=>changeMonth(1)}><ChevronRight size={17}/></button></div></div>
    <div className="admin-calendar-grid">{['월','화','수','목','금','토','일'].map(d=><span key={d} className="admin-calendar-weekday">{d}</span>)}
      {Array.from({length:offset},(_,i)=><span key={'blank'+i}/>)}
      {Array.from({length:dayCount},(_,i)=>{
        const day=key(view.year,view.month,i+1),rows=live.filter(d=>d.service_date===day)
        return <button key={day} aria-label={day+' '+rows.length+'건'} aria-pressed={date===day} className={date===day?'is-selected':''} onClick={()=>setDate(day)}><span>{i+1}</span>{rows.length>0&&<small>{rows.length}건</small>}<span className="admin-calendar-lines">{['airport','day','hourly'].filter(s=>rows.some(d=>d.service_code===s)).map(s=><i key={s} className={s}/>)}</span></button>
      })}
    </div>
    <h2>{date} 일정 · {selectedRows.length}건</h2>{selectedRows.length?selectedRows.map(row):<p className="admin-ko-caption">등록된 일정이 없어요.</p>}
  </section>}
  <p className="admin-ko-caption">최근 불러온 예약 기준 · 한국 시간(KST) · 캘린더에는 미확정 요청도 표시돼요.</p>
 </>
}
