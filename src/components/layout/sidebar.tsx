'use client'

import {
  LayoutDashboard,
  Package,
  BarChart3,
  ShoppingCart,
  ClipboardList,
  Users,
  Building2,
  TrendingDown,
  FileText,
  Settings,
  LogOut,
  ChevronDown,
  Pill,
  Receipt,
  RotateCcw,
  UserCheck,
  Truck,
  BadgeDollarSign,
  AlertTriangle,
  ScrollText,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Stethoscope,
  FileCode,
  Tag,
  ScanLine,
  Activity,
  Cpu,
  Globe,
  KeyRound,
  Lock,
  Layers,
  Database,
  Store,
  Terminal,
  Keyboard,
  Camera,
  Sparkles,
  MessageSquare,
  Calendar,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { Logo } from '@/components/shared/logo'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ROUTES } from '@/lib/constants/routes'
import { useI18n } from '@/lib/i18n/i18n-context'
import { cn } from '@/lib/utils/cn'

type BadgeVariant = 'default' | 'rose' | 'amber' | 'teal'

type NavItem = {
  label: string
  href?: string
  icon: React.ElementType
  permission?: string
  module?: string
  badge?: string
  badgeVariant?: BadgeVariant
  children?: Omit<NavItem, 'children'>[]
}

interface NavSection {
  title?: string
  items: NavItem[]
}

interface SidebarStatsData {
  inventory: {
    totalProducts: number
    lowStockCount: number
    outOfStockCount: number
    activeBatches: number
  }
  commerce: {
    todaySalesCount: number
    pendingPrescriptions: number
    todayRevenue: number
  }
  finance: {
    receiptVouchersCount: number
    activeLedgersCount: number
    pendingPayablesCount: number
  }
  clinical: {
    totalDoctors: number
    pendingCommissions: number
    activeCustomers: number
  }
  expiry: {
    expiredCount: number
    expiring30Count: number
    expiring90Count: number
  }
  telemetry: {
    mode: 'worker_threads' | 'in_process_fallback'
    durationMs: number
    threadCount: number
    allSuccessful: boolean
  }
}

// ─────────────────────────────────────────────────────────────
// AWS / CLOUD CONTROL PLANE NAVIGATION FOR PLATFORM SUPERADMIN
// SuperAdmin sees ONLY governance/platform sections — no chemist POS/billing UI
// ─────────────────────────────────────────────────────────────
const SUPERADMIN_NAV_SECTIONS: NavSection[] = [
  {
    title: 'AWS-Style Control Plane',
    items: [
      {
        label: 'Platform Overview',
        href: '/platform',
        icon: LayoutDashboard,
        badge: 'LIVE',
        badgeVariant: 'teal',
      },
      {
        label: 'Live Telemetry & Metrics',
        href: '/platform?tab=monitoring',
        icon: Cpu,
        badge: '5 THREADS',
        badgeVariant: 'teal',
      },
      {
        label: 'Geo-Political Zones & IPs',
        href: '/platform?tab=geozones',
        icon: Globe,
      },
    ],
  },
  {
    title: 'IAM & Security Governance',
    items: [
      {
        label: 'IAM Security Rules',
        href: '/platform?tab=iam',
        icon: ShieldCheck,
        badge: 'POLICIES',
        badgeVariant: 'amber',
      },
      {
        label: 'All Staff Entities & Lockout',
        href: '/platform?tab=users',
        icon: Users,
      },
      {
        label: 'Sidebar Module Access',
        href: '/platform?tab=sidebar',
        icon: Layers,
      },
    ],
  },
  {
    title: 'Tenant Orgs & Licensing',
    items: [
      {
        label: 'Tenant Chemist Shops',
        href: '/platform?tab=shops',
        icon: Store,
      },
      {
        label: '30-Day Subscriptions',
        href: '/platform?tab=subscriptions',
        icon: KeyRound,
        badge: 'LICENSES',
        badgeVariant: 'teal',
      },
      {
        label: 'Platform Financials',
        href: '/platform?tab=financials',
        icon: BadgeDollarSign,
      },
      {
        label: 'Global Drug Directory',
        href: '/platform?tab=catalog',
        icon: Database,
      },
    ],
  },
  {
    title: 'Platform Audit & Diagnostics',
    items: [
      {
        label: 'Security Audit Logs',
        href: ROUTES.AUDIT,
        icon: ScrollText,
      },
      {
        label: 'Database Backup (Excel)',
        href: ROUTES.SETTINGS_BACKUP,
        icon: Database,
        badge: 'PARALLEL',
        badgeVariant: 'teal',
      },
      {
        label: 'System Diagnostics',
        href: ROUTES.SETTINGS,
        icon: Settings,
      },
    ],
  },
]

