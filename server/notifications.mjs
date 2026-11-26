import { documentCopy, documentDate } from '../src/i18n/document-copy.mjs'
// Operator notification for saved (pending) booking requests.
// The admin email is private: only the server reads the recipient address.
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import catalog from '../src/catalog.json' with { type: 'json' }
import nodemailer from 'nodemailer'

const EMAIL_HEADER_BG_PATH = resolve(import.meta.dirname, 'assets/email-header-bg.jpg')
const EMAIL_HEADER_CID = 'chauffeur-email-header'
const EMAIL_HEADER_BUFFER = existsSync(EMAIL_HEADER_BG_PATH)
  ? readFileSync(EMAIL_HEADER_BG_PATH)
  : null

export const DEFAULT_OPERATOR_EMAIL = 'topcs2026@gmail.com'

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char])

const readableMoney = (value) => value === null || value === undefined
  ? 'Quote on request'
  : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(value)

const prettyDate = (value) => {
  const [year, month, day] = String(value ?? '').split('-').map(Number)
  if (!year || !month || !day) return String(value ?? '')
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, month - 1, day)))
}

const safeMailto = (email, reference) =>
  'mailto:' + encodeURIComponent(email).replace(/%40/g, '@') +
  '?subject=' + encodeURIComponent('CHAUFFEUR · ' + reference)

function dayRow(day, index, locale = 'en') {
  const t = s => documentCopy(locale,s)
  const pickup = day.pickupPlace?.name || day.pickup || ''
  const destination = day.destinationPlace?.name || day.destination || ''
  const stops = Array.isArray(day.stops) ? day.stops : []
  const flightText = day.flight
    ? '<div style="padding:7px 0 0;font-size:11px;color:#7e8582">' + t('Flight') + ' ' +
      escapeHtml(day.flight) + '</div>'
    : ''
  const stopText = stops.length
    ? '<div style="padding:7px 0 0;font-size:11px;color:#7e8582">' + t('Via') + ' ' +
      stops.map((stop) => escapeHtml(stop.place?.name || stop.location)).join(' · ') + '</div>'
    : ''
  return `<tr><td style="padding:19px 0;border-bottom:1px solid #e7eae6;vertical-align:top;width:76px">
      <span style="font-size:10px;letter-spacing:1px;font-weight:700;color:#899766">DAY ${String(index + 1).padStart(2, '0')}</span>
    </td><td style="padding:19px 0;border-bottom:1px solid #e7eae6">
      <div style="font-size:13px;font-weight:650;color:#1d2422">${escapeHtml(locale === 'ko' ? documentDate(locale,day.date) : prettyDate(day.date))} · ${escapeHtml(day.time || '')} KST</div>
      <div style="padding-top:6px;font-size:12px;color:#59625d">${escapeHtml(day.service)} · ${escapeHtml(day.vehicle)}</div>
      <div style="padding-top:10px;font-size:12px;color:#222b26;line-height:1.6">${escapeHtml(pickup)} <span style="color:#899766">→</span> ${escapeHtml(destination)}</div>
      <div style="font-size:10px;color:#89908b;line-height:1.6">${escapeHtml(day.pickup || '')} → ${escapeHtml(day.destination || '')}</div>
      ${flightText}${stopText}
    </td><td align="right" style="padding:19px 0 19px 12px;border-bottom:1px solid #e7eae6;white-space:nowrap;vertical-align:top;font-size:12px;color:#424b45">${escapeHtml(readableMoney(day.total))}</td></tr>`
}

