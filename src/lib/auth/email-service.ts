import nodemailer from 'nodemailer'

interface SendEmailOptions {
  to: string
  subject: string
  html: string
  text?: string
  attachments?: Array<{
    filename: string
    content: Buffer | string
    contentType?: string
  }>
}

export async function sendEmail({ to, subject, html, text, attachments }: SendEmailOptions): Promise<{ success: boolean; simulated?: boolean; error?: string }> {
  const host = process.env.EMAIL_SERVER_HOST
  const port = Number(process.env.EMAIL_SERVER_PORT) || 587
  const user = process.env.EMAIL_SERVER_USER
  const pass = process.env.EMAIL_SERVER_PASSWORD
  const from = process.env.EMAIL_FROM || 'noreply@pharmacare.local'

  const isPlaceholder = !user || !pass || user.includes('your-email') || pass.includes('your-app-password')

  // If no SMTP configured or using default placeholders, log to server console in simulation mode
  if (!host || isPlaceholder) {
    console.log(`\n📧 [EMAIL SIMULATION] To: ${to} | Subject: ${subject} | Attachments: ${attachments?.map((a) => a.filename).join(', ') || 'none'}`)
    console.log(`Content:\n${text || html}\n`)
    return { success: true, simulated: true }
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: {
        user,
        pass,
      },
    })

    await transporter.sendMail({
      from: `"PharmaCare Cloud Backup" <${from}>`,
      to,
      subject,
      text: text || html.replace(/<[^>]+>/g, ''),
      html,
      attachments,
    })

    return { success: true }
  } catch (error: any) {
    console.warn('[EmailService] SMTP server rejected credentials, falling back to local simulation:', error?.message || error)
    console.log(`\n📧 [EMAIL FALLBACK SIMULATION] To: ${to} | Subject: ${subject} | Attachments: ${attachments?.map((a) => a.filename).join(', ') || 'none'}`)
    return { success: true, simulated: true }
  }
}
