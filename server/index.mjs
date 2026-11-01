import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import { createApp } from './app.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))

// Load .env and .env.local if present
for (const envName of ['.env', '.env.local']) {
  const envPath = resolve(root, envName)
  if (existsSync(envPath) && typeof process.loadEnvFile === 'function') {
    try {
      process.loadEnvFile(envPath)
    } catch {}
  }
}
const { app, close } = createApp({
  databasePath:
    process.env.DATABASE_PATH || resolve(root, '.data/reservations.sqlite'),
})
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(resolve(root, 'dist')))
  app.get('/{*path}', (_req, res) =>
    res.sendFile(resolve(root, 'dist/index.html')),
  )
}
const port = Number(process.env.PORT || 3001)
const server = app.listen(port, process.env.HOST || '0.0.0.0', () =>
  console.log(`Chauffeur service listening on port ${port}`),
)
for (const signal of ['SIGINT', 'SIGTERM'])
  process.once(signal, () =>
    server.close(() => {
      close()
      process.exit(0)
    }),
  )
