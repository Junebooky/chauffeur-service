import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')

test('default admin URL enters a no-sign-in sample preview', () => {
  const entry = read('src/main.tsx')
  const preview = read('src/AdminPreview.tsx')
  const rewrites = JSON.parse(read('vercel.json')).rewrites
  assert.match(entry, /pathname\.replace\(\/\\\/\$\/, ''\) === '\/admin'/)
  assert.match(entry, /<AdminPreview \/>/)
  assert.ok(rewrites.some(route => route.source === '/admin' && route.destination === '/index.html'))
  assert.match(preview, /No sign-in required/)
  assert.match(preview, /Sample data/)
  assert.match(preview, /SAMPLE-001/)
  assert.doesNotMatch(preview, /fetch\(|\/api\/admin|SUPABASE_SERVICE_ROLE_KEY/)
})

test('real customer operations remain behind authenticated admin route', () => {
  const entry = read('src/main.tsx')
  const api = read('api/admin.js')
  const live = read('src/Admin.tsx')
  const rewrites = JSON.parse(read('vercel.json')).rewrites
  assert.match(entry, /=== '\/admin\/live'/)
  assert.match(entry, /<Admin \/>/)
  assert.match(api, /await requireStaff\(req\)/)
  assert.match(live, /SignIn/)
  assert.ok(rewrites.some(route => route.source === '/admin/live'))
})