export function buildOperatorEmail({ reference, status = 'pending', total, details, audience = 'operator' }) {
  const customer = audience === 'customer'
  const locale = customer && details.preferredLocale === 'ko' ? 'ko' : 'en'
  const t = s => documentCopy(locale,s)
  const paymentText = s => t(s)
  const payment = paymentText(details.paymentMethod === 'on_site' ? 'Payment on the day of your service.' : 'Payment as agreed with our team.')
  const taxLabel = t(details.taxIncluded === true ? 'Tax included' : 'Tax excluded')
  const days = Array.isArray(details.journeys) ? details.journeys : []
  const options = Array.isArray(details.options) && details.options.length
    ? details.options.map((id) =>
        t(catalog.options.find((option) => option.id === id)?.name || id)).join(', ')
    : t('None')
  const name = String(details.name || '')
  const email = String(details.email || '')
  const phone = String(details.phone || '')
  const method = String(details.contactMethod || 'email')
  const messenger = String(details.messengerContact || '')
  const subject = `[CHAUFFEUR] ${customer ? t('Booking Confirmed') : 'New Booking Request'} · ${reference}`
  const plainDays = days.map((day, i) =>
    `Day ${String(i + 1).padStart(2, '0')} · ${(locale === 'ko' ? documentDate(locale,day.date) : prettyDate(day.date))} · ${day.time} KST\n` +
    `${day.service} · ${day.vehicle}\n${day.pickup} → ${day.destination}\n` +
    `${(day.stops || []).map((stop) => t('Stop') + ': ' + stop.location).join('\n')}\n` +
    `${readableMoney(day.total)}`
  ).join('\n\n')
  const englishText = [
    customer ? 'J Production · Team of Premium Chauffeur Service — Reservation confirmed' : 'J Production · Team of Premium Chauffeur Service — New reservation request',
    'Reference: ' + reference,
    customer ? 'Status: Confirmed' : 'Status: ' + status + ' (awaiting confirmation)',
    customer ? 'Dear ' + name + ', thank you for choosing CHAUFFEUR. Your journey is confirmed.' : undefined,
    '', 'GUEST',
    'Name: ' + name,
    'Email: ' + email,
    customer ? undefined : 'Phone: ' + phone,
    customer ? undefined : 'Preferred contact: ' + method,
    !customer && messenger ? 'Messenger: ' + messenger : '',
    '', 'ITINERARY', plainDays,
    '', 'Add-ons: ' + options,
    (customer ? 'Confirmed service total, ' + taxLabel.toLowerCase() : 'Estimated total, tax excluded') + ': ' + readableMoney(total),
    '', customer ? payment + ' Your reservation confirmation is attached. We will share the vehicle and chauffeur details before your journey. Please reply to this email with any questions.' : 'This is a pending request. No booking has been confirmed or payment taken.',
  ].filter((line) => line !== undefined).join('\n')
  const text = locale === 'ko' ? [
    'J Production · Team of Premium Chauffeur Service — 예약 확정',
    t('Reference') + ': ' + reference,
    t('Status') + ': ' + t('Confirmed'),
    name + ' 고객님, CHAUFFEUR를 이용해 주셔서 감사합니다.',
    '', t('GUEST DETAILS'), t('Name') + ': ' + name, t('Email') + ': ' + email,
    '', t('DAILY ITINERARY'), plainDays,
    '', t('Add-ons') + ': ' + options,
    t('Confirmed service total') + ' · ' + taxLabel + ': ' + readableMoney(total),
    '', payment, t('Your reservation confirmation is attached.'), t('We will share the vehicle and chauffeur details before your journey.'), t('Please reply to this email with any questions.'),
  ].join('\n') : englishText
  const attachments = EMAIL_HEADER_BUFFER
    ? [{
        filename: 'j-production-header.jpg',
        content: EMAIL_HEADER_BUFFER,
        contentType: 'image/jpeg',
        cid: EMAIL_HEADER_CID,
        contentDisposition: 'inline',
      }]
    : []
  const headerBanner = attachments.length
    ? `<img src="cid:${EMAIL_HEADER_CID}" width="640" height="130" alt="J Production — Team of Premium Chauffeur Service" style="display:block;width:100%;max-width:640px;height:auto;aspect-ratio:640/130;background:#171b1d;color:#171b1d;border:0">`
    : `<div style="padding:26px 36px 0"><div style="font-size:20px;font-weight:200;color:#f4f5f7;letter-spacing:0.02em">J Production</div><div style="margin-top:4px;font-size:10px;letter-spacing:1.2px;color:#c4cbd4">Team of Premium Chauffeur Service</div></div>`
  const html = `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:24px 12px;background:#f0f2ef;font-family:'Helvetica Neue',Arial,Helvetica,sans-serif;color:#202723">
<table role="presentation" align="center" cellpadding="0" cellspacing="0" width="100%" style="max-width:640px;background:#ffffff;border:1px solid #e1e5df;border-collapse:collapse">
<tr><td style="background:#171b1d;color:#ffffff;padding:0">
  ${headerBanner}
  <div style="padding:10px 36px 30px">
    <div style="font-size:10px;letter-spacing:2px;color:#b8c6a6">${customer ? t('RESERVATION CONFIRMED') : 'NEW RESERVATION REQUEST'}</div>
    <div style="margin-top:8px;font-size:27px;font-weight:200;letter-spacing:-0.01em">${customer ? t('Your journey is confirmed.') : 'A new journey awaits.'}</div>
    <div style="margin-top:16px;font-size:12px;color:#d5dcd5">${t('Reference')} <strong style="color:#ffffff;font-weight:400;letter-spacing:0.04em">${escapeHtml(reference)}</strong> &nbsp;·&nbsp; ${customer ? t('Confirmed') : 'Pending confirmation'}</div>
  </div>
</td></tr>
<tr><td style="padding:28px 36px 31px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
    <tr><td style="font-size:12px;letter-spacing:1px;font-weight:700;color:#899766;padding-bottom:14px">${t('GUEST DETAILS')}</td></tr>
    <tr><td style="font-size:18px;font-weight:600;padding-bottom:5px">${escapeHtml(name)}</td></tr>
    <tr><td style="font-size:12px;color:#555e59;line-height:1.9">${customer ? t('Thank you for choosing CHAUFFEUR. We look forward to welcoming you.') : 'Email: ' + escapeHtml(email) + '<br>Phone: ' + escapeHtml(phone) + '<br>Preferred contact: ' + escapeHtml(method) + (messenger ? '<br>Messenger: ' + escapeHtml(messenger) : '')}</td></tr>
    <tr><td style="font-size:12px;letter-spacing:1px;font-weight:700;color:#899766;padding:28px 0 7px">${t('DAILY ITINERARY')} · ${days.length}${locale === 'ko' ? '일' : ' ' + (days.length === 1 ? 'DAY' : 'DAYS')}</td></tr>
  </table>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
    ${days.map((day,index)=>dayRow(day,index,locale)).join('')}
  </table>
  <div style="padding-top:18px;font-size:12px;color:#646e66">${t('Add-ons')}: ${escapeHtml(options)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:18px;border-top:1px solid #d7ded4">
    <tr><td style="padding:19px 0;font-size:12px;color:#6f7572">${customer ? t('Confirmed service total') + ' · ' + taxLabel : 'Estimated total · Tax excluded'}</td>
      <td align="right" style="padding:19px 0;font-size:19px;font-weight:700;white-space:nowrap">${escapeHtml(readableMoney(total))}</td></tr>
  </table>
  <p style="margin:9px 0 20px;font-size:11px;line-height:1.6;color:#717b73">${customer ? escapeHtml(payment) + ' ' + t('Your reservation confirmation is attached.') + ' ' + t('We will share the vehicle and chauffeur details before your journey.') : 'This request is saved but not confirmed. Review the schedule, vehicle availability and guest details before responding.'}</p>
  ${customer ? '<p style="font-size:12px;line-height:1.7;color:#555e59">'+t('If you have questions or need to make changes, simply reply to this email.')+'<br><br>'+t('Warm regards,')+'<br>'+t('The CHAUFFEUR Team')+'</p>' : `<table role="presentation" cellpadding="0" cellspacing="0"><tr><td bgcolor="#1d2320" style="padding:13px 20px"><a href="${escapeHtml(safeMailto(email, reference))}" style="color:#ffffff;text-decoration:none;font-size:12px;font-weight:bold">Reply to guest →</a></td></tr></table>`}
</td></tr>
<tr><td style="background:#f7f8f6;border-top:1px solid #e5e7e2;padding:16px 36px;font-size:10px;color:#8b938d">J Production · Team of Premium Chauffeur Service · ${escapeHtml(reference)}${customer ? '' : '<br>Please treat guest contact information as confidential.'}</td></tr>
</table></body></html>`
  return { subject, html, text, replyTo: customer ? undefined : email, attachments }
}

