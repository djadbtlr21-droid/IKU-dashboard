#!/usr/bin/env node
// Manual backup: fetches public GET /api/annotations and writes ./backups/YYYY-MM-DD.json
// Usage: npm run backup-annotations
// Override target: BACKUP_API_URL=https://other.example/api/annotations npm run backup-annotations

import { writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'

const API_URL = process.env.BACKUP_API_URL || 'https://iku-dashboard.vercel.app/api/annotations'
const BACKUP_DIR = path.resolve(process.cwd(), 'backups')

async function main() {
  console.log(`[backup] GET ${API_URL}`)
  const res = await fetch(API_URL, { cache: 'no-store' })
  if (!res.ok) {
    console.error(`[backup] failed: HTTP ${res.status}`)
    process.exit(1)
  }
  const data = await res.json()
  if (!existsSync(BACKUP_DIR)) {
    await mkdir(BACKUP_DIR, { recursive: true })
  }
  const today = new Date().toISOString().slice(0, 10)
  const file = path.join(BACKUP_DIR, `${today}.json`)
  await writeFile(file, JSON.stringify(data, null, 2), 'utf8')
  const count = Object.keys(data?.items || {}).length
  console.log(`[backup] wrote ${file} (${count} items, blob updatedAt=${data?.updatedAt || 'n/a'})`)
}

main().catch(err => {
  console.error('[backup] error', err)
  process.exit(1)
})
