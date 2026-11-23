// Browser-side A4 PDF/PNG export with no paid service or new dependencies.
export type ExportDay = {
  date: string; time: string; service: string; vehicle: string;
  pickup: string; destination: string;
  pickupName?: string; destinationName?: string;
  stops?: string[]; total: number | null;
}
export type ExportItinerary = {
  reference: string; status: string; total: number | null;
  journeys: ExportDay[];
}
const W = 1240, H = 1754, HEADER_H = 375, PAGE_W = 595, PAGE_H = 842
const olive = '#899766'
const HEADER_BG_SRC = '/media/hero/bg_003.png'
const BRAND_MARK_SRC = '/media/brand/chauffeur-mark.png'
const DISPLAY_FONT_STACK = 'Pretendard, "Chauffeur Manrope", "Noto Sans KR", Arial, sans-serif'
const BODY_FONT_STACK = 'Pretendard, "Chauffeur Manrope", Arial, "Noto Sans KR", sans-serif'

type HeaderAssets = {
  background: HTMLImageElement | null
  mark: HTMLImageElement | null
}

type CanvasWithLetterSpacing = CanvasRenderingContext2D & {
  letterSpacing?: string
}

let cachedAssetsPromise: Promise<HeaderAssets> | null = null

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    let settled = false
    const finish = (value: HTMLImageElement | null) => {
      if (settled) return
      settled = true
      resolve(value)
    }
    const timer = setTimeout(() => finish(null), 3000)
    img.onload = () => { clearTimeout(timer); finish(img) }
    img.onerror = () => { clearTimeout(timer); finish(null) }
    img.src = src
  })
}

async function ensureHeaderAssets(): Promise<HeaderAssets> {
  if (!cachedAssetsPromise) {
    const fontLoads: Promise<unknown>[] = []
    if (typeof document !== 'undefined' && 'fonts' in document && document.fonts) {
      fontLoads.push(
        document.fonts.load('100 36px Pretendard').catch(() => undefined),
        document.fonts.load('200 36px Pretendard').catch(() => undefined),
        document.fonts.load('300 14px Pretendard').catch(() => undefined),
        document.fonts.load('200 36px "Chauffeur Manrope"').catch(() => undefined),
        document.fonts.load('300 14px "Chauffeur Manrope"').catch(() => undefined),
      )
    }
    cachedAssetsPromise = Promise.all([
      loadImage(HEADER_BG_SRC),
      loadImage(BRAND_MARK_SRC),
      ...fontLoads,
    ]).then(([background, mark]) => ({ background, mark }))
  }
  return cachedAssetsPromise
}

const money = (n: number | null) => n === null
  ? 'Quote on request'
  : new Intl.NumberFormat('en-US', {
      style: 'currency', currency: 'KRW', maximumFractionDigits: 0,
    }).format(n)
