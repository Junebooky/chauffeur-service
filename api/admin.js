import { ApiError, db, fail, hasDatabase, noCache, onlyString, requireStaff, validUuid } from '../server/chauffeur-supabase.mjs'

const writeRoles = new Set(['owner','admin','operator'])
const financeRoles = new Set(['owner','admin','finance'])
const ownerRoles = new Set(['owner','admin'])
const allowedStatuses = new Set(['requested','reviewing','quoted','awaiting_deposit','confirmed','in_progress','completed','cancelled','declined'])
const allowedAssignmentStatuses = new Set(['sourcing','proposed','assigned','confirmed','completed','cancelled'])
const allowedPaymentStatuses = new Set(['requested','pending','paid','failed','refunded','cancelled'])
const allowedPaymentKinds = new Set(['deposit','balance','full','refund','adjustment'])
const allowedPaymentMethods = new Set(['bank_transfer','paypal_invoice','international_wire','other'])
const safeMoney = value => Number.isFinite(Number(value)) && Number(value)>=0 && Number(value)<1e12 ? Number(value) : null
const roleCheck = (role,allowed) => { if (!allowed.has(role)) throw new ApiError(403,'Your account cannot change this section.') }
const requireId = value => { if(!validUuid(value)) throw new ApiError(400,'Invalid record identifier.'); return value }
const getBody = req => typeof req.body === 'string' ? JSON.parse(req.body) : req.body
const selectAll = (table,fields='*',limit=500) => db(table+'?select='+encodeURIComponent(fields)+'&limit='+limit)

