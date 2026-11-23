import { searchPlaces, resolvePlace } from './places-serverless.mjs'

export async function placesHandler(req,res,action) {
  res.setHeader('Cache-Control','no-store')
  res.setHeader('Content-Type','application/json; charset=utf-8')
  if(req.method!=='POST') {
    res.setHeader('Allow','POST')
    return res.status(405).json({error:'Method not allowed.'})
  }
  try {
    const body=typeof req.body==='string'?JSON.parse(req.body):req.body
    const result=action==='search'?await searchPlaces(body):await resolvePlace(body)
    return res.status(result.status).json(result.data)
  }catch {
    return res.status(400).json({error:'Please check the selected place.'})
  }
}