const prettyDate = (value: string) => {
  const p = value.split('-').map(Number)
  if (p.length !== 3 || p.some((v) => !Number.isFinite(v))) return value
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(Date.UTC(p[0], p[1] - 1, p[2])))
}
const drawText = (
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  size: number,
  color = '#1e2424',
  weight = 400,
  fontStack = BODY_FONT_STACK,
  letterSpacing = '0px',
) => {
  const target = ctx as CanvasWithLetterSpacing
  ctx.fillStyle = color
  ctx.font = weight + ' ' + size + 'px ' + fontStack
  if ('letterSpacing' in target) target.letterSpacing = letterSpacing
  ctx.fillText(value, x, y)
  if ('letterSpacing' in target) target.letterSpacing = '0px'
}
const shorten = (ctx: CanvasRenderingContext2D, value: string, max: number) => {
  if (ctx.measureText(value).width <= max) return value
  let copy = value
  while (copy.length > 1 && ctx.measureText(copy + '…').width > max) {
    copy = copy.slice(0, -1)
  }
  return copy + '…'
}
function drawHeaderBanner(ctx: CanvasRenderingContext2D, assets: HeaderAssets) {
  ctx.save()
  ctx.beginPath()
  ctx.rect(0, 0, W, HEADER_H)
  ctx.clip()

  ctx.fillStyle = '#111316'
  ctx.fillRect(0, 0, W, HEADER_H)

  if (assets.background && assets.background.naturalWidth > 0 && assets.background.naturalHeight > 0) {
    const bg = assets.background
    const scale = Math.max(W / bg.naturalWidth, HEADER_H / bg.naturalHeight)
    const drawW = bg.naturalWidth * scale
    const drawH = bg.naturalHeight * scale
    const drawX = (W - drawW) * 0.5
    const drawY = (HEADER_H - drawH) * 0.62
    ctx.globalAlpha = 0.44
    ctx.drawImage(bg, drawX, drawY, drawW, drawH)
    ctx.globalAlpha = 1
  }

  const horizontalScrim = ctx.createLinearGradient(0, 0, W, 0)
  horizontalScrim.addColorStop(0, 'rgba(13, 15, 18, 0.84)')
  horizontalScrim.addColorStop(0.55, 'rgba(13, 15, 18, 0.52)')
  horizontalScrim.addColorStop(1, 'rgba(13, 15, 18, 0.3)')
  ctx.fillStyle = horizontalScrim
  ctx.fillRect(0, 0, W, HEADER_H)

  const verticalScrim = ctx.createLinearGradient(0, 0, 0, HEADER_H)
  verticalScrim.addColorStop(0, 'rgba(13, 15, 18, 0.34)')
  verticalScrim.addColorStop(0.55, 'rgba(13, 15, 18, 0.08)')
  verticalScrim.addColorStop(1, 'rgba(13, 15, 18, 0.42)')
  ctx.fillStyle = verticalScrim
  ctx.fillRect(0, 0, W, HEADER_H)

  const markSize = 58
  const markX = 100
  const markY = 76
  let brandTextX = 100
  if (assets.mark && assets.mark.naturalWidth > 0 && assets.mark.naturalHeight > 0) {
    ctx.drawImage(assets.mark, markX, markY, markSize, markSize)
    brandTextX = markX + markSize + 18
  }

  drawText(
    ctx,
    'J Production',
    brandTextX,
    109,
    36,
    '#f4f5f7',
    200,
    DISPLAY_FONT_STACK,
    '0.02em',
  )
  drawText(
    ctx,
    'Team of Premium Chauffeur Service',
    brandTextX + 1,
    133,
    14,
    'rgba(229, 233, 240, 0.78)',
    300,
    DISPLAY_FONT_STACK,
    '0.06em',
  )

  drawText(
    ctx,
    'YOUR RESERVATION REQUEST',
    100,
    235,
    21,
    '#b2c39e',
    600,
    BODY_FONT_STACK,
    '0.05em',
  )
  drawText(
    ctx,
    'Journey itinerary',
    100,
    304,
    49,
    '#ffffff',
    200,
    DISPLAY_FONT_STACK,
    '-0.015em',
  )
  ctx.restore()
}
function drawPage(
  data: ExportItinerary,
  days: ExportDay[],
  page: number,
  count: number,
  assets: HeaderAssets,
) {
  const canvas = document.createElement('canvas')
  canvas.width = W; canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Image export is not supported in this browser.')
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H)
  drawHeaderBanner(ctx, assets)
  ctx.strokeStyle = '#d9deda'
  ctx.beginPath(); ctx.moveTo(100, 465); ctx.lineTo(W - 100, 465); ctx.stroke()
  drawText(ctx, 'Reference', 100, 422, 23, '#727e78')
  drawText(ctx, data.reference, 228, 422, 24, '#222a27', 600)
  ctx.textAlign = 'right'
  drawText(ctx, 'Saved · Awaiting confirmation', W - 100, 422, 22, olive, 600)
  ctx.textAlign = 'left'
  const sections = [
    ['DATES', data.journeys.length > 1
      ? prettyDate(data.journeys[0].date) + ' – ' +
        prettyDate(data.journeys[data.journeys.length - 1].date)
      : prettyDate(data.journeys[0]?.date || '')],
    ['JOURNEYS', String(data.journeys.length) +
      (data.journeys.length === 1 ? ' day' : ' days')],
    ['TIME ZONE', 'KST · UTC+9'],
  ]
  ctx.strokeStyle = '#dfe4df'; ctx.strokeRect(100, 505, W - 200, 130)
  sections.forEach(([label, value], i) => {
    const x = 120 + i * 345
    if (i) {
      ctx.beginPath(); ctx.moveTo(x - 15, 505); ctx.lineTo(x - 15, 635); ctx.stroke()
    }
    drawText(ctx, label, x, 545, 18, '#78847c', 600)
    ctx.font = '600 24px ' + BODY_FONT_STACK
    drawText(ctx, shorten(ctx, value, 305), x, 595, 24, '#242c27', 600)
  })
  drawText(ctx, 'Daily itinerary', 100, 712, 31, '#222a26', 600)
  let y = 748
  days.forEach((day, idx) => {
    const absoluteIndex = page * 3 + idx
    ctx.strokeStyle = '#e0e4df'
    ctx.beginPath(); ctx.moveTo(100, y); ctx.lineTo(W - 100, y); ctx.stroke()
    drawText(ctx, 'DAY ' + String(absoluteIndex + 1).padStart(2, '0'), 100, y + 50,
      19, olive, 700)
    drawText(ctx, prettyDate(day.date), 100, y + 85, 19, '#758176')
    const x = 255
    ctx.font = '600 24px ' + BODY_FONT_STACK
    drawText(ctx, shorten(ctx, day.service + ' · ' + day.time + ' KST', 540),
      x, y + 48, 24, '#252c28', 600)
    ctx.textAlign = 'right'
    ctx.font = '400 20px ' + BODY_FONT_STACK
    drawText(ctx, shorten(ctx, day.vehicle, 310), W - 100, y + 48, 20, '#79817b')
    ctx.textAlign = 'left'
    ctx.font = '500 23px ' + BODY_FONT_STACK
    drawText(ctx, shorten(ctx, day.pickupName || day.pickup, 390),
      x, y + 101, 23, '#252d28', 500)
    drawText(ctx, '→', 695, y + 101, 26, olive, 600)
    drawText(ctx, shorten(ctx, day.destinationName || day.destination, 370),
      750, y + 101, 23, '#252d28', 500)
    ctx.font = '400 17px ' + BODY_FONT_STACK
    drawText(ctx, shorten(ctx, day.pickup + ' → ' + day.destination, 870),
      x, y + 144, 17, '#7e8981')
    if (day.stops?.length) {
      ctx.font = '400 17px ' + BODY_FONT_STACK
      drawText(ctx, shorten(ctx, 'Via ' + day.stops.join(' · '), 870),
        x, y + 183, 17, '#7e8981')
    }
    y += 230
  })
  ctx.strokeStyle = '#d0d9ce'
  ctx.beginPath(); ctx.moveTo(100, 1472); ctx.lineTo(W - 100, 1472); ctx.stroke()
  drawText(ctx, 'Estimated total · Tax excluded', 100, 1530, 24, '#758078')
  ctx.textAlign = 'right'
  drawText(ctx, money(data.total), W - 100, 1542, 38, '#1e2721', 600)
  ctx.textAlign = 'left'
  ctx.fillStyle = '#f3f6f1'; ctx.fillRect(100, 1580, W - 200, 91)
  drawText(ctx, 'Reservation request saved · Awaiting confirmation · No payment taken',
    122, 1636, 20, '#59685b', 500)
  drawText(ctx, 'J Production', 100, 1712, 18, '#59675f', 500, DISPLAY_FONT_STACK)
  ctx.textAlign = 'right'
  drawText(ctx, count > 1 ? 'Page ' + (page + 1) + ' of ' + count : 'KST (UTC+9)',
    W - 100, 1712, 18, '#8d968f')
  ctx.textAlign = 'left'
  return canvas
}
const pageCount = (data: ExportItinerary) => {
  if (!data.journeys.length) throw new Error('No itinerary is available.')
  return Math.ceil(data.journeys.length / 3)
}
const renderPage = (data: ExportItinerary, i: number, count: number, assets: HeaderAssets) =>
  drawPage(data, data.journeys.slice(i * 3, i * 3 + 3), i, count, assets)
