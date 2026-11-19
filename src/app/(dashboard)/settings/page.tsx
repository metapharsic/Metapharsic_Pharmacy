import type { Metadata } from 'next'
import { SettingsClient } from '@/components/settings/settings-client'

export const metadata: Metadata = { title: 'System Settings | PharmaCare' }

export default function SystemSettingsPage() {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1 border-b border-border/60 pb-3">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Dispensary System Settings</h1>
        <p className="text-xs text-muted-foreground">
          Configure statutory licenses, store profile, tax rules, and system alert defaults
        </p>
      </div>

      <SettingsClient />
    </div>
  )
}
