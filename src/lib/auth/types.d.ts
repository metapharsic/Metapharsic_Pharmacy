// Extend NextAuth types to include our custom fields
import type { DefaultSession, DefaultUser } from 'next-auth'
import type { DefaultJWT } from 'next-auth/jwt'

export interface SessionOrganization {
  id: string
  name: string
  code: string | null
  slug?: string | null
  logoUrl?: string | null
  watermarkUrl?: string | null
  gstin?: string | null
  dlNumber?: string | null
  phone?: string | null
  address?: string | null
  city?: string | null
  state?: string | null
  status?: string
  subscriptionPlan?: string
  subscriptionExpiresAt?: string | null
}

declare module 'next-auth' {
  interface Session {
    user: DefaultSession['user'] & {
      id: string
      permissions: string[]
      roles: string[]
      branchId: string | null
      organizationId: string | null
      organization?: SessionOrganization | null
      isSuperAdmin?: boolean
    }
  }

  interface User extends DefaultUser {
    permissions: string[]
    roles: string[]
    branchId: string | null
    organizationId: string | null
    organization?: SessionOrganization | null
    isSuperAdmin?: boolean
  }
}

declare module 'next-auth/jwt' {
  interface JWT extends DefaultJWT {
    id: string
    permissions: string[]
    roles: string[]
    branchId: string | null
    organizationId: string | null
    organization?: SessionOrganization | null
    isSuperAdmin?: boolean
  }
}
