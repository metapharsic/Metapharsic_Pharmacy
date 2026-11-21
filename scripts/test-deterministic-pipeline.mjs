import fs from 'fs'
import { spawn } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')

console.log('--- Testing Zero-LLM Deterministic Pipeline on invoice_pic/1.jpeg ---')

const imgPath = path.resolve(rootDir, 'invoice_pic/1.jpeg')
const pyScript = path.resolve(rootDir, 'scripts/deterministic_ocr_engine.py')

const t0 = Date.now()
const pythonBin = process.platform === 'win32' ? 'python' : 'python3'
const py = spawn(pythonBin, [pyScript, '--input', imgPath, '--mode', 'invoice'])

let stdout = ''
let stderr = ''

py.stdout.on('data', d => stdout += d.toString('utf8'))
py.stderr.on('data', d => stderr += d.toString('utf8'))

py.on('close', code => {
  console.log(`Python process finished with code ${code} in ${Date.now() - t0} ms`)
  if (code !== 0) {
    console.error('Stderr:', stderr.slice(0, 300))
    return
  }
  try {
    const data = JSON.parse(stdout)
    console.log('Success:', data.success)
    console.log('Mode:', data.mode)
    console.log('Total Boxes Detected:', data.totalBoxes)
    if (data.pages && data.pages[0]) {
      console.log('Page 1 Dimensions:', `${data.pages[0].width}x${data.pages[0].height}`)
      console.log('First 5 detected spatial boxes:')
      data.pages[0].boxes.slice(0, 5).forEach((b, i) => {
        console.log(`  ${i+1}. "${b.text}" (conf: ${b.confidence}) box: [${b.box.join(', ')}]`)
      })
    }
  } catch (e) {
    console.error('Failed to parse stdout:', stdout.slice(0, 300))
  }
})
