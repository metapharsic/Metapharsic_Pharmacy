import { redirect } from 'next/navigation'

import { ROUTES } from '@/lib/constants/routes'

// Redirect /batches/expiring to the comprehensive /expiry/expiring module
export default function ExpiringBatchesPage() {
  redirect(ROUTES.EXPIRY_EXPIRING)
}
