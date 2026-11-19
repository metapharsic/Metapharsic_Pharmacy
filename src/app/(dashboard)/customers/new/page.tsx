import { redirect } from 'next/navigation'

import { ROUTES } from '@/lib/constants/routes'

// The New Customer form is now a modal dialog on the customers list page.
// Redirect any direct navigations here back to the list.
export default function NewCustomerPage() {
  redirect(ROUTES.CUSTOMERS)
}
