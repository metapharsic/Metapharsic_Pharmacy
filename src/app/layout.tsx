import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Toaster } from 'sonner'

import { SessionProvider } from '@/components/auth/session-provider'
import { ConfirmationDialog } from '@/components/shared/confirmation-dialog'
import { KeyboardShortcutsProvider } from '@/components/shared/keyboard-shortcuts-provider'
import { DatabaseBackupProvider } from '@/components/shared/database-backup-provider'
import { I18nProvider } from '@/lib/i18n/i18n-context'
import { getSession } from '@/lib/auth/auth-helpers'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: {
    template: '%s | Metapharsic',
    default: 'Metapharsic — Lifesciences Pharmacy Management System',
  },
  description: 'Complete pharmacy management and dispensary system for Metapharsic Lifesciences',
  icons: {
    icon: '/logo.png',
    shortcut: '/logo.png',
    apple: '/logo.png',
  },
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`} suppressHydrationWarning>
        <SessionProvider session={session}>
          <I18nProvider>
            <DatabaseBackupProvider>
              <KeyboardShortcutsProvider>
                {children}
                <ConfirmationDialog />
                <Toaster position="top-right" richColors closeButton />
              </KeyboardShortcutsProvider>
            </DatabaseBackupProvider>
          </I18nProvider>
        </SessionProvider>
      </body>
    </html>
  )
}
