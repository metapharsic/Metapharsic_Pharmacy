import fs from 'fs'

const env = fs.readFileSync('.env', 'utf8')
const match = env.match(/GEMINI_API_KEY="?([^\s"\r\n]+)/)
if (!match) {
  console.error('No GEMINI_API_KEY found in .env')
  process.exit(1)
}

const key = match[1]
console.log('Testing Gemini API from host with key:', key.slice(0, 10) + '...')

const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    contents: [{ parts: [{ text: 'Return JSON: {"status": "LIVE_VERIFIED", "model": "gemini-2.5-flash"}' }] }],
    generationConfig: { response_mime_type: 'application/json' }
  })
})

const data = await res.json()
console.log('HTTP Status:', res.status)
console.log('Gemini Result:', data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || JSON.stringify(data))