function save(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url; anchor.download = filename
  document.body.append(anchor); anchor.click(); anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
function jpegData(canvas: HTMLCanvasElement) {
  const binary = atob(canvas.toDataURL('image/jpeg', 0.9).split(',')[1])
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}
async function pdfDocument(data: ExportItinerary) {
  const assets = await ensureHeaderAssets()
  const encoder = new TextEncoder()
  const chunks: Uint8Array[] = []
  let byteLength = 0
  const addBytes = (bytes: Uint8Array) => { chunks.push(bytes); byteLength += bytes.length }
  const add = (value: string) => addBytes(encoder.encode(value))
  const offsets: number[] = [0]
  const object = (id: number, fn: () => void) => {
    offsets[id] = byteLength
    add(id + ' 0 obj\n'); fn(); add('\nendobj\n')
  }
  add('%PDF-1.4\n')
  object(1, () => add('<< /Type /Catalog /Pages 2 0 R >>'))
  const count = pageCount(data)
  object(2, () => add('<< /Type /Pages /Count ' + count + ' /Kids [' +
    Array.from({ length: count }, (_, i) => (3 + 3 * i) + ' 0 R').join(' ') + '] >>'))
  for (let i = 0; i < count; i++) {
    const canvas = renderPage(data, i, count, assets)
    const page = 3 + i * 3, image = page + 1, content = page + 2
    object(page, () => add('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' +
      PAGE_W + ' ' + PAGE_H + '] /Resources << /XObject << /Im1 ' + image +
      ' 0 R >> >> /Contents ' + content + ' 0 R >>'))
    const jpg = jpegData(canvas)
    object(image, () => {
      add('<< /Type /XObject /Subtype /Image /Width ' + W + ' /Height ' + H +
        ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' +
        jpg.length + ' >>\nstream\n')
      addBytes(jpg)
      add('\nendstream')
    })
    const commands = 'q\n' + PAGE_W + ' 0 0 ' + PAGE_H + ' 0 0 cm\n/Im1 Do\nQ\n'
    object(content, () => add('<< /Length ' + encoder.encode(commands).length +
      ' >>\nstream\n' + commands + 'endstream'))
  }
  const startXref = byteLength
  const size = 3 + 3 * count
  add('xref\n0 ' + size + '\n0000000000 65535 f \n')
  for (let i = 1; i < size; i++)
    add(String(offsets[i]).padStart(10, '0') + ' 00000 n \n')
  add('trailer\n<< /Size ' + size + ' /Root 1 0 R >>\nstartxref\n' +
    startXref + '\n%%EOF')
  return new Blob(chunks as BlobPart[], { type: 'application/pdf' })
}
export async function exportItineraryPdf(data: ExportItinerary) {
  save(await pdfDocument(data), data.reference + '-itinerary.pdf')
}
export async function exportItineraryPng(data: ExportItinerary) {
  const [assets, count] = [await ensureHeaderAssets(), pageCount(data)]
  for (let i = 0; i < count; i++) {
    const canvas = renderPage(data, i, count, assets)
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((value) => value ? resolve(value) :
        reject(new Error('Could not create an itinerary image.')), 'image/png'))
    const suffix = count === 1 ? '' : '-page-' + String(i + 1).padStart(2, '0')
    save(blob, data.reference + '-itinerary' + suffix + '.png')
  }
}
