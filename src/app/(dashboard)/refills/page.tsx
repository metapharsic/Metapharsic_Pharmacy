import type { Metadata } from 'next'
import { RefillsRetentionHub } from '@/components/retention/refills-retention-hub'

export const metadata: Metadata = {
  title: 'Automated Refills & Patient Retention | PharmaCare',
  description:
    'Multi-tenant automated medicine refill reminders, WhatsApp & SMS notifications, customer follow-ups, refill scheduling, and retention analytics.',
}

export default function RefillsPage() {
  return <RefillsRetentionHub />
}