async function event(userId, reservationId, eventType, meta = {}) {
  try {
    await db('audit_events',{method:'POST',body:{
      reservation_id:reservationId||null,actor_user_id:userId,event_type:eventType,metadata:meta
    },prefer:'return=minimal'})
  } catch { console.error('Chauffeur audit event could not be recorded.') }
}
export default async function handler(req,res) {
  noCache(res)
  if(!['GET','POST'].includes(req.method)) {
    res.setHeader('Allow','GET, POST')
    return res.status(405).json({error:'Method not allowed.'})
  }
  if(!hasDatabase()) return res.status(503).json({error:'Database is not configured.'})
  try {
    const staff=await requireStaff(req)
    if (req.method==='GET') {
      const finance=financeRoles.has(staff.role)
      const [reservations,days,assignments,suppliers,drivers,payments,expenses] =
        await Promise.all([
          db('reservations?select=*&order=created_at.desc&limit=150'),
          selectAll('reservation_days'),
          selectAll('assignments'),
          selectAll('vehicle_suppliers'),
          selectAll('drivers'),
          finance?selectAll('payment_records'):Promise.resolve([]),
          finance?selectAll('expenses'):Promise.resolve([])
        ])
      return res.status(200).json({
        role:staff.role,reservations,days,assignments,suppliers,drivers,payments,expenses
      })
    }
    const b=getBody(req)
    if(!b || typeof b!=='object' || Array.isArray(b) || JSON.stringify(b).length>15000)
      throw new ApiError(400,'Invalid request body.')
    const action=b.action
    let data
    if(action==='status') {
      roleCheck(staff.role,writeRoles)
      const id=requireId(b.reservation_id)
      if(!allowedStatuses.has(b.status)) throw new ApiError(400,'Invalid reservation status.')
      data=await db('reservations?id=eq.'+id,{method:'PATCH',prefer:'return=representation',
        body:{status:b.status, updated_at:new Date().toISOString(),
          ...(b.status==='confirmed'?{confirmed_at:new Date().toISOString()}:{}),
          ...(b.status==='cancelled'?{cancelled_at:new Date().toISOString()}:{})}})
      if(!data?.length) throw new ApiError(404,'Reservation not found.')
      await event(staff.id,id,'reservation.status_changed',{status:b.status})
    } else if(action==='supplier') {
      roleCheck(staff.role,writeRoles)
      if(!onlyString(b.company_name,150)) throw new ApiError(400,'Enter a supplier name.')
      data=await db('vehicle_suppliers',{method:'POST',prefer:'return=representation',body:{
        company_name:onlyString(b.company_name,150),
        contact_name:onlyString(b.contact_name,120)||null,
        contact_phone:onlyString(b.contact_phone,40)||null,
        contact_email:onlyString(b.contact_email,180)||null
      }})
      await event(staff.id,null,'supplier.created')
    } else if(action==='driver') {
      roleCheck(staff.role,writeRoles)
      if(!onlyString(b.full_name,120)) throw new ApiError(400,'Enter a chauffeur name.')
      data=await db('drivers',{method:'POST',prefer:'return=representation',body:{
        full_name:onlyString(b.full_name,120),
        phone:onlyString(b.phone,40)||null,
        email:onlyString(b.email,180)||null,
        supplier_id:b.supplier_id?requireId(b.supplier_id):null
      }})
      await event(staff.id,null,'driver.created')
    } else if(action==='assignment') {
      roleCheck(staff.role,writeRoles)
      const id=requireId(b.reservation_day_id)
      if(!allowedAssignmentStatuses.has(b.status)) throw new ApiError(400,'Invalid assignment status.')
      const vehicleCost=b.vehicle_cost===''||b.vehicle_cost==null?null:safeMoney(b.vehicle_cost)
      const driverCost=b.driver_cost===''||b.driver_cost==null?null:safeMoney(b.driver_cost)
      if(vehicleCost===null && b.vehicle_cost!=='' && b.vehicle_cost!=null ||
         driverCost===null && b.driver_cost!=='' && b.driver_cost!=null)
        throw new ApiError(400,'Invalid assignment amount.')
      const payload={
        reservation_day_id:id,status:b.status,
        supplier_id:b.supplier_id?requireId(b.supplier_id):null,
        driver_id:b.driver_id?requireId(b.driver_id):null,
        vehicle_cost:vehicleCost,driver_cost:driverCost,
        vehicle_identifier:onlyString(b.vehicle_identifier,70)||null,
        updated_at:new Date().toISOString(),
        ...(b.status==='assigned'?{assigned_at:new Date().toISOString()}:{})
      }
      data=await db('assignments?on_conflict=reservation_day_id',{
        method:'POST',body:payload,prefer:'resolution=merge-duplicates,return=representation'
      })
      const days=await db('reservation_days?select=reservation_id&id=eq.'+id+'&limit=1')
      await event(staff.id,days?.[0]?.reservation_id??null,'assignment.updated',{reservation_day_id:id})
    } else if(action==='payment') {
      roleCheck(staff.role,financeRoles)
      const id=requireId(b.reservation_id)
      if(!allowedPaymentKinds.has(b.kind)||!allowedPaymentMethods.has(b.method)||!allowedPaymentStatuses.has(b.status))
        throw new ApiError(400,'Invalid payment details.')
      const amount=safeMoney(b.amount)
      if(amount===null) throw new ApiError(400,'Invalid amount.')
      data=await db('payment_records',{method:'POST',prefer:'return=representation',body:{
        reservation_id:id,kind:b.kind,method:b.method,status:b.status,amount,currency:'KRW',
        external_reference:onlyString(b.external_reference,200)||null,
        ...(b.status==='paid'?{paid_at:new Date().toISOString()}:{})
      }})
      await event(staff.id,id,'payment.recorded',{kind:b.kind,status:b.status})
    } else if(action==='payment_status') {
      roleCheck(staff.role,financeRoles)
      const id=requireId(b.payment_id)
      if(!allowedPaymentStatuses.has(b.status)) throw new ApiError(400,'Invalid payment status.')
      data=await db('payment_records?id=eq.'+id,{method:'PATCH',prefer:'return=representation',body:{
        status:b.status,updated_at:new Date().toISOString(),
        ...(b.status==='paid'?{paid_at:new Date().toISOString()}:{})
      }})
      if(!data?.length) throw new ApiError(404,'Payment not found.')
      await event(staff.id,data[0].reservation_id,'payment.status_changed',{status:b.status})
    } else {
      throw new ApiError(400,'Unknown operation.')
    }
    return res.status(200).json({ok:true,data})
  } catch(error) { return fail(res,error) }
}
