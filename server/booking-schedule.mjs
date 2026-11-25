import { db, ApiError, validUuid } from './chauffeur-supabase.mjs'
const validDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s
export async function scheduleWindow(from,to){
 if(!validDate(from)||!validDate(to)||from>to||(Date.parse(to)-Date.parse(from))/86400000>62)
  throw new ApiError(400,'조회할 날짜 범위를 다시 확인해 주세요.')
 const query='reservation_days?select=id,reservation_id,position,service_date,pickup_time,service_code,vehicle_class,pickup_address,destination_address,reservations!inner(id,reference,status,customer_name)&service_date=gte.'+from+'&service_date=lte.'+to+'&reservations.status=in.(requested,reviewing,quoted,awaiting_deposit,confirmed,in_progress,completed)&order=service_date.asc,pickup_time.asc,id.asc'
 const result=[]
 for(let offset=0;offset<10000;offset+=500){
  const rows=await db(query+'&limit=500&offset='+offset)
  if(!Array.isArray(rows))throw new ApiError(502,'운행 일정을 불러오지 못했어요.')
  result.push(...rows)
  if(rows.length<500)return result
 }
 throw new ApiError(409,'조회할 일정이 너무 많아요. 기간을 줄여 주세요.')
}
export async function bookingDetail(id){
 if(!validUuid(id))throw new ApiError(400,'예약을 다시 선택해 주세요.')
 const [reservations,days,deliveries,notifications]=await Promise.all([
  db('reservations?select=*&id=eq.'+id+'&limit=1'),
  db('reservation_days?select=*&reservation_id=eq.'+id+'&order=position.asc&limit=366'),
  db('confirmation_deliveries?select=reservation_id,status,attempts,sent_at,claimed_at&reservation_id=eq.'+id),
  db('notification_outbox?select=reservation_id,status,attempts,sent_at&event_type=eq.booking_requested&reservation_id=eq.'+id)
 ])
 if(!reservations?.length)throw new ApiError(404,'예약을 찾을 수 없어요.')
 return {reservation:reservations[0],days,deliveries,notifications}
}
