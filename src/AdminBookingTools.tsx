import type { FormEvent } from 'react'
import { useState } from 'react'
import catalog from './catalog.json'
import { serviceKo, vehicleKo, dateKo } from './admin-locale'
export type EditReservation={id:string;reference:string;customer_name:string;customer_email:string;customer_phone:string;tax_included:boolean|null;updated_at:string;internal_note:string|null}
export type EditDay={id:string;service_date:string;pickup_time:string;service_code:string;vehicle_class:string;pickup_address:string;destination_address:string;flight_number:string|null;quoted_amount:number|null;stops?:Array<{location:string;place?:{name?:string}}>}
type Save=(patch:Record<string,unknown>)=>Promise<boolean>
const val=(f:FormData,k:string)=>String(f.get(k)??'').trim()
export function EditContact({reservation:r,save,busy}:{reservation:EditReservation;save:Save;busy:boolean}){
 const submit=(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();const f=new FormData(e.currentTarget);void save({kind:'contact',name:val(f,'name'),email:val(f,'email'),phone:val(f,'phone')})}
 return <details className="admin-edit-details"><summary>고객 정보 수정</summary><form className="admin-edit-form" onSubmit={submit}>
  <label>예약자<input name="name" required minLength={2} maxLength={100} defaultValue={r.customer_name}/></label>
  <label>이메일<input name="email" type="email" required maxLength={180} defaultValue={r.customer_email}/></label>
  <label>전화번호<input name="phone" type="tel" required maxLength={40} defaultValue={r.customer_phone}/></label>
  <button className="admin-secondary" disabled={busy}>저장하기</button>
 </form></details>
}
export function EditJourney({day:d,reservation:r,save,busy}:{day:EditDay;reservation:EditReservation;save:Save;busy:boolean}){
 const submit=(e:FormEvent<HTMLFormElement>)=>{
   e.preventDefault();const f=new FormData(e.currentTarget)
   void save({kind:'day',day_id:d.id,date:val(f,'date'),time:val(f,'time'),service:val(f,'service'),vehicle:val(f,'vehicle'),pickup:val(f,'pickup'),destination:val(f,'destination'),flight:val(f,'flight'),amount:Number(val(f,'amount')),tax_included:val(f,'tax')==='included'})
 }
 return <details className="admin-edit-details"><summary>일정 및 요금 수정</summary><form className="admin-edit-form" onSubmit={submit}>
   <div className="admin-edit-grid"><label>날짜<input name="date" type="date" required defaultValue={d.service_date}/></label><label>출발 시간 (KST)<input name="time" type="time" required defaultValue={d.pickup_time.slice(0,5)}/></label></div>
   <div className="admin-edit-grid"><label>서비스<select name="service" defaultValue={d.service_code}>{catalog.services.filter(s=>s.id!=='hourly'||s.id===d.service_code).map(s=><option key={s.id} value={s.id}>{serviceKo(s.id)}</option>)}</select></label><label>차량<select name="vehicle" defaultValue={d.vehicle_class}>{catalog.vehicles.map(v=><option key={v.id} value={v.id}>{vehicleKo(v.id)}</option>)}</select></label></div>
   <label>출발지<input name="pickup" required maxLength={500} defaultValue={d.pickup_address}/></label>
   <label>목적지<input name="destination" required maxLength={500} defaultValue={d.destination_address}/></label>
   <label>항공편<input name="flight" maxLength={30} defaultValue={d.flight_number||''}/></label>
   <div className="admin-edit-grid"><label>이 날짜의 최종 요금 (원)<input name="amount" type="number" min={0} max={999999999999} step={1} required defaultValue={d.quoted_amount??''}/></label><label>전체 예약 세금 조건<select name="tax" required defaultValue={r.tax_included==null?'':r.tax_included?'included':'excluded'}><option value="" disabled>선택해 주세요</option><option value="included">세금 포함</option><option value="excluded">세금 별도</option></select></label></div>
   <p className="admin-ko-caption">고객과 협의한 날짜별 금액을 입력해 주세요. 총액은 날짜별 금액을 합산해 다시 계산해요. 기존 경유지는 유지돼요.</p>
   <button className="admin-secondary" disabled={busy}>변경 사항 저장</button>
 </form></details>
}
const historyLabels:Record<string,string>={'reservation.status_changed':'예약 상태 변경','reservation.day_updated':'이동 일정 및 요금 수정','reservation.contact_updated':'고객 정보 수정','reservation.note_updated':'운영 메모 수정','confirmation.queued':'확정 이메일 등록','reservation.created':'예약 접수'}
export function AdminNotes({reservation:r,save,loadHistory,busy,canEdit}:{reservation:EditReservation;save:Save;loadHistory:()=>Promise<Array<{event_type:string;created_at:string}>>;busy:boolean;canEdit:boolean}){
 const [history,setHistory]=useState<Array<{event_type:string;created_at:string}>|null>(null)
 const [error,setError]=useState('')
 const [loading,setLoading]=useState(false)
 return <section className="admin-section"><h3>운영 메모</h3>
  {canEdit?<form className="admin-edit-form" onSubmit={e=>{e.preventDefault();void save({kind:'note',note:val(new FormData(e.currentTarget),'note')}).then(ok=>{if(ok)setHistory(null)})}}>
    <label>관리자만 볼 수 있어요<textarea name="note" maxLength={4000} defaultValue={r.internal_note||''} placeholder="고객 요청이나 확인할 사항을 적어 주세요." rows={3}/></label>
    <button className="admin-secondary" disabled={busy}>메모 저장</button>
  </form>:<p>{r.internal_note||'아직 메모가 없어요.'}</p>}
  <div className="admin-history"><button className="admin-text-link" disabled={loading} onClick={async()=>{if(history){setHistory(null);return}setLoading(true);setError('');try{setHistory(await loadHistory())}catch{setError('처리 이력을 불러오지 못했어요.')}finally{setLoading(false)}}}>{history?'처리 이력 닫기':loading?'불러오고 있어요…':'처리 이력 보기'}</button>
   {error&&<p role="alert">{error}</p>}
   {history&&(!history.length?<p className="admin-ko-caption">아직 기록된 이력이 없어요.</p>:history.map((h,i)=><div className="admin-history-row" key={h.created_at+i}><span>{historyLabels[h.event_type]||h.event_type}</span><small>{dateKo(h.created_at)}</small></div>))}
  </div>
 </section>
}
export function dispatchSummary(reference:string,days:EditDay[]){
 return ['■ Chauffeur 운행 요청','예약번호: '+reference,...days.flatMap((d,i)=>[
  '', 'DAY '+String(i+1).padStart(2,'0')+' · '+d.service_date+' '+d.pickup_time.slice(0,5)+' KST',
  '서비스: '+serviceKo(d.service_code),'차종: '+vehicleKo(d.vehicle_class),
  '출발지: '+d.pickup_address,...(d.stops||[]).map(s=>'경유지: '+(s.place?.name||s.location)),
  '목적지: '+d.destination_address,...(d.flight_number?['항공편: '+d.flight_number]:[])
 ]),'','배차 가능 여부 확인 부탁드립니다.'].join('\n')
}
