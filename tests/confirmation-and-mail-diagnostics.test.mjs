import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, mkdtempSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { execFileSync } from 'node:child_process'
import { DatabaseSync } from 'node:sqlite'

const root = resolve(import.meta.dirname, '..')
const read = (path) => readFileSync(join(root, path), 'utf8')
const booking = read('src/Booking.tsx')
const css = read('src/styles.css')
const server = read('server/app.mjs')

test('Confirmation has three equal columns with matching label/value baselines', () => {
  assert.match(css, /\.booking-confirmation-stats \{[^}]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/s)
  assert.match(css, /\.booking-confirmation-stats > div \{[^}]*grid-template-rows: 15px minmax\(20px, auto\) 13px/s)
  assert.match(css, /\.booking-confirmation-stats > div \{[^}]*min-height: 94px/s)
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*?\.booking-confirmation-stats \{ grid-template-columns: minmax\(0, 1fr\); \}/)
  assert.match(css, /\.booking-confirmation-stats > div \+ div \{[^}]*border-left: 1px/s)
  assert.match(booking, /className="booking-confirmation-stats"/)
})

test('Confirmation uses thin subdued request label and puts time zone next to each service time', () => {
  assert.match(booking, /className="booking-confirmation-kicker">YOUR RESERVATION REQUEST/)
  assert.doesNotMatch(booking, /className="eyebrow">YOUR RESERVATION REQUEST/)
  assert.match(css, /\.booking-confirmation-heading \.booking-confirmation-kicker \{[^}]*font-weight: 300 !important;/s)
  assert.match(css, /\.booking-confirmation-heading \.booking-confirmation-kicker \{[^}]*color: rgba\(236, 241, 247, 0\.64\) !important;/s)
  assert.match(booking, /<strong>\{day\.service\} · \{day\.time\} KST \(UTC\+9\)<\/strong>/)
  assert.doesNotMatch(booking, /<span>KST \(UTC\+9\)<\/span>/)
})

test('operator email delivery remains separate from saved reservations with safe diagnostics', () => {
  assert.match(server, /INSERT INTO reservation_notifications/)
  assert.match(server, /if \(notifier\.enabled\) setImmediate\(\(\) => \{ void flushOperatorNotifications\(\) \}\)/)
  assert.match(server, /Operator reservation email is disabled: SMTP credentials are not configured/)
  assert.match(server, /Operator email delivery failed \(\$\{smtpCode\}\); will retry/)
  assert.match(server, /\^E\[A-Z_\]\+\$/)
  assert.doesNotMatch(server, /console\.error\(['"]SMTP_APP_PASSWORD/)
})

test('local email status command diagnoses pending versus accepted emails without guest PII', () => {
  const dir = mkdtempSync(join(tmpdir(), 'chauffeur-email-audit-'))
  const dbPath = join(dir, 'test.sqlite')
  try {
    const db = new DatabaseSync(dbPath)
    db.exec(
      'CREATE TABLE reservations (id TEXT PRIMARY KEY, status TEXT);' +
      'CREATE TABLE reservation_notifications (' +
      'reservation_id TEXT PRIMARY KEY, status TEXT, attempts INTEGER,' +
      'next_attempt_at INTEGER, sent_at TEXT);' +
      "INSERT INTO reservations VALUES ('CH-1234ABCD', 'pending');" +
      "INSERT INTO reservation_notifications VALUES (" +
      "'CH-1234ABCD', 'pending', 2, 1795400000000, NULL);"
    )
    const run = (password) => execFileSync(
      process.execPath,
      [join(root, 'scripts/email-status.mjs'), 'CH-1234ABCD'],
      { encoding: 'utf8', env: {
        ...process.env,
        DATABASE_PATH: dbPath,
        SMTP_USER: 'example@gmail.com',
        SMTP_APP_PASSWORD: password,
      } },
    )
    const pending = run('')
    assert.match(pending, /Gmail SMTP configured on this API environment: no/)
    assert.match(pending, /Operator notification: pending/)
    assert.match(pending, /Delivery attempts: 2/)
    db.exec("UPDATE reservation_notifications SET status = 'sent', sent_at = '2026-11-23T00:00:00.000Z'")
    const sent = run('0000111122223333')
    assert.match(sent, /Gmail SMTP configured on this API environment: yes/)
    assert.match(sent, /Operator notification: sent/)
    assert.match(sent, /SMTP accepted by provider at/)
    assert.doesNotMatch(sent, /0000111122223333|example@gmail\.com/)
    db.close()
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
