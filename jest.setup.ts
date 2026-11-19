import '@testing-library/jest-dom'
import fs from 'fs'
import path from 'path'

// Load .env if present
const envPath = path.resolve(process.cwd(), '.env')
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8')
    .split('\n')
    .forEach((line) => {
      const match = line.match(/^([^#\s]+?)=(.*)$/)
      if (match) {
        let val = match[2].trim()
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1)
        if (!process.env[match[1].trim()]) {
          process.env[match[1].trim()] = val
        }
      }
    })
}

process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgres@localhost:5432/pharmacare_dev?schema=public'
