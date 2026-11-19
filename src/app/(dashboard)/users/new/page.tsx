import { redirect } from 'next/navigation'

import { ROUTES } from '@/lib/constants/routes'

// The New User form is a modal dialog on the user management page.
export default function NewUserPage() {
  redirect(ROUTES.USERS)
}