const STATIC_NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { label: 'Dashboard', href: ROUTES.DASHBOARD, icon: LayoutDashboard, module: 'dashboard' },
      { label: 'POS / Billing', href: ROUTES.POS, icon: ShoppingCart, permission: 'sales:create', module: 'pos', badge: 'F2', badgeVariant: 'teal' },
      { label: 'POS 2 (Feature Lab)', href: ROUTES.POS2, icon: ShoppingCart, permission: 'sales:create', module: 'pos', badge: 'POS2', badgeVariant: 'teal' },
    ],
  },
  {
    title: 'Dispensary & Inventory',
    items: [
      {
        label: 'Products',
        icon: Pill,
        permission: 'products:read',
        module: 'products',
        children: [
          { label: 'All Products', href: ROUTES.PRODUCTS, icon: Package, permission: 'products:read' },
          {
            label: 'Categories',
            href: ROUTES.CATEGORIES,
            icon: ClipboardList,
            permission: 'categories:manage',
          },
          {
            label: 'HSN & Tax Codes',
            href: ROUTES.HSN_CODES,
            icon: Tag,
            permission: 'products:read',
          },
        ],
      },
      {
        label: 'Inventory',
        icon: BarChart3,
        permission: 'inventory:read',
        module: 'inventory',
        children: [
          {
            label: 'Stock Overview',
            href: ROUTES.INVENTORY,
            icon: BarChart3,
            permission: 'inventory:read',
          },
          {
            label: 'Adjustments',
            href: ROUTES.INVENTORY_ADJUSTMENTS,
            icon: ScrollText,
            permission: 'inventory:adjust',
          },
          {
            label: 'Movements',
            href: ROUTES.INVENTORY_MOVEMENTS,
            icon: TrendingDown,
            permission: 'inventory:read',
          },
          {
            label: 'Inventory Audit',
            href: ROUTES.INVENTORY_AUDIT,
            icon: ShieldCheck,
            permission: 'inventory:adjust',
          },
          { label: 'Batches', href: ROUTES.BATCHES, icon: Package, permission: 'batches:read' },
        ],
      },
      {
        label: 'Purchases',
        icon: Truck,
        permission: 'purchases:read',
        module: 'purchases',
        children: [
          {
            label: 'All Purchases',
            href: ROUTES.PURCHASES,
            icon: ClipboardList,
            permission: 'purchases:read',
          },
          {
            label: 'Scan Bill (OCR)',
            href: ROUTES.PURCHASES_SCAN,
            icon: ScanLine,
            permission: 'purchases:read',
          },
          {
            label: 'Agency Bills',
            href: ROUTES.PURCHASES_AGENCY,
            icon: Building2,
            permission: 'purchases:read',
          },
          { label: 'Suppliers', href: ROUTES.SUPPLIERS, icon: Building2, permission: 'suppliers:read' },
        ],
      },
      {
        label: 'Sales & Rx',
        icon: Receipt,
        permission: 'sales:read',
        module: 'sales',
        children: [
          { label: 'Sales History', href: ROUTES.SALES, icon: Receipt, permission: 'sales:read' },
          {
            label: 'Prescriptions',
            href: ROUTES.PRESCRIPTIONS,
            icon: FileText,
            permission: 'prescriptions:read',
          },
          { label: 'Customers', href: ROUTES.CUSTOMERS, icon: UserCheck, permission: 'customers:read' },
          { label: 'Doctor Masters', href: ROUTES.DOCTORS, icon: Stethoscope, permission: 'sales:read' },
        ],
      },
      {
        label: 'Refills & Retention',
        icon: Sparkles,
        permission: 'sales:read',
        module: 'sales',
        badge: '⚡',
        badgeVariant: 'teal',
        children: [
          { label: 'Refills & Retention Hub', href: ROUTES.REFILLS, icon: Sparkles, permission: 'sales:read' },
          { label: 'WhatsApp Automation', href: '/refills?tab=whatsapp', icon: MessageSquare, permission: 'sales:read' },
          { label: 'Customer Follow-ups', href: '/refills?tab=followups', icon: Users, permission: 'customers:read' },
          { label: 'Refill Scheduling', href: '/refills?tab=schedules', icon: Calendar, permission: 'sales:read' },
        ],
      },
      { label: 'Returns', href: ROUTES.SALE_RETURNS, icon: RotateCcw, permission: 'returns:read', module: 'returns' },
      { label: 'Batch Expiry', href: ROUTES.EXPIRY, icon: AlertTriangle, permission: 'batches:read', module: 'expiry' },
    ],
  },
  {
    title: 'Finance & Compliance',
    items: [
      {
        label: 'Financials',
        icon: BadgeDollarSign,
        permission: 'finance:read',
        module: 'finance',
        children: [
          {
            label: 'Overview',
            href: ROUTES.FINANCE,
            icon: BadgeDollarSign,
            permission: 'finance:read',
          },
          {
            label: 'Receipt Voucher',
            href: ROUTES.RECEIPT_VOUCHERS,
            icon: Receipt,
            permission: 'finance:read',
          },
          { label: 'GST Reports', href: ROUTES.GST, icon: FileText, permission: 'gst:read' },
          { label: 'Ledger & Accounts Sync', href: ROUTES.TALLY, icon: FileCode, permission: 'finance:read' },
        ],
      },
      {
        label: 'Reports & Audits',
        icon: BarChart3,
        permission: 'reports:sales',
        module: 'reports',
        children: [
          { label: 'Overview', href: ROUTES.REPORTS, icon: BarChart3, permission: 'reports:sales' },
          {
            label: 'Compliance Registers',
            href: ROUTES.REPORTS_COMPLIANCE,
            icon: ShieldAlert,
            permission: 'reports:sales',
          },
        ],
      },
    ],
  },
  {
    title: 'System',
    items: [
      {
        label: 'Settings & Users',
        icon: Shield,
        module: 'settings',
        children: [
          { label: 'Users', href: ROUTES.USERS, icon: Users, permission: 'users:read' },
          { label: 'Roles', href: ROUTES.ROLES, icon: Shield, permission: 'roles:manage' },
          { label: 'Audit Logs', href: ROUTES.AUDIT, icon: ScrollText, permission: 'audit:read' },
          { label: 'Settings', href: ROUTES.SETTINGS, icon: Settings, permission: 'settings:read' },
          { label: 'Camera & Cash Drawer', href: ROUTES.SETTINGS_CAMERA_DRAWER, icon: Camera, permission: 'settings:read', badge: '48H SEC', badgeVariant: 'teal' },
          { label: 'Database Backup (Excel)', href: ROUTES.SETTINGS_BACKUP, icon: Database, badge: '5 THREADS', badgeVariant: 'teal' },
          { label: 'Keyboard Shortcuts', href: ROUTES.SETTINGS_SHORTCUTS, icon: Keyboard, badge: 'F1', badgeVariant: 'teal' },
        ],
      },
    ],
  },
]

