import { PrismaAdapter } from '@auth/prisma-adapter'
import bcrypt from 'bcryptjs'
import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'

import prisma from '@/lib/db/prisma'
import { getPlatformIAMPolicy } from '@/lib/platform/iam-service'
import { verifyTotp } from '@/lib/auth/totp-service'

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as NextAuthOptions['adapter'],
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        mfaCode: { label: 'MFA Code', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email and password are required')
        }

        const cleanIdentifier = credentials.email.trim().toLowerCase()
        let user = await prisma.user.findFirst({
          where: {
            email: {
              equals: cleanIdentifier,
              mode: 'insensitive',
            },
          },
          include: {
            organization: true,
            branch: {
              include: {
                organization: true,
              },
            },
            userRoles: {
              include: {
                role: {
                  include: {
                    rolePermissions: {
                      include: { permission: true },
                    },
                  },
                },
              },
            },
          },
        })

        if (!user) {
          // Mobile convenience: allow logging in by username (e.g. 'amjad') or phone number
          user = await prisma.user.findFirst({
            where: {
              OR: [
                { email: { startsWith: `${cleanIdentifier}@`, mode: 'insensitive' } },
                { phone: { contains: cleanIdentifier } },
              ],
            },
            orderBy: { createdAt: 'desc' },
            include: {
              organization: true,
              branch: {
                include: {
                  organization: true,
                },
              },
              userRoles: {
                include: {
                  role: {
                    include: {
                      rolePermissions: {
                        include: { permission: true },
                      },
                    },
                  },
                },
              },
            },
          })
        }

        if (!user) {
          throw new Error('Invalid email or password')
        }

        if (!user.isActive) {
          throw new Error('Your account has been deactivated')
        }

        const org = user.organization || user.branch?.organization || null
        if (org && org.status === 'SUSPENDED' && !user.isSuperAdmin) {
          throw new Error('This Chemist Shop subscription has been suspended. Please contact platform support.')
        }

        if (!user.password) {
          throw new Error('Please use the password reset flow to set a password')
        }

        const iamPolicy = await getPlatformIAMPolicy()

        // Check after-hours lockout if enabled (06:00 to 23:00 allowed)
        if (!iamPolicy.allowDispensaryAfterHours && !user.isSuperAdmin && !user.userRoles.some(r => r.role.name === 'owner')) {
          const currentHour = new Date().getHours()
          if (currentHour < 6 || currentHour >= 23) {
            throw new Error('Dispensary after-hours restriction is enforced by SuperAdmin IAM. Logins permitted only 06:00 - 23:00.')
          }
        }

        const isValidPassword = await bcrypt.compare(credentials.password, user.password)

        if (!isValidPassword) {
          // Increment failed login count according to IAM policy
          const nextCount = (user.failedLoginCount || 0) + 1
          const shouldLock = nextCount >= iamPolicy.maxFailedAttempts
          const lockTime = shouldLock
            ? new Date(Date.now() + iamPolicy.lockoutDurationMinutes * 60 * 1000)
            : undefined

          await prisma.user.update({
            where: { id: user.id },
            data: {
              failedLoginCount: { increment: 1 },
              lockedUntil: lockTime,
            },
          })

          if (shouldLock) {
            try {
              await prisma.auditLog.create({
                data: {
                  action: 'ACCOUNT_LOCKED',
                  entity: 'User',
                  entityId: user.id,
                  userId: user.id,
                  newData: { reason: `Exceeded ${iamPolicy.maxFailedAttempts} failed login attempts.` },
                },
              })
            } catch {}
            throw new Error(`Account locked for ${iamPolicy.lockoutDurationMinutes} minutes due to excessive failed attempts.`)
          }

          throw new Error('Invalid email or password')
        }

        // Check account lockout ONLY if not super admin
        if (user.lockedUntil && user.lockedUntil > new Date() && !user.isSuperAdmin) {
          const remMinutes = Math.max(1, Math.ceil((user.lockedUntil.getTime() - Date.now()) / (60 * 1000)))
          throw new Error(`Account temporarily locked by IAM security rules. Try again in ${remMinutes} minute(s).`)
        }

        // Two-Factor Authentication (MFA) Check if enabled for this user
        if (user.mfaEnabled) {
          const mfaCode = (credentials as any)?.mfaCode ? String((credentials as any).mfaCode).trim() : ''
          if (!mfaCode) {
            throw new Error('Two-factor authentication code required')
          }
          if (user.totpSecret) {
            const isMfaValid = verifyTotp(mfaCode, user.totpSecret)
            if (!isMfaValid) {
              throw new Error('Invalid two-factor authentication code')
            }
          }
        }

        // Reset failed login count and update last login
        await prisma.user.update({
          where: { id: user.id },
          data: {
            failedLoginCount: 0,
            lockedUntil: null,
            lastLoginAt: new Date(),
          },
        })

        // Collect permissions
        const permissions = user.userRoles.flatMap((ur) =>
          ur.role.rolePermissions.map((rp) => rp.permission.code)
        )
        const roles = user.userRoles.map((ur) => ur.role.name)

        const resolveTerritoryCode = (country?: string | null): string => {
          if (!country) return 'IN'
          const c = country.toLowerCase()
          if (c.includes('saudi') || c === 'sa') return 'SA'
          if (c.includes('oman') || c === 'om') return 'OM'
          if (c.includes('bahrain') || c === 'bh') return 'BH'
          if (c.includes('qatar') || c === 'qa') return 'QA'
          if (c.includes('maldives') || c === 'mv') return 'MV'
          if (c.includes('india') || c === 'in') return 'IN'
          return 'IN'
        }

        // Resolve Assigned Sovereign Territory from User Governance or Organization
        let userTerritory = 'IN'
        try {
          const govSetting = await prisma.systemSetting.findUnique({
            where: {
              category_key: {
                category: 'USER_GOVERNANCE',
                key: user.id,
              },
            },
          })
          if (govSetting?.value) {
            const parsedGov = JSON.parse(govSetting.value)
            if (Array.isArray(parsedGov.territories) && parsedGov.territories[0]) {
              userTerritory = parsedGov.territories[0]
            } else if (parsedGov.assignedPrivateNode) {
              userTerritory = parsedGov.assignedPrivateNode
            }
          }
        } catch {
          // Fallback to org country
        }

        if (userTerritory === 'IN' && org?.country) {
          userTerritory = resolveTerritoryCode(org.country)
        }

        const orgPayload = org
          ? {
              id: org.id,
              name: org.name,
              code: org.code,
              slug: org.slug,
              logoUrl: org.logoUrl,
              watermarkUrl: org.watermarkUrl,
              gstin: org.gstin,
              dlNumber: org.dlNumber,
              phone: org.phone,
              address: org.address,
              city: org.city,
              state: org.state,
              country: org.country,
              currency: org.currency,
              timezone: org.timezone,
              territoryCode: userTerritory,
              status: org.status,
              subscriptionPlan: org.subscriptionPlan,
              subscriptionExpiresAt: org.subscriptionExpiresAt ? org.subscriptionExpiresAt.toISOString() : null,
            }
          : null

        const branchPayload = user.branch
          ? {
              id: user.branch.id,
              name: user.branch.name,
              code: user.branch.code,
              invoicePrefix: user.branch.invoicePrefix,
              city: user.branch.city,
            }
          : null

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          permissions: [...new Set(permissions)],
          roles,
          branchId: user.branchId,
          branch: branchPayload,
          territoryCode: userTerritory,
          organizationId: user.organizationId || org?.id || null,
          organization: orgPayload,
          isSuperAdmin: Boolean(user.isSuperAdmin),
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.permissions = (user as { permissions?: string[] }).permissions ?? []
        token.roles = (user as { roles?: string[] }).roles ?? []
        token.branchId = (user as { branchId?: string | null }).branchId ?? null
        token.branch = (user as any).branch ?? null
        token.territoryCode = (user as any).territoryCode ?? 'SA'
        token.organizationId = (user as { organizationId?: string | null }).organizationId ?? null
        token.organization = (user as { organization?: any }).organization ?? null
        token.isSuperAdmin = Boolean((user as { isSuperAdmin?: boolean }).isSuperAdmin)
      }
      return token
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id
        session.user.permissions = token.permissions
        session.user.roles = token.roles
        session.user.branchId = token.branchId
        session.user.branch = token.branch as any
        session.user.territoryCode = token.territoryCode as any
        session.user.organizationId = token.organizationId
        session.user.organization = token.organization
        session.user.isSuperAdmin = token.isSuperAdmin
      }
      return session
    },
  },
  events: {
    async signIn({ user }) {
      if (user?.id) {
        await prisma.auditLog.create({
          data: {
            userId: user.id,
            action: 'LOGIN',
            entity: 'User',
            entityId: user.id,
            metadata: {
              loginTime: new Date().toISOString(),
              status: 'SUCCESS',
            },
          },
        })
      }
    },
    async signOut({ token }) {
      // Audit log the sign out
      if (token?.id) {
        await prisma.auditLog.create({
          data: {
            userId: token.id,
            action: 'LOGOUT',
            entity: 'User',
            entityId: token.id,
          },
        })
      }
    },
  },
}
