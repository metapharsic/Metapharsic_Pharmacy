import { chromium } from 'playwright'

async function checkLogin() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  const page = await browser.newPage()

  page.on('console', (msg) => console.log(`[BROWSER CONSOLE ${msg.type()}]:`, msg.text()))
  page.on('pageerror', (err) => console.log(`[PAGE ERROR]:`, err.message, err.stack))
  page.on('response', (res) => {
    if (res.status() >= 400) {
      console.log(`[HTTP ${res.status()}]:`, res.url())
    }
  })

  console.log('Navigating to http://localhost:5888/login...')
  await page.goto('http://localhost:5888/login')
  await page.waitForTimeout(3000)

  console.log('Current URL:', page.url())
  const html = await page.content()
  console.log('HTML snippet:', html.substring(0, 500))

  await browser.close()
}

checkLogin().catch(console.error)