function NavItemComponent({ item, depth = 0 }: { item: NavItem; depth?: number }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { data: session } = useSession()
  const { t, locale } = useI18n()

  const userRoles = session?.user?.roles ?? []
  const isAdmin = Boolean(
    session?.user?.isSuperAdmin ||
    userRoles.includes('owner') ||
    userRoles.includes('admin') ||
    userRoles.includes('manager') ||
    userRoles.includes('super_admin')
  )

  const translateLabel = (label: string): string => {
    if (locale !== 'ar') return label

    const map: Record<string, string> = {
      // Core & Dispensing
      'Dashboard': 'لوحة القيادة',
      'Overview': 'نظرة عامة',
      'POS / Billing': 'نقطة البيع والصرف',
      'POS Billing': 'نقطة البيع والصرف',
      'POS 2 (Feature Lab)': 'نقطة البيع المتقدمة',
      'Products': 'الأدوية والمستحضرات',
      'All Products': 'دليل الأدوية الشامل',
      'Categories': 'التصنيفات الدوائية',
      'HSN & Tax Codes': 'الأكواد الضريبية والتعريفة',
      'Inventory': 'المخزون الدوائي',
      'Stock Overview': 'نظرة عامة على الرصيد',
      'Adjustments': 'تسويات الجرد والمخزون',
      'Movements': 'حركة الأصناف وسجل التتبع',
      'Inventory Audit': 'التدقيق الداخلي للمخزون',
      'Batches': 'سجل التشغيلات (الباتشات)',
      'Purchases': 'أوامر الشراء والتوريد',
      'All Purchases': 'سجل المشتريات',
      'Scan Bill (OCR)': 'المسح الذكي لفواتير الموردين',
      'Agency Bills': 'فواتير الوكالات والموزعين',
      'Suppliers': 'الموردون وشركات التوزيع',
      'Sales & Rx': 'المبيعات والوصفات الطبية',
      'Sales History': 'سجل فواتير المبيعات',
      'Prescriptions': 'الوصفات الطبية المعتمدة',
      'Customers': 'سجل المرضى والعملاء',
      'Doctor Masters': 'دليل الأطباء المعالجين',
      'Doctors': 'دليل الأطباء المعالجين',
      'Returns': 'مرتجعات المبيعات',
      'Batch Expiry': 'مراقبة تواريخ الصلاحية (FEFO)',
      'Expiry Watch': 'مراقبة تواريخ الصلاحية',
      'Financials': 'الحسابات والمالية',
      'Receipt Voucher': 'سند قبض',
      'Payment Voucher': 'سند صرف',
      'Expense Voucher': 'سند مصروفات',
      'GST Reports': 'تقارير الضرائب والزكاة',
      'Ledger & Accounts Sync': 'دفتر الأستاذ والمزامنة المحاسبية',
      'Reports & Audits': 'التقارير وسجلات التدقيق',
      'Reports': 'التقارير والتحليلات',
      'Compliance Registers': 'سجلات الامتثال والرقابة',
      'Settings & Users': 'الإعدادات والمستخدمين',
      'Users': 'المستخدمون والموظفون',
      'Roles': 'الأدوار والصلاحيات',
      'Audit Logs': 'سجلات تدقيق العمليات',
      'Settings': 'إعدادات المنظومة',
      'Camera & Cash Drawer': 'الكاميرا والدرج النقدي (48 ساعة)',
      'Database Backup (Excel)': 'النسخ الاحتياطي لقاعدة البيانات',
      'Database Backup': 'النسخ الاحتياطي لقاعدة البيانات',
      'Keyboard Shortcuts': 'اختصارات لوحة المفاتيح',
      'Telemetry & Health': 'القياس الأمني المباشر',
      
      // SuperAdmin Navigation
      'Platform Overview': 'نظرة عامة على المنصة السحابية',
      'Live Telemetry & Metrics': 'القياس الأمني المباشر (5 خيوط)',
      'Geo-Political Zones & IPs': 'النطاقات الجيوسياسية وعناوين IP',
      'IAM Security Rules': 'سياسات الوصول وأمان IAM',
      'All Staff Entities & Lockout': 'إدارة الموظفين والحسابات المقفلة',
      'Sidebar Module Access': 'صلاحيات الوصول لوحدات النظام',
      'Tenant Chemist Shops': 'الصيدليات والمتاجر المشتركة',
      '30-Day Subscriptions': 'التراخيص والاشتراكات الشهرية',
      'Platform Financials': 'إيرادات المنصة والاشتراكات',
      'Global Drug Directory': 'الدليل الدوائي الموحد',
      'Security Audit Logs': 'سجلات أمان النظام السحابي',
      'System Diagnostics': 'الفحص والتشخيص الفني',
    }
    return map[label] || label
  }

  const isLinkActive = (href?: string) => {
    if (!href) return false
    if (href.includes('?tab=')) {
      const targetTab = href.split('?tab=')[1]
      return pathname === '/platform' && searchParams.get('tab') === targetTab
    }
    if (href === '/platform') {
      const currentTab = searchParams.get('tab')
      return pathname === '/platform' && (!currentTab || currentTab === 'monitoring' || currentTab === 'overview')
    }
    return pathname === href
  }

  if (item.children) {
    const isActiveParent = item.children.some((child) => isLinkActive(child.href))

    return (
      <Collapsible defaultOpen={isAdmin ? true : isActiveParent}>
        <CollapsibleTrigger className="group flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition-all hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/60 dark:hover:text-slate-100">
          <span className="flex items-center gap-2.5">
            <div
              className={cn(
                'flex h-6 w-6 shrink-0 items-center justify-center rounded-lg transition-all duration-150',
                isActiveParent
                  ? 'bg-teal-100 text-teal-800 dark:bg-teal-950/80 dark:text-teal-300'
                  : 'bg-muted/80 text-muted-foreground group-hover:bg-teal-50 group-hover:text-teal-700 dark:group-hover:bg-slate-800'
              )}
            >
              <item.icon className="h-3.5 w-3.5" />
            </div>
            <span>{translateLabel(item.label)}</span>
            {item.badge && (
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-bold tabular-nums',
                  item.badgeVariant === 'rose'
                    ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                    : item.badgeVariant === 'amber'
                      ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300'
                      : item.badgeVariant === 'teal'
                        ? 'bg-teal-100 text-teal-800 dark:bg-teal-900/60 dark:text-teal-300'
                        : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                )}
              >
                {item.badgeVariant === 'rose' && <span className="beacon-rose scale-75 origin-center"><span className="core-dot" /></span>}
                {item.badgeVariant === 'amber' && <span className="beacon-amber scale-75 origin-center"><span className="core-dot" /></span>}
                {item.badgeVariant === 'teal' && <span className="beacon-emerald scale-75 origin-center"><span className="core-dot" /></span>}
                {item.badge}
              </span>
            )}
          </span>
          <ChevronDown className="h-3 w-3 text-slate-400 transition-transform [[data-state=open]>&]:rotate-180" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="ml-3 rtl:mr-3 rtl:ml-0 mt-1 space-y-0.5 border-l rtl:border-r rtl:border-l-0 border-slate-200/80 pl-2 rtl:pr-2 rtl:pl-0 dark:border-slate-800">
            {item.children.map((child) => (
              <NavItemComponent key={child.label} item={child} depth={depth + 1} />
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    )
  }

  const isActive = isLinkActive(item.href)

  return (
    <Link
      href={item.href!}
      className={cn(
        'group flex items-center justify-between rounded-xl px-2.5 py-1.5 text-xs font-semibold transition-all duration-150',
        isActive
          ? 'bg-teal-50 text-teal-950 font-bold border-l-2 rtl:border-r-2 rtl:border-l-0 border-teal-600 pl-[8px] rtl:pr-[8px] rtl:pl-[8px] dark:bg-teal-950/50 dark:text-teal-200 dark:border-teal-400 shadow-2xs'
          : 'text-slate-600 hover:bg-slate-100/90 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-100'
      )}
    >
      <span className="flex items-center gap-2.5">
        <div
          className={cn(
            'flex h-6 w-6 shrink-0 items-center justify-center rounded-lg transition-all duration-150',
            isActive
              ? 'bg-teal-600 text-white shadow-2xs scale-105'
              : 'bg-muted/70 text-muted-foreground group-hover:bg-teal-50 group-hover:text-teal-700 dark:group-hover:bg-teal-950/40 dark:group-hover:text-teal-300'
          )}
        >
          <item.icon className="h-3.5 w-3.5" />
        </div>
        <span>{translateLabel(item.label)}</span>
      </span>
      {item.badge && (
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-bold tabular-nums transition-all',
            item.badgeVariant === 'rose'
              ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
              : item.badgeVariant === 'amber'
                ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300'
                : item.badgeVariant === 'teal'
                  ? 'bg-teal-100 text-teal-800 dark:bg-teal-900/60 dark:text-teal-300'
                  : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
          )}
        >
          {item.badgeVariant === 'rose' && <span className="beacon-rose scale-75 origin-center"><span className="core-dot" /></span>}
          {item.badgeVariant === 'amber' && <span className="beacon-amber scale-75 origin-center"><span className="core-dot" /></span>}
          {item.badgeVariant === 'teal' && <span className="beacon-emerald scale-75 origin-center"><span className="core-dot" /></span>}
          {item.badge}
        </span>
      )}
    </Link>
  )
}