export function createOperatorNotifier({
  host = process.env.SMTP_HOST || 'smtp.gmail.com',
  port = Number(process.env.SMTP_PORT || 465),
  secure = (process.env.SMTP_SECURE || 'true').toLowerCase() === 'true',
  user = process.env.SMTP_USER || '',
  appPassword = process.env.SMTP_APP_PASSWORD || '',
  from = process.env.SMTP_FROM_EMAIL || user,
  to = process.env.BOOKING_NOTIFICATION_TO || DEFAULT_OPERATOR_EMAIL,
  createTransport = nodemailer.createTransport,
  send,
} = {}) {
  // Google may display app passwords in groups of four. SMTP authentication
  // uses the sixteen characters without the intervening spaces.
  const password = String(appPassword).replace(/\s+/g, '')
  const username = String(user).trim()
  const sender = String(from).trim()
  const recipient = String(to).trim()
  const configured = Boolean(username && password && sender && recipient &&
    Number.isInteger(port) && port > 0 && port <= 65535)
  const enabled = Boolean(send || configured)

  // No transport is constructed in a missing-credential environment.
  const transport = configured && !send
    ? createTransport({
        host, port, secure,
        requireTLS: !secure,
        auth: { user: username, pass: password },
        connectionTimeout: 9000,
        greetingTimeout: 9000,
        socketTimeout: 15000,
      })
    : null

  const deliver = async (request) => {
    if (!enabled) return false
    const email = buildOperatorEmail(request)
    if (send) {
      await send({ to: recipient, ...email, reference: request.reference })
      return true
    }
    // Keep Message-ID stable for best-effort duplicate suppression. SMTP
    // cannot guarantee exactly-once delivery if a process crashes after send.
    const domain = username.split('@')[1] || 'gmail.com'
    const messageId = '<chauffeur.' +
      String(request.reference).replace(/[^a-zA-Z0-9-]/g, '') + '@' + domain + '>'
    const info = await transport.sendMail({
      from: { name: 'Chauffeur Service', address: sender },
      to: recipient,
      replyTo: email.replyTo,
      subject: email.subject,
      html: email.html,
      text: email.text,
      attachments: email.attachments,
      messageId,
    })
    if (Array.isArray(info?.accepted) &&
      !info.accepted.some((address) =>
        String(address).toLowerCase() === recipient.toLowerCase())) {
      throw new Error('Gmail SMTP did not accept the operator recipient.')
    }
    return true
  }
  return { enabled, deliver, to: recipient }
}

// Same branded layout; only the audience-specific wording differs.
export function buildCustomerConfirmation(snapshot) {
  const journeys=snapshot.journeys.map(d=>({ ...d,
    service:catalog.services.find(s=>s.id===d.service)?.name||d.service,
    vehicle:catalog.vehicles.find(v=>v.id===d.vehicle)?.name||d.vehicle,
  }))
  return buildOperatorEmail({reference:snapshot.reference,status:'confirmed',total:snapshot.total,
    details:{...snapshot,journeys},audience:'customer'})
}
