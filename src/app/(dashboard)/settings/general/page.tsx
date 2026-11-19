import { redirect } from 'next/navigation'

import { ROUTES } from '@/lib/constants/routes'

// General settings are managed in the unified System Settings module
export default function GeneralSettingsPage() {
  redirect(ROUTES.SETTINGS)
}