export function Sidebar() {
  const { data: session, status } = useSession()
  const { t, locale } = useI18n()
  const [stats, setStats] = useState<SidebarStatsData | null>(null)

  const translateSectionTitle = (title: string): string => {
    if (locale !== 'ar') return title
    const map: Record<string, string> = {
      'Dispensary Operations & Intelligence': 'عمليات الصيدلية والذكاء التشغيلي',
      'Dispensary & Inventory': 'الصرف والمخزون الدوائي',
      'Finance & Compliance': 'المالية والامتثال الضريبي',
      'System': 'إعدادات المنظومة والنظام',
      'AWS-Style Control Plane': 'لوحة التحكم السحابية السيادية',
      'IAM & Security Governance': 'إدارة الهوية والحوكمة الأمنية',
      'Tenant Orgs & Licensing': 'المنشآت الصيدلانية والتراخيص',
      'Platform Audit & Diagnostics': 'سجلات التدقيق وتشخيص النظام',
    }
    return map[title] || title
  }

  const translateRole = (role: string): string => {
    if (locale !== 'ar') return role
    const map: Record<string, string> = {
      'Admin': 'مدير المنظومة',
      'Store Manager': 'مدير الصيدلية',
      'Pharmacist': 'الصيدلي المسؤول',
      'Cashier': 'أمين الصندوق / صراف',
      'Staff': 'موظف صيدلية',
    }
    return map[role] || role
  }

  useEffect(() => {
    // Only fetch when authenticated — avoids 307 redirect waste
    if (status !== 'authenticated') return

    let active = true
    let retryCount = 0
    const MAX_RETRIES = 3

    async function loadStats() {
      try {
        const branchParam = session?.user?.branchId
          ? `?branchId=${encodeURIComponent(session.user.branchId)}`
          : ''
        const res = await fetch(`/api/db/parallel-fetch${branchParam}`, {
          cache: 'no-store',
          credentials: 'same-origin',
        })
        if (res.ok) {
          const json = await res.json()
          if (json.success && json.stats && active) {
            setStats(json.stats)
            retryCount = 0 // reset on success
          }
        } else if (res.status !== 307 && res.status !== 401) {
          // Only retry on genuine server errors, not auth redirects
          retryCount++
          if (retryCount <= MAX_RETRIES) {
            setTimeout(loadStats, retryCount * 2000)
          }
        }
      } catch {
        // Network error — silently preserve current state
        retryCount++
      }
    }

    loadStats()
    const timer = setInterval(loadStats, 15000)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [status])

  const handleLogout = async () => {
    await signOut({ callbackUrl: ROUTES.LOGIN })
    toast.success('Signed out successfully')
  }

  const [mounted, setMounted] = useState(false)
  const [assignedModules, setAssignedModules] = useState<string[] | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (status !== 'authenticated') return
    async function loadSidebarModules() {
      try {
        const res = await fetch('/api/user/sidebar')
        if (res.ok) {
          const json = await res.json()
          if (json.success && Array.isArray(json.modules)) {
            setAssignedModules(json.modules)
          }
        }
      } catch {
        // Fallback to role permissions
      }
    }
    loadSidebarModules()
  }, [status])

  const userRoles = session?.user?.roles ?? []
  const userPermissions = session?.user?.permissions ?? []
  const isOwner = userRoles.includes('owner')
  const isSuperAdmin = Boolean(session?.user?.isSuperAdmin)

  const hasAccess = (perm?: string, mod?: string) => {
    if (!mounted) return true
    if (isSuperAdmin) return true
    if (mod && assignedModules && !assignedModules.includes(mod)) return false
    if (!perm || isOwner) return true
    return userPermissions.includes(perm)
  }

  const roleLabel = isOwner
    ? 'Admin'
    : userRoles.includes('manager')
      ? 'Store Manager'
      : userRoles.includes('pharmacist')
        ? 'Pharmacist'
        : userRoles.includes('cashier')
          ? 'Cashier'
          : (userRoles[0] ?? 'Staff')

  // Dynamically attach live synchronized counts to navigation items
  const navSections = useMemo(() => {
    if (isSuperAdmin) {
      return SUPERADMIN_NAV_SECTIONS
    }

    return STATIC_NAV_SECTIONS.map((section) => ({
      ...section,
      items: section.items.map((item) => {
        let enhanced = { ...item }

        if (item.children) {
          // Wire child-level live badges
          enhanced.children = item.children.map((child) => {
            let childEnhanced = { ...child }
            if (child.href === ROUTES.PRODUCTS && (stats?.inventory?.totalProducts ?? 0) > 0) {
              childEnhanced.badge = `${stats!.inventory.totalProducts}`
              childEnhanced.badgeVariant = 'teal'
            } else if (child.href === ROUTES.INVENTORY && (stats?.inventory?.lowStockCount ?? 0) > 0) {
              childEnhanced.badge = `${stats!.inventory.lowStockCount} low`
              childEnhanced.badgeVariant = 'amber'
            } else if (child.href === ROUTES.BATCHES && (stats?.inventory?.activeBatches ?? 0) > 0) {
              childEnhanced.badge = `${stats!.inventory.activeBatches}`
              childEnhanced.badgeVariant = 'teal'
            } else if (child.href === ROUTES.PRESCRIPTIONS && (stats?.commerce?.pendingPrescriptions ?? 0) > 0) {
              childEnhanced.badge = `${stats!.commerce.pendingPrescriptions}`
              childEnhanced.badgeVariant = 'amber'
            } else if (child.href === ROUTES.SALES && (stats?.commerce?.todaySalesCount ?? 0) > 0) {
              childEnhanced.badge = `${stats!.commerce.todaySalesCount}`
              childEnhanced.badgeVariant = 'default'
            } else if (child.href === ROUTES.CUSTOMERS && (stats?.clinical?.activeCustomers ?? 0) > 0) {
              childEnhanced.badge = `${stats!.clinical.activeCustomers}`
              childEnhanced.badgeVariant = 'default'
            } else if (child.href === ROUTES.DOCTORS && (stats?.clinical?.totalDoctors ?? 0) > 0) {
              childEnhanced.badge = `${stats!.clinical.totalDoctors}`
              childEnhanced.badgeVariant = 'teal'
            } else if (child.href === ROUTES.RECEIPT_VOUCHERS && (stats?.finance?.receiptVouchersCount ?? 0) > 0) {
              childEnhanced.badge = `${stats!.finance.receiptVouchersCount}`
              childEnhanced.badgeVariant = 'teal'
            }
            return childEnhanced
          })

          // Wire parent-group level alert badges (low stock, pending prescriptions)
          if (item.label === 'Inventory' && (stats?.inventory?.lowStockCount ?? 0) > 0) {
            enhanced.badge = `${stats!.inventory.lowStockCount}`
            enhanced.badgeVariant = 'amber'
          } else if (item.label === 'Sales & Rx' && (stats?.commerce?.pendingPrescriptions ?? 0) > 0) {
            enhanced.badge = `${stats!.commerce.pendingPrescriptions}`
            enhanced.badgeVariant = 'amber'
          }
        }

        // Top-level non-collapsible badge: Batch Expiry
        if (item.href === ROUTES.EXPIRY && stats?.expiry) {
          const alertCount = (stats.expiry.expiredCount || 0) + (stats.expiry.expiring30Count || 0)
          if (alertCount > 0) {
            enhanced.badge = `${alertCount}`
            enhanced.badgeVariant = 'rose'
          }
        }

        return enhanced
      }),
    }))
  }, [isSuperAdmin, stats])

  return (
    <aside className="flex h-screen w-64 min-w-[16rem] shrink-0 flex-col border-r rtl:border-l rtl:border-r-0 border-border/80 bg-card select-none">
      {/* Brand Header */}
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-border/70 px-4">
        <Logo size="md" />
        <div className="flex items-center gap-1.5" title="Dispensary Operational & In-Sync">
          <span className="beacon-emerald"><span className="core-dot" /></span>
        </div>
      </div>

      {/* Categorized Navigation */}
      <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-4">
        {navSections.map((section, idx) => {
          const filteredItems = section.items
            .map((item) => {
              if (item.children) {
                if (item.module && assignedModules && !assignedModules.includes(item.module) && !isSuperAdmin) {
                  return null
                }
                const allowedChildren = item.children.filter((child) => hasAccess(child.permission, child.module || item.module))
                if (allowedChildren.length === 0) return null
                return { ...item, children: allowedChildren }
              }
              return hasAccess(item.permission, item.module) ? item : null
            })
            .filter((item): item is NavItem => item !== null)

          if (filteredItems.length === 0) return null

          return (
            <div key={idx} className="space-y-1">
              {section.title && (
                <div className="px-2.5 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                  {translateSectionTitle(section.title)}
                </div>
              )}
              {filteredItems.map((item) => (
                <NavItemComponent key={item.label} item={item} />
              ))}
            </div>
          )
        })}
      </nav>

      {/* User Section & Station Information */}
      <div className="border-t border-border/70 p-3 bg-muted/20">
        {session?.user?.isSuperAdmin && (
          <div className="mb-2 p-2 rounded-lg border border-amber-500/40 bg-amber-500/10 text-xs font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-2">
            <Shield className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <div className="min-w-0">
              <div className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                {locale === 'ar' ? 'لوحة التحكم السحابية السيادية' : 'AWS Root Control Plane'}
              </div>
              <div className="text-[10px] text-amber-600/90 dark:text-amber-400/90 truncate">
                {locale === 'ar' ? 'الحوكمة العالمية متعددة المنشآت' : 'Multi-Tenant Global Governance'}
              </div>
            </div>
          </div>
        )}

        <div className="mb-2 flex items-center gap-2.5 rounded-lg border border-border/60 bg-card p-2.5 shadow-2xs">
          <div
            className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-semibold text-xs',
              session?.user?.isSuperAdmin
                ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200'
                : 'bg-teal-100 text-teal-800 dark:bg-teal-900/60 dark:text-teal-200'
            )}
          >
            {session?.user?.name?.charAt(0)?.toUpperCase() ?? 'U'}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <p className="truncate text-xs font-semibold text-foreground">
                {session?.user?.name ?? (locale === 'ar' ? 'موظف الصيدلية' : 'Staff User')}
              </p>
            </div>
            <p className="truncate text-[10px] text-muted-foreground">
              {session?.user?.isSuperAdmin
                ? (locale === 'ar' ? 'المشرف العام السيادي' : 'Global Root Administrator')
                : `${translateRole(roleLabel)} • ${session?.user?.organization?.name ?? (locale === 'ar' ? 'المستودع الرئيسي' : 'Main Dispensary')}`}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-xs text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:text-rose-400 dark:hover:bg-rose-950/40"
          onClick={handleLogout}
        >
          <LogOut className="h-3.5 w-3.5" />
          {locale === 'ar' ? 'تسجيل الخروج' : 'End Session'}
        </Button>
      </div>
    </aside>
  )
}
