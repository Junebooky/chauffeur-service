import catalog from '../src/catalog.json' with { type: 'json' }
import { createHash } from 'node:crypto'
import { requestableDays } from '../server/requestable-availability.mjs'
import { createOperatorNotifier } from '../server/notifications.mjs'
import { db, ApiError, fail, hasDatabase, noCache, onlyString } from '../server/chauffeur-supabase.mjs'

const asBody = req => typeof req.body === 'string' ? JSON.parse(req.body) : req.body
const lengthValid = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max
const maxStops = 8
const safePlace = value => value && typeof value === 'object' && !Array.isArray(value)
  && lengthValid(value.address, 250) ? value : null

export default async function handler(req, res) {
  noCache(res)
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed.' })
  }
  if (!hasDatabase()) return res.status(503).json({ error: 'Online reservations are temporarily unavailable.' })
  try {
    const key = req.headers['idempotency-key']
    if (typeof key !== 'string' || !/^[a-zA-Z0-9-]{16,80}$/.test(key))
      throw new ApiError(400, 'A valid reservation request identifier is required.')
    const body = asBody(req)
    if (!body || typeof body !== 'object' || Array.isArray(body)
        || JSON.stringify(body).length > 65000) throw new ApiError(400, 'Invalid request.')
    for (const [field, max] of [['name',100],['email',180],['phone',40]]) {
      if (!lengthValid(body[field],max)) throw new ApiError(400, 'Please enter valid contact details.')
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email) ||
        body.phone.replace(/\D/g,'').length < 7)
      throw new ApiError(400, 'Please enter a valid email and phone number.')
    if (body.consent !== true) throw new ApiError(400, 'Please accept the reservation notice.')
    if (!catalog.contactMethods.some(x=>x.id=== (body.contactMethod || 'email')))
      throw new ApiError(400, 'Invalid contact method.')
    if (body.messengerContact && !lengthValid(body.messengerContact,80))
      throw new ApiError(400, 'Invalid messenger contact.')
    if (!Array.isArray(body.options) || new Set(body.options).size!==body.options.length ||
        body.options.some(id=>!catalog.options.some(o=>o.id===id)))
      throw new ApiError(400, 'Invalid journey options.')
    const incoming = body.journeys === undefined
      ? [{ ...body }]
      : body.journeys
    if (!Array.isArray(incoming) || incoming.length < 1 || incoming.length > 366)
      throw new ApiError(400, 'Please select valid journey dates.')
    if (!incoming[0] || typeof incoming[0] !== 'object' || incoming[0].date !== body.date || incoming[0].vehicle !== body.vehicle ||
        (incoming[0].time || body.time) !== body.time ||
        (incoming[0].service || body.service) !== body.service)
      throw new ApiError(400, 'The first journey must match your reservation.')
    const dates = incoming.map(d=>d?.date || '')
    const times = incoming.map(d=>d?.time || body.time)
    const services = incoming.map(d=>d?.service || body.service)
    if (new Set(dates).size!==dates.length || dates.some((d,i)=> i>0 && d<=dates[i-1]))
      throw new ApiError(400, 'Journey dates must be unique and in order.')
    requestableDays({ dates: dates.join(','), times: times.join(','), services: services.join(',') })
    const extras = catalog.options.filter(o=>body.options.includes(o.id)).reduce((n,o)=>n+o.price,0)
    let quoteRequired=false
    let total=0
    let previousEnd=0
    const days = incoming.map((d,i)=>{
      if (!d || typeof d!=='object' || Array.isArray(d)) throw new ApiError(400,'Invalid journey day.')
      const service=catalog.services.find(s=>s.id===services[i])
      const vehicle=catalog.vehicles.find(v=>v.id===d.vehicle)
      if (!service || !vehicle) throw new ApiError(400,'Please select a valid service and vehicle.')
      const pickupPlace=safePlace(d.pickupPlace || body.pickupPlace)
      const destinationPlace=safePlace(d.destinationPlace || body.destinationPlace)
      if (!pickupPlace || !destinationPlace) throw new ApiError(400,'Please select valid pickup and destination places.')
      const startsAt=Date.parse(dates[i]+'T'+times[i]+':00+09:00')
      const endsAt=startsAt+service.duration*3600000
      if (startsAt<previousEnd) throw new ApiError(400,'Journey dates cannot overlap.')
      previousEnd=endsAt
      const stops=d.stops === undefined ? [] : d.stops
      if (!Array.isArray(stops) || stops.length>maxStops ||
          stops.some(stop=>!stop || !safePlace(stop.place) || !lengthValid(stop.location,250)))
        throw new ApiError(400,'Please select valid route stops.')
      const flight=onlyString(d.flight === undefined ? body.flight : d.flight, 31)
      if (flight.length>30) throw new ApiError(400,'Please enter a valid flight number.')
      const amount=service.price+vehicle.surcharge+extras
      total+=amount
      quoteRequired=quoteRequired || Boolean(vehicle.quoteRequired)
      return {
        position:i+1,date:dates[i],time:times[i],service:service.id,vehicle:vehicle.id,
        pickup:pickupPlace.address,destination:destinationPlace.address,
        pickup_place:pickupPlace,destination_place:destinationPlace,
        pickup_at:new Date(startsAt).toISOString(),end_at:new Date(endsAt).toISOString(),
        stops,flight,total:vehicle.quoteRequired?null:amount
      }
    })
    const details={
      name:body.name.trim(),email:body.email.trim(),phone:body.phone.trim(),
      contactMethod:body.contactMethod||'email',
      messengerContact:onlyString(body.messengerContact,80),
      options:body.options,quoteRequired,taxIncluded:catalog.taxIncluded,
      journeys:days.map(d=>({
        date:d.date,time:d.time,vehicle:d.vehicle,service:d.service,
        pickup:d.pickup,destination:d.destination,pickupPlace:d.pickup_place,
        destinationPlace:d.destination_place,stops:d.stops,flight:d.flight,total:d.total
      }))
    }
    const forwarded = req.headers['x-forwarded-for']
    const ip = String(Array.isArray(forwarded)?forwarded[0]:forwarded||req.socket?.remoteAddress||'unknown').split(',')[0].trim()
    const fingerprint = createHash('sha256').update(ip).digest('hex')
    const rateOk = await db('rpc/check_booking_submission_limit_v1',{
      method:'POST',body:{p_fingerprint:fingerprint}
    })
    if (rateOk !== true) throw new ApiError(429,'Too many requests. Please try again in a few minutes.')
    const result=await db('rpc/create_booking_request_v1',{
      method:'POST',
      body:{
        p_idempotency_key:key,
        p_customer:{
          name:details.name,email:details.email,phone:details.phone,
          contact_method:details.contactMethod,messenger_contact:details.messengerContact,
          quote_required:quoteRequired,tax_included:catalog.taxIncluded,
          total:total,options:body.options,request_payload:details
        },
        p_days:days
      }
    })
    if (result?.created) {
      const notifier=createOperatorNotifier()
      if (notifier.enabled) {
        try {
          await notifier.deliver({
            reference:result.reference,status:'pending',
            total:quoteRequired?null:total,details
          })
          await db('notification_outbox?reservation_id=eq.'+result.id,{
            method:'PATCH',prefer:'return=minimal',
            body:{status:'sent',sent_at:new Date().toISOString(),attempts:1}
          })
        } catch (error) {
          console.error('Booking saved; operator notification not yet confirmed:',error?.code||'UNKNOWN')
        }
      }
    }
    return res.status(result?.created?201:200).json({
      reference:result.reference,status:'pending',total:quoteRequired?null:total,
      quoteRequired,journeys:details.journeys,
      date:days[0].date,time:days[0].time,vehicle:days[0].vehicle,service:days[0].service
    })
  } catch(error) {
    if (error instanceof Error && !(error instanceof ApiError) &&
        (error.message.startsWith('Please ') || error.message.startsWith('Journeys ')))
      return res.status(400).json({error:error.message})
    return fail(res,error)
  }
}
