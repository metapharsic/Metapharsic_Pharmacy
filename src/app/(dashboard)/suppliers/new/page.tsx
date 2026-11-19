import { redirect } from 'next/navigation'

import { ROUTES } from '@/lib/constants/routes'

// The New Supplier form is now a dialog on the suppliers list page.
// Redirect any direct navigations here back to the list.
export default function NewSupplierPage() {
  redirect(ROUTES.SUPPLIERS)
}
