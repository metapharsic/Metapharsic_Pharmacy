import { redirect } from 'next/navigation'

import { ROUTES } from '@/lib/constants/routes'

// Organization profile is managed in the unified System Settings module
export default function OrganizationSettingsPage() {
  redirect(ROUTES.SETTINGS)
}
