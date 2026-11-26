import { createHmac, timingSafeEqual } from 'node:crypto'
import popular from './popular-places.json' with { type: 'json' }
import { normalizePlaceQuery, stationSearchContext, isStationPrediction, rankStationSuggestions, stationDisplayAddress } from './station-search.mjs'

const sessionOk = token => typeof token === 'string' && /^[A-Za-z0-9_-]{16,80}$/.test(token)
const googleKey = () => process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_PLACES_API_KEY || ''
const signatureKey = () => process.env.PLACES_SELECTION_SIGNING_KEY ||
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const suggestions = place => ({
  id: place.id, name: place.name, address: place.address,
  isStation: isStationPrediction(place),
  displayAddress: stationDisplayAddress(place.address, isStationPrediction(place)),
})
export const curatedPlace = id => {
  const p = popular.find(place => place.id === id)
  if (!p) return null
  const { aliases, ...place } = p
  const isStation = isStationPrediction(place)
  return { ...place, source:'popular', accuracy:'building', isStation,
    displayAddress:stationDisplayAddress(place.address, isStation) }
}
export function validatePlaceSelection(place) {
  if (!place || typeof place !== 'object' || Array.isArray(place)) return null
  if (typeof place.id !== 'string') return null
  const local = curatedPlace(place.id)
  if (local) return local
  if (place.source !== 'google' || !place.selectionToken) return null
  return verifySelection(place)
}
export function placeRequestInput(body, requireId=false) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || !sessionOk(body.sessionToken))
    return 'Please select a valid location.'
  if (requireId)
    return typeof body.id==='string' && body.id.length>0 && body.id.length<=255
      ? null : 'Please select a suggested location.'
  return typeof body.query==='string' && body.query.length<=180
    ? null : 'Please enter a valid place or address.'
}
function matchesCurated(query, context) {
  const q=normalizePlaceQuery(query.trim())
  const input=normalizePlaceQuery(context.input)
  return popular.filter(place => [place.name, place.address, ...place.aliases].some(alias => {
    const a=normalizePlaceQuery(alias)
    return !q || a.includes(q) || context.station && !context.exit && a.includes(input)
  }))
}
async function google(path,options={}) {
  const result=await fetch('https://places.googleapis.com/v1/'+path,{
    ...options,
    headers:{ 'Content-Type':'application/json','X-Goog-Api-Key':googleKey(),...options.headers },
    signal:AbortSignal.timeout(7000),
  })
  if(!result.ok) {
    await result.body?.cancel?.()
    throw new Error('Live address search is temporarily unavailable. Please retry or choose a popular location.')
  }
  return result.json()
}
const parsePredictions = response => (response.suggestions||[]).flatMap(item => {
  const prediction=item.placePrediction
  if(!prediction?.placeId) return []
  const name=prediction.structuredFormat?.mainText?.text||prediction.text?.text||''
  const address=prediction.structuredFormat?.secondaryText?.text||''
  const candidate={id:prediction.placeId,name,address,types:prediction.types||[]}
  const isStation=isStationPrediction(candidate)
  return [{...candidate,isStation,displayAddress:stationDisplayAddress(address,isStation)}]
})
export async function searchPlaces(body) {
  const inputError=placeRequestInput(body)
  if(inputError) return {status:400,data:{error:inputError}}
  const context=stationSearchContext(body.query)
  const q=normalizePlaceQuery(body.query.trim())
  const allMatches=matchesCurated(body.query,context)
  const exact=q.length>=2 ? allMatches.filter(p=>[p.name,...p.aliases].some(a =>
    normalizePlaceQuery(a)===q || context.station && !context.exit && normalizePlaceQuery(a)===normalizePlaceQuery(context.input))) : []
  const key=googleKey()
  if(!key || q.length<2 || exact.length) return {status:200,data:{
    mode:'popular',results:(exact.length?exact:allMatches).slice(0,6).map(suggestions),
    notice: key?null:'Popular locations only. Full address search is not connected yet.'
  }}
  const autocomplete=async (input,types) => {
    const response=await google('places:autocomplete',{
      method:'POST',headers:{
        'X-Goog-FieldMask':'suggestions.placePrediction.placeId,suggestions.placePrediction.structuredFormat,suggestions.placePrediction.text,suggestions.placePrediction.types',
      },
      body:JSON.stringify({
        input,sessionToken:body.sessionToken,languageCode:body.locale==='ko'?'ko':'en',includedRegionCodes:['kr'],
        ...(types?{includedPrimaryTypes:types}:{}),
        locationBias:{circle:{center:{latitude:37.5665,longitude:126.978},radius:50000}},
      })
    })
    return parsePredictions(response)
  }
  try {
    const main=await autocomplete(context.input)
    let all=main
    if(context.station && !context.exit && q.length>=5 && !main.some(isStationPrediction)) {
      try {
        all=[...await autocomplete(context.input,['subway_station','train_station','light_rail_station','transit_station']),...main]
      } catch { /* Keep original predictions if fallback is unavailable. */ }
    }
    const seen=new Set()
    const results=rankStationSuggestions(all,context).filter(p=>{
      if(seen.has(p.id))return false;seen.add(p.id);return true
    }).slice(0,5).map(({types,...result})=>result)
    return {status:200,data:{mode:'google',results}}
  } catch {
    // Google is an enhancement; curated matches keep core booking usable.
    if(allMatches.length) return {status:200,data:{
      mode:'popular',results:allMatches.slice(0,6).map(suggestions),
      notice:'Live address search is temporarily unavailable. Showing popular locations.'
    }}
    return {status:503,data:{error:'Live address search is temporarily unavailable. Please retry or choose a popular location.'}}
  }
}
function signSelection(place,sessionToken,now=Date.now()) {
  const secret=signatureKey()
  if(!secret) throw new Error('Place verification is not configured.')
  const payload={
    id:place.id,name:place.name,address:place.address,
    latitude:place.latitude,longitude:place.longitude,
    expiresAt:now+60*60*1000,sessionToken
  }
  const packed=Buffer.from(JSON.stringify(payload)).toString('base64url')
  const mac=createHmac('sha256',secret).update(packed).digest('base64url')
  return packed+'.'+mac
}
function verifySelection(place) {
  const token=place.selectionToken
  if(typeof token!=='string' || token.length>4000) return null
  const pieces=token.split('.')
  if(pieces.length!==2) return null
  const secret=signatureKey()
  if(!secret) return null
  const expected=createHmac('sha256',secret).update(pieces[0]).digest()
  let received
  try {received=Buffer.from(pieces[1],'base64url')}catch{return null}
  if(received.length!==expected.length || !timingSafeEqual(expected,received))return null
  let payload
  try {payload=JSON.parse(Buffer.from(pieces[0],'base64url').toString('utf8'))}catch{return null}
  if(!payload || !Number.isFinite(payload.expiresAt) || payload.expiresAt<Date.now() ||
    payload.expiresAt>Date.now()+3600000+60000) return null
  const keys=['id','name','address','latitude','longitude']
  if(keys.some(key=>payload[key]!==place[key]))return null
  if(typeof payload.id!=='string' || typeof payload.name!=='string' || typeof payload.address!=='string' ||
    !Number.isFinite(payload.latitude) || !Number.isFinite(payload.longitude))return null
  const {id,name,address,latitude,longitude}=payload
  const isStation=isStationPrediction({name})
  return {id,name,address,latitude,longitude,source:'google',accuracy:'building',
    isStation,displayAddress:stationDisplayAddress(address,isStation),selectionToken:token}
}
export async function resolvePlace(body) {
  const error=placeRequestInput(body,true)
  if(error)return {status:400,data:{error}}
  const local=curatedPlace(body.id)
  if(local)return {status:200,data:local}
  if(!googleKey() || !/^[A-Za-z0-9_-]+$/.test(body.id))
    return {status:400,data:{error:'Please select a suggested location.'}}
  try{
    const params=new URLSearchParams({languageCode:body.locale==='ko'?'ko':'en',sessionToken:body.sessionToken})
    const data=await google('places/'+encodeURIComponent(body.id)+'?'+params,{
      headers:{'X-Goog-FieldMask':'id,displayName,formattedAddress,location,addressComponents'}
    })
    if(data.id!==body.id || typeof data.formattedAddress!=='string' || data.formattedAddress.length>500 ||
      !Number.isFinite(data.location?.latitude) || !Number.isFinite(data.location?.longitude) ||
      Math.abs(data.location.latitude)>90 || Math.abs(data.location.longitude)>180 ||
      !data.addressComponents?.some(x=>x.types?.includes('country') &&
        (x.shortText==='KR' || x.longText==='South Korea' || x.longText==='대한민국')))
      return {status:400,data:{error:'Please choose a location in South Korea.'}}
    const name=data.displayName?.text||data.formattedAddress
    const isStation=isStationPrediction({name})
    const place={
      id:data.id,name,address:data.formattedAddress,
      latitude:data.location.latitude,longitude:data.location.longitude,
      source:'google',accuracy:'building',isStation,
      displayAddress:stationDisplayAddress(data.formattedAddress,isStation)
    }
    return {status:200,data:{...place,selectionToken:signSelection(place,body.sessionToken)}}
  }catch {
    return {status:503,data:{error:'We could not confirm this address. Please select it again.'}}
  }
}
