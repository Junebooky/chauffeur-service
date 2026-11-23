import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'

const root = fileURLToPath(new URL('../', import.meta.url))
const reference = String(process.argv[2] || '').trim().toUpperCase()
if (!/^CH-[0-9A-F]{8}$/.test(reference)) {
  console.error('Usage: npm run email:status -- CH-1234ABCD')
  process.exitCode = 2
} else {
  const configured = Boolean(process.env.SMTP_USER?.trim() &&
    process.env.SMTP_APP_PASSWORD?.replace(/\s+/g, ''))
  console.log('Gmail SMTP configured on this API environment:', configured ? 'yes' : 'no')
  const dbPath = process.env.DATABASE_PATH || resolve(root, '.data/reservations.sqlite')
  if (dbPath === ':memory:' || !existsSync(dbPath)) {
    console.error('No persistent reservation database found in this environment.')
    process.exitCode = 1
  } else {
    let db
    try {
      db = new DatabaseSync(dbPath, { readOnly: true })
      const status = db.prepare(`
        SELECT r.status AS booking_status, n.status AS email_status,
               n.attempts, n.next_attempt_at, n.sent_at
        FROM reservations r
        LEFT JOIN reservation_notifications n ON n.reservation_id = r.id
        WHERE r.id = ?
      `).get(reference)
      if (!status) {
        console.error('Reservation not found in this database.')
        process.exitCode = 1
      } else {
        console.log('Reservation reference:', reference)
        console.log('Booking state:', status.booking_status)
        console.log('Operator notification:', status.email_status || 'not queued')
        console.log('Delivery attempts:', status.attempts ?? 0)
        if (status.sent_at)
          console.log('SMTP accepted by provider at:', status.sent_at)
        else if (status.next_attempt_at)
          console.log('Next eligible attempt:', new Date(status.next_attempt_at).toISOString())
        console.log('Note: SMTP acceptance does not guarantee inbox delivery.')
      }
    } catch {
      console.error('Could not read the reservation notification state.')
      process.exitCode = 1
    } finally {
      db?.close()
    }
  }
}
