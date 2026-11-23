import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const exporter = readFileSync(join(root, 'src', 'itineraryExport.ts'), 'utf8')
const booking = readFileSync(join(root, 'src', 'Booking.tsx'), 'utf8')

test('itinerary PDF/PNG export paints the subtle bg_003 header backdrop and J Production brand lockup', () => {
  assert.equal(existsSync(join(root, 'public', 'media', 'hero', 'bg_003.png')), true)
  assert.equal(existsSync(join(root, 'public', 'media', 'brand', 'chauffeur-mark.png')), true)

  assert.match(exporter, /HEADER_BG_SRC\s*=\s*'\/media\/hero\/bg_003\.png'/)
  assert.match(exporter, /BRAND_MARK_SRC\s*=\s*'\/media\/brand\/chauffeur-mark\.png'/)
  assert.match(exporter, /DISPLAY_FONT_STACK\s*=\s*'Pretendard, "Chauffeur Manrope"/)
  assert.match(exporter, /'J Production'[\s\S]*200[\s\S]*DISPLAY_FONT_STACK/)
  assert.match(exporter, /'Team of Premium Chauffeur Service'/)
  assert.doesNotMatch(exporter, /drawText\(ctx,\s*'CHAUFFEUR'/)
  assert.match(exporter, /ctx\.globalAlpha\s*=\s*0\.\d+/)
  assert.match(exporter, /export async function exportItineraryPdf/)
  assert.match(exporter, /export async function exportItineraryPng/)
  assert.match(booking, /await exportItineraryPdf\(result\)/)
})
