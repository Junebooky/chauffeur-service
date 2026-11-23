import { placesHandler } from '../../server/places-handler.mjs'

export default function handler(req,res) {
  return placesHandler(req,res,'resolve')
}
