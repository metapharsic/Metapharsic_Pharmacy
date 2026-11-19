'use client'

import {
  Calendar,
  Check,
  Copy,
  ExternalLink,
  Eye,
  FileSpreadsheet,
  Loader2,
  MessageSquare,
  Phone,
  Pill,
  Printer,
  RefreshCw,
  Search,
  Send,
  ShoppingCart,
  Stethoscope,
} from 'lucide-react'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { WhatsAppInvoiceDialog } from '@/components/sales/whatsapp-invoice-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/lib/hooks/use-toast'
import { downloadExcelWorkbook } from '@/lib/reports/excel-export-service'
import type { ExecutiveDigestData } from '@/lib/reports/executive-digest-service'
import { formatCurrency } from '@/lib/utils/currency'
import { formatDate } from '@/lib/utils/date'
import { generateWaMeLink } from '@/lib/whatsapp/whatsapp-service'


// ─── Data Types ───────────────────────────────────────────────

type SaleReportRow = {
  id: string
  invoiceNumber: string
  saleDate: string
  status: string
  paymentMethod: string
  customerName: string
  customerPhone: string
  doctorName: string
  subtotal: number
  discountAmount: number
  taxAmount: number
  totalAmount: number
  amountPaid: number
  balanceDue: number
  itemsCount: number
  items: {
    id: string
    productName: string
    batchNumber: string
    expiryDate?: string
    quantity: number
    unitPrice: number
    discountPercent: number
    taxPercent: number
    totalAmount: number
  }[]
}

type PrescriptionReportRow = {
  id: string
  rxNumber: string
  patientName: string
  patientPhone?: string
  patientAge?: number
  doctorName?: string
  doctorRegNumber?: string
  doctorClinic?: string
  doctorSpecialization?: string
  notes?: string
  status: string
  createdAt: string
  sale?: {
    id: string
    invoiceNumber: string
    totalAmount: number
    status: string
  } | null
}

type DoctorReportRow = {
  id: string
  name: string
  regNumber: string
  qualification: string
  specialization: string
  clinicName: string
  phone: string
  email: string
  commissionPercent: number
  prescriptionsCount: number
  salesCount: number
  totalSalesRevenue: number
  totalCommission: number
  paidCommission: number
  pendingCommission: number
}

export function ReportsHubClient() {
  const [activeTab, setActiveTab] = useState('sales')
  const [search, setSearch] = useState('')
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'custom'>('monthly')
  const toast = useToast()

  // Sales data
  const [sales, setSales] = useState<SaleReportRow[]>([])
  const [loadingSales, setLoadingSales] = useState(false)
  const [selectedSale, setSelectedSale] = useState<SaleReportRow | null>(null)
  const [saleModalOpen, setSaleModalOpen] = useState(false)

  // Prescriptions data
  const [prescriptions, setPrescriptions] = useState<PrescriptionReportRow[]>([])
  const [loadingRx, setLoadingRx] = useState(false)
  const [selectedRx, setSelectedRx] = useState<PrescriptionReportRow | null>(null)
  const [rxModalOpen, setRxModalOpen] = useState(false)

  // Doctors data
  const [doctors, setDoctors] = useState<DoctorReportRow[]>([])
  const [loadingDoctors, setLoadingDoctors] = useState(false)
  const [selectedDoctor, setSelectedDoctor] = useState<DoctorReportRow | null>(null)
  const [doctorModalOpen, setDoctorModalOpen] = useState(false)

  // WhatsApp Report Sharing State
  const [whatsAppReportModalOpen, setWhatsAppReportModalOpen] = useState(false)
  const [reportPeriodForWhatsApp, setReportPeriodForWhatsApp] = useState<'daily' | 'weekly' | 'monthly'>('daily')
  const [digestData, setDigestData] = useState<ExecutiveDigestData | null>(null)
  const [loadingDigest, setLoadingDigest] = useState(false)
  const [whatsAppPhone, setWhatsAppPhone] = useState('')
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false)
  const [copiedReportText, setCopiedReportText] = useState(false)
  const [invoiceWhatsAppOpen, setInvoiceWhatsAppOpen] = useState(false)

  const openWhatsAppReportShare = async (selectedPeriod: 'daily' | 'weekly' | 'monthly') => {
    setReportPeriodForWhatsApp(selectedPeriod)
    setWhatsAppReportModalOpen(true)
    setLoadingDigest(true)
    try {
      const res = await fetch(`/api/reports/daily-closing/whatsapp?period=${selectedPeriod}`)
      const json = (await res.json()) as { success?: boolean; data?: ExecutiveDigestData; error?: string }
      if (json.success && json.data) {
        setDigestData(json.data)
        if (json.data.ownerPhone) {
          setWhatsAppPhone((prev) => prev || json.data!.ownerPhone)
        }
      } else {
        toast.error('Failed to load report summary')
      }
    } catch {
      toast.error('Failed to connect to report digest service')
    } finally {
      setLoadingDigest(false)
    }
  }

  const handleSendReportViaApi = async () => {
    if (!whatsAppPhone.trim()) {
      toast.error('Please enter a recipient phone number')
      return
    }

    try {
      setSendingWhatsApp(true)
      const res = await fetch('/api/reports/daily-closing/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          period: reportPeriodForWhatsApp,
          phone: whatsAppPhone.trim(),
        }),
      })
      const json = (await res.json()) as { success?: boolean; message?: string; error?: string }
      if (res.ok && json.success) {
        toast.success(`${reportPeriodForWhatsApp.toUpperCase()} Digest Dispatched`, json.message)
        setWhatsAppReportModalOpen(false)
      } else {
        toast.error('Failed to dispatch digest', json.error || 'Server error')
      }
    } catch {
      toast.error('Network error dispatching WhatsApp digest')
    } finally {
      setSendingWhatsApp(false)
    }
  }

  const handleCopyReportText = () => {
    if (!digestData?.formattedWhatsAppText) return
    void navigator.clipboard.writeText(digestData.formattedWhatsAppText)
    setCopiedReportText(true)
    toast.success('Report text copied to clipboard')
    setTimeout(() => setCopiedReportText(false), 2000)
  }

  const reportWaMeLink = useMemo(() => {
    if (!whatsAppPhone.trim() || !digestData?.formattedWhatsAppText) return ''
    try {
      return generateWaMeLink(whatsAppPhone.trim(), digestData.formattedWhatsAppText)
    } catch {
      return ''
    }
  }, [whatsAppPhone, digestData])

  // Fetch functions
  const fetchSales = useCallback(async () => {
    setLoadingSales(true)
    try {
      const res = await fetch(
        `/api/reports/sales-detailed?search=${encodeURIComponent(search)}&period=${period}`
      )
      const json = (await res.json()) as { success?: boolean; data?: SaleReportRow[] }
      if (json.success && Array.isArray(json.data)) {
        setSales(json.data)
      }
    } catch {
      toast.error('Failed to load sales report')
    } finally {
      setLoadingSales(false)
    }
  }, [search, period, toast])

  const fetchPrescriptions = useCallback(async () => {
    setLoadingRx(true)
    try {
      const res = await fetch(`/api/reports/prescriptions?search=${encodeURIComponent(search)}`)
      const json = (await res.json()) as { success?: boolean; data?: PrescriptionReportRow[] }
      if (json.success && Array.isArray(json.data)) {
        setPrescriptions(json.data)
      }
    } catch {
      toast.error('Failed to load prescriptions report')
    } finally {
      setLoadingRx(false)
    }
  }, [search, toast])

  const fetchDoctors = useCallback(async () => {
    setLoadingDoctors(true)
    try {
      const res = await fetch(`/api/reports/doctors?search=${encodeURIComponent(search)}`)
      const json = (await res.json()) as { success?: boolean; data?: DoctorReportRow[] }
      if (json.success && Array.isArray(json.data)) {
        setDoctors(json.data)
      }
    } catch {
      toast.error('Failed to load doctors report')
    } finally {
      setLoadingDoctors(false)
    }
  }, [search, toast])

  useEffect(() => {
    if (activeTab === 'sales') void fetchSales()
    if (activeTab === 'prescriptions') void fetchPrescriptions()
    if (activeTab === 'doctors') void fetchDoctors()
  }, [activeTab, search, period, fetchSales, fetchPrescriptions, fetchDoctors])

  // Single-Click Excel (.xlsx) Export Utilities
  const exportSalesExcel = () => {
    if (!sales || sales.length === 0) {
      toast.error('No sales records available to export')
      return
    }

    const completedSales = sales.filter((s) => s.status === 'COMPLETED')
    const completedRevenue = completedSales.reduce((a, b) => a + (b.totalAmount || 0), 0)
    const totalTax = sales.reduce((a, b) => a + (b.taxAmount || 0), 0)
    const totalDiscount = sales.reduce((a, b) => a + (b.discountAmount || 0), 0)
    const totalSubtotal = sales.reduce((a, b) => a + (b.subtotal || 0), 0)
    const totalItems = sales.reduce((a, b) => a + (b.itemsCount || 0), 0)

    downloadExcelWorkbook({
      filename: `Sales_Report_${period}_${new Date().toISOString().slice(0, 10)}.xlsx`,
      organizationName: 'Metapharsic Pharmacy',
      sheets: [
        {
          sheetName: 'Executive Summary',
          title: `Sales Performance & Financial Summary (${period.toUpperCase()})`,
          subtitle: `Generated on ${new Date().toLocaleDateString()}`,
          metadata: {
            Period: period.toUpperCase(),
            'Total Invoices': sales.length,
            'Total Completed Revenue': `₹${completedRevenue.toFixed(2)}`,
            'Total Tax Collected': `₹${totalTax.toFixed(2)}`,
            'Total Discounts Given': `₹${totalDiscount.toFixed(2)}`,
            'Average Bill Value': `₹${sales.length > 0 ? (completedRevenue / sales.length).toFixed(2) : '0.00'}`,
          },
          headers: ['Metric', 'Value'],
          data: [
            ['Total Invoices Recorded', sales.length],
            ['Completed Sales Count', completedSales.length],
            ['Gross Revenue Completed (₹)', completedRevenue],
            ['Total Tax Collected (₹)', totalTax],
            ['Total Discounts (₹)', totalDiscount],
            ['Average Order Value (₹)', sales.length > 0 ? Math.round((completedRevenue / sales.length) * 100) / 100 : 0],
          ],
        },
        {
          sheetName: 'Sales Ledger',
          title: 'Detailed Sales Transaction Register',
          headers: [
            'Invoice Number',
            'Date',
            'Customer Name',
            'Doctor',
            'Items Count',
            'Subtotal (₹)',
            'Discount (₹)',
            'Tax (₹)',
            'Total Amount (₹)',
            'Payment Mode',
            'Status',
          ],
          data: sales.map((s) => [
            s.invoiceNumber,
            s.saleDate ? new Date(s.saleDate).toLocaleDateString() : '—',
            s.customerName || 'Walk-in Customer',
            s.doctorName || 'General',
            s.itemsCount || 0,
            s.subtotal || 0,
            s.discountAmount || 0,
            s.taxAmount || 0,
            s.totalAmount || 0,
            s.paymentMethod || 'CASH',
            s.status || 'COMPLETED',
          ]),
          summaryRow: [
            'Total / Summary',
            '',
            '',
            '',
            totalItems,
            totalSubtotal,
            totalDiscount,
            totalTax,
            completedRevenue,
            '',
            `${sales.length} Invoices`,
          ],
        },
      ],
    })
    toast.success('Sales report exported as Excel (.xlsx)')
  }

  const exportPrescriptionsExcel = () => {
    if (!prescriptions || prescriptions.length === 0) {
      toast.error('No prescriptions available to export')
      return
    }

    downloadExcelWorkbook({
      filename: `Prescriptions_Report_${period}_${new Date().toISOString().slice(0, 10)}.xlsx`,
      organizationName: 'Metapharsic Pharmacy',
      sheets: [
        {
          sheetName: 'Prescriptions Register',
          title: 'Prescription Ledger & Billing Register',
          subtitle: `Generated on ${new Date().toLocaleDateString()}`,
          metadata: {
            'Total Prescriptions': prescriptions.length,
            'Pending Prescriptions': prescriptions.filter((p) => p.status === 'PENDING').length,
          },
          headers: [
            'Rx Number',
            'Date',
            'Patient Name',
            'Age',
            'Phone',
            'Doctor Name',
            'Doctor Reg No',
            'Clinical Notes',
            'Linked Invoice',
            'Status',
          ],
          data: prescriptions.map((p) => [
            p.rxNumber,
            p.createdAt ? new Date(p.createdAt).toLocaleDateString() : '—',
            p.patientName,
            p.patientAge || '—',
            p.patientPhone || '—',
            p.doctorName || 'Unassigned',
            p.doctorRegNumber || '—',
            p.notes || '—',
            p.sale?.invoiceNumber || 'Not Billed',
            p.status,
          ]),
          summaryRow: ['Total / Summary', '', '', '', '', '', '', '', '', `${prescriptions.length} Records`],
        },
      ],
    })
    toast.success('Prescriptions report exported as Excel (.xlsx)')
  }

  const exportDoctorsExcel = () => {
    if (!doctors || doctors.length === 0) {
      toast.error('No doctor records available to export')
      return
    }

    const totalRx = doctors.reduce((a, b) => a + (b.prescriptionsCount || 0), 0)
    const totalSls = doctors.reduce((a, b) => a + (b.salesCount || 0), 0)
    const totalRev = doctors.reduce((a, b) => a + (b.totalSalesRevenue || 0), 0)
    const totalComm = doctors.reduce((a, b) => a + (b.totalCommission || 0), 0)
    const totalPaid = doctors.reduce((a, b) => a + (b.paidCommission || 0), 0)
    const totalPending = doctors.reduce((a, b) => a + (b.pendingCommission || 0), 0)

    downloadExcelWorkbook({
      filename: `Doctors_Performance_Report_${new Date().toISOString().slice(0, 10)}.xlsx`,
      organizationName: 'Metapharsic Pharmacy',
      sheets: [
        {
          sheetName: 'Doctor Performance',
          title: 'Doctor Referral & Commission Register',
          headers: [
            'Doctor Name',
            'Reg Number',
            'Qualification',
            'Specialization',
            'Clinic',
            'Phone',
            'Prescriptions Referred',
            'Sales Referred',
            'Revenue Generated (₹)',
            'Total Commission (₹)',
            'Paid Commission (₹)',
            'Pending Commission (₹)',
          ],
          data: doctors.map((d) => [
            d.name,
            d.regNumber || '—',
            d.qualification || '—',
            d.specialization || '—',
            d.clinicName || '—',
            d.phone || '—',
            d.prescriptionsCount || 0,
            d.salesCount || 0,
            d.totalSalesRevenue || 0,
            d.totalCommission || 0,
            d.paidCommission || 0,
            d.pendingCommission || 0,
          ]),
          summaryRow: [
            'Total / Summary',
            '',
            '',
            '',
            '',
            '',
            totalRx,
            totalSls,
            totalRev,
            totalComm,
            totalPaid,
            totalPending,
          ],
        },
      ],
    })
    toast.success('Doctors report exported as Excel (.xlsx)')
  }


  // Calculations for summary chips
  const totalSalesRevenue = sales.reduce((a, b) => a + (b.status === 'COMPLETED' ? b.totalAmount : 0), 0)
  const totalTaxAmount = sales.reduce((a, b) => a + b.taxAmount, 0)
  const totalPrescriptionsCount = prescriptions.length
  const pendingRxCount = prescriptions.filter((p) => p.status === 'PENDING').length
  const totalDoctorsCount = doctors.length
  const totalDocRevenue = doctors.reduce((a, b) => a + b.totalSalesRevenue, 0)

  return (
    <div className="space-y-5">
      {/* Top Filter & Download Bar */}
      <Card>
        <CardContent className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={`Search ${activeTab} records…`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 text-xs h-9"
            />
          </div>

          <div className="flex items-center gap-2">
            <Select value={period} onValueChange={(val: 'daily' | 'weekly' | 'monthly' | 'custom') => setPeriod(val)}>
              <SelectTrigger className="h-9 text-xs w-44 bg-background">
                <Calendar className="h-3.5 w-3.5 mr-1.5 opacity-70" />
                <SelectValue placeholder="Period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily (Today)</SelectItem>
                <SelectItem value="weekly">Weekly (Last 7 Days)</SelectItem>
                <SelectItem value="monthly">Monthly (Current Month)</SelectItem>
                <SelectItem value="custom">All Time</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (activeTab === 'sales') void fetchSales()
                if (activeTab === 'prescriptions') void fetchPrescriptions()
                if (activeTab === 'doctors') void fetchDoctors()
              }}

              className="h-9 text-xs"
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Refresh
            </Button>

            <Button
              size="sm"
              onClick={() => {
                if (activeTab === 'sales') exportSalesExcel()
                if (activeTab === 'prescriptions') exportPrescriptionsExcel()
                if (activeTab === 'doctors') exportDoctorsExcel()
              }}
              className="h-9 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium gap-1.5 shadow-sm"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              Download Excel
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => openWhatsAppReportShare(period === 'custom' ? 'daily' : period)}
              className="h-9 text-xs text-emerald-600 border-emerald-500/30 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 gap-1.5 font-medium"
              title="Share report summary via WhatsApp"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Share WhatsApp
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              className="h-9 text-xs"
            >
              <Printer className="h-3.5 w-3.5 mr-1.5" />
              Print Report
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Main Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-muted/70 p-1 w-full justify-start overflow-x-auto">
          <TabsTrigger value="sales" className="gap-2 text-xs font-semibold">
            <ShoppingCart className="h-3.5 w-3.5" />
            Sales &amp; Financials ({sales.length})
          </TabsTrigger>
          <TabsTrigger value="prescriptions" className="gap-2 text-xs font-semibold">
            <Pill className="h-3.5 w-3.5" />
            Prescriptions &amp; Dispensing ({prescriptions.length})
          </TabsTrigger>
          <TabsTrigger value="doctors" className="gap-2 text-xs font-semibold">
            <Stethoscope className="h-3.5 w-3.5" />
            Doctors &amp; Referrals ({doctors.length})
          </TabsTrigger>
        </TabsList>

        {/* ─── TAB 1: SALES REPORT ────────────────────────────── */}
        <TabsContent value="sales" className="space-y-4">
          {/* WhatsApp Executive Summary Action Bar for Daily, Weekly, and Monthly */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 p-3 rounded-lg border border-emerald-500/30 bg-emerald-950/10 dark:bg-emerald-950/20">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <div>
                <span className="text-xs font-semibold text-foreground">
                  WhatsApp Executive Report Digests
                </span>
                <p className="text-[11px] text-muted-foreground">
                  Instant 1-click financial and operational summaries formatted for WhatsApp
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => openWhatsAppReportShare('daily')}
                className={`h-7 text-xs border-emerald-500/40 gap-1.5 font-medium ${period === 'daily' ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10'}`}
              >
                <MessageSquare className="h-3 w-3" />
                Daily Digest
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => openWhatsAppReportShare('weekly')}
                className={`h-7 text-xs border-emerald-500/40 gap-1.5 font-medium ${period === 'weekly' ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10'}`}
              >
                <MessageSquare className="h-3 w-3" />
                Weekly Digest
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => openWhatsAppReportShare('monthly')}
                className={`h-7 text-xs border-emerald-500/40 gap-1.5 font-medium ${period === 'monthly' ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10'}`}
              >
                <MessageSquare className="h-3 w-3" />
                Monthly Digest
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card>
              <CardContent className="p-3">
                <span className="text-[11px] text-muted-foreground uppercase font-semibold">Total Revenue</span>
                <p className="text-xl font-bold text-foreground">
                  {totalSalesRevenue > 0 ? formatCurrency(totalSalesRevenue) : '—'}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <span className="text-[11px] text-muted-foreground uppercase font-semibold">Total Invoices</span>
                <p className="text-xl font-bold text-foreground">{sales.length > 0 ? sales.length : '—'}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <span className="text-[11px] text-muted-foreground uppercase font-semibold">Tax Collected</span>
                <p className="text-xl font-bold text-foreground">
                  {totalTaxAmount > 0 ? formatCurrency(totalTaxAmount) : '—'}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <span className="text-[11px] text-muted-foreground uppercase font-semibold">Completed Sales</span>
                <p className="text-xl font-bold text-foreground">
                  {sales.filter((s) => s.status === 'COMPLETED').length > 0
                    ? sales.filter((s) => s.status === 'COMPLETED').length
                    : '—'}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <tr className="border-b border-border/70 bg-muted/40 font-semibold text-muted-foreground text-xs">
                    <th className="py-2.5 px-3 text-left">Invoice #</th>
                    <th className="py-2.5 px-3 text-left">Date</th>
                    <th className="py-2.5 px-3 text-left">Customer</th>
                    <th className="py-2.5 px-3 text-left">Prescribing Doctor</th>
                    <th className="py-2.5 px-3 text-right">Items</th>
                    <th className="py-2.5 px-3 text-right">Net Total</th>
                    <th className="py-2.5 px-3 text-left">Payment</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3 text-center w-24">Actions</th>
                  </tr>
                </TableHeader>
                <TableBody>
                  {loadingSales ? (
                    <TableRow>
                      <TableCell colSpan={9} className="h-32 text-center text-xs text-muted-foreground">
                        Loading sales ledger…
                      </TableCell>
                    </TableRow>
                  ) : sales.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="h-32 text-center text-xs text-muted-foreground">
                        No sales found matching search.
                      </TableCell>
                    </TableRow>
                  ) : (
                    sales.map((sale) => (
                      <TableRow key={sale.id} className="text-xs hover:bg-muted/30">
                        <TableCell className="font-mono font-semibold text-foreground py-2 px-3">
                          {sale.invoiceNumber}
                        </TableCell>
                        <TableCell className="text-muted-foreground py-2 px-3 whitespace-nowrap">
                          {formatDate(sale.saleDate)}
                        </TableCell>
                        <TableCell className="py-2 px-3 font-medium text-foreground">
                          {sale.customerName}
                        </TableCell>
                        <TableCell className="py-2 px-3 text-muted-foreground">
                          {sale.doctorName}
                        </TableCell>
                        <TableCell className="py-2 px-3 text-right font-mono">
                          {sale.itemsCount}
                        </TableCell>
                        <TableCell className="py-2 px-3 text-right font-mono font-bold text-foreground">
                          {formatCurrency(sale.totalAmount)}
                        </TableCell>
                        <TableCell className="py-2 px-3 font-mono text-[11px] text-muted-foreground">
                          {sale.paymentMethod}
                        </TableCell>
                        <TableCell className="py-2 px-3 text-center">
                          <Badge
                            variant={sale.status === 'COMPLETED' ? 'success' : 'destructive'}
                            className="text-[10px]"
                          >
                            {sale.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-2 px-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs gap-1"
                              onClick={() => {
                                setSelectedSale(sale)
                                setSaleModalOpen(true)
                              }}
                              title="View Invoice Details"
                            >
                              <Eye className="h-3.5 w-3.5 text-primary" />
                              View
                            </Button>
                            <Link href={`/sales/${sale.id}`} target="_blank">
                              <Button variant="ghost" size="icon" className="h-7 w-7" title="Open Full Invoice">
                                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                              </Button>
                            </Link>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── TAB 2: PRESCRIPTIONS REPORT ─────────────────────── */}
        <TabsContent value="prescriptions" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card>
              <CardContent className="p-3">
                <span className="text-[11px] text-muted-foreground uppercase font-semibold">Total Prescriptions</span>
                <p className="text-xl font-bold text-foreground">
                  {totalPrescriptionsCount > 0 ? totalPrescriptionsCount : '—'}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <span className="text-[11px] text-muted-foreground uppercase font-semibold">Pending Validation</span>
                <p className="text-xl font-bold text-amber-600 dark:text-amber-400">
                  {pendingRxCount > 0 ? pendingRxCount : '—'}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <span className="text-[11px] text-muted-foreground uppercase font-semibold">Dispensed Orders</span>
                <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                  {prescriptions.filter((p) => p.status === 'DISPENSED').length > 0
                    ? prescriptions.filter((p) => p.status === 'DISPENSED').length
                    : '—'}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <span className="text-[11px] text-muted-foreground uppercase font-semibold">Consulting Doctors</span>
                <p className="text-xl font-bold text-foreground">
                  {new Set(prescriptions.map((p) => p.doctorName).filter(Boolean)).size || '—'}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <tr className="border-b border-border/70 bg-muted/40 font-semibold text-muted-foreground text-xs">
                    <th className="py-2.5 px-3 text-left">Rx Number</th>
                    <th className="py-2.5 px-3 text-left">Date</th>
                    <th className="py-2.5 px-3 text-left">Patient Details</th>
                    <th className="py-2.5 px-3 text-left">Prescribing Doctor</th>
                    <th className="py-2.5 px-3 text-left">Clinical Notes</th>
                    <th className="py-2.5 px-3 text-left">Linked Bill</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3 text-center w-24">Action</th>
                  </tr>
                </TableHeader>
                <TableBody>
                  {loadingRx ? (
                    <TableRow>
                      <TableCell colSpan={8} className="h-32 text-center text-xs text-muted-foreground">
                        Loading clinical prescriptions…
                      </TableCell>
                    </TableRow>
                  ) : prescriptions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="h-32 text-center text-xs text-muted-foreground">
                        No prescriptions found matching criteria.
                      </TableCell>
                    </TableRow>
                  ) : (
                    prescriptions.map((rx) => (
                      <TableRow key={rx.id} className="text-xs hover:bg-muted/30">
                        <TableCell className="font-mono font-bold text-teal-700 dark:text-teal-400 py-2 px-3">
                          {rx.rxNumber}
                        </TableCell>
                        <TableCell className="text-muted-foreground py-2 px-3 whitespace-nowrap">
                          {formatDate(rx.createdAt)}
                        </TableCell>
                        <TableCell className="py-2 px-3">
                          <div>
                            <p className="font-semibold text-foreground">{rx.patientName}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {rx.patientAge ? `${rx.patientAge}y` : ''} {rx.patientPhone ? `• ${rx.patientPhone}` : ''}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="py-2 px-3">
                          <div>
                            <p className="font-medium text-foreground">{rx.doctorName || 'Unassigned Doctor'}</p>
                            <p className="text-[11px] font-mono text-muted-foreground">
                              Reg: {rx.doctorRegNumber || 'N/A'}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="py-2 px-3 text-muted-foreground truncate max-w-[150px]">
                          {rx.notes || 'Routine consultation'}
                        </TableCell>
                        <TableCell className="py-2 px-3 font-mono text-[11px]">
                          {rx.sale ? (
                            <Link href={`/sales/${rx.sale.id}`} className="text-primary hover:underline font-semibold">
                              {rx.sale.invoiceNumber}
                            </Link>
                          ) : (
                            <span className="text-muted-foreground">Not Billed</span>
                          )}
                        </TableCell>
                        <TableCell className="py-2 px-3 text-center">
                          <Badge
                            variant={
                              rx.status === 'DISPENSED'
                                ? 'success'
                                : rx.status === 'PENDING'
                                  ? 'warning'
                                  : 'secondary'
                            }
                            className="text-[10px]"
                          >
                            {rx.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-2 px-3 text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs gap-1"
                            onClick={() => {
                              setSelectedRx(rx)
                              setRxModalOpen(true)
                            }}
                          >
                            <Eye className="h-3.5 w-3.5 text-primary" />
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── TAB 3: DOCTORS REPORT ───────────────────────────── */}
        <TabsContent value="doctors" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card>
              <CardContent className="p-3">
                <span className="text-[11px] text-muted-foreground uppercase font-semibold">Registered Doctors</span>
                <p className="text-xl font-bold text-foreground">
                  {totalDoctorsCount > 0 ? totalDoctorsCount : '—'}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <span className="text-[11px] text-muted-foreground uppercase font-semibold">Total Revenue Generated</span>
                <p className="text-xl font-bold text-foreground">
                  {totalDocRevenue > 0 ? formatCurrency(totalDocRevenue) : '—'}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <span className="text-[11px] text-muted-foreground uppercase font-semibold">Total Prescriptions</span>
                <p className="text-xl font-bold text-foreground">
                  {doctors.reduce((a, b) => a + b.prescriptionsCount, 0) || '—'}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <span className="text-[11px] text-muted-foreground uppercase font-semibold">Commissions Accrued</span>
                <p className="text-xl font-bold text-foreground">
                  {formatCurrency(doctors.reduce((a, b) => a + b.totalCommission, 0))}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <tr className="border-b border-border/70 bg-muted/40 font-semibold text-muted-foreground text-xs">
                    <th className="py-2.5 px-3 text-left">Doctor Name</th>
                    <th className="py-2.5 px-3 text-left">Council Reg #</th>
                    <th className="py-2.5 px-3 text-left">Specialization</th>
                    <th className="py-2.5 px-3 text-left">Clinic / Hospital</th>
                    <th className="py-2.5 px-3 text-right">Prescriptions</th>
                    <th className="py-2.5 px-3 text-right">Sales Revenue</th>
                    <th className="py-2.5 px-3 text-right">Commission Rate</th>
                    <th className="py-2.5 px-3 text-right">Total Commission</th>
                    <th className="py-2.5 px-3 text-center w-24">Action</th>
                  </tr>
                </TableHeader>
                <TableBody>
                  {loadingDoctors ? (
                    <TableRow>
                      <TableCell colSpan={9} className="h-32 text-center text-xs text-muted-foreground">
                        Loading doctor master &amp; referral performance…
                      </TableCell>
                    </TableRow>
                  ) : doctors.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="h-32 text-center text-xs text-muted-foreground">
                        No doctors recorded.
                      </TableCell>
                    </TableRow>
                  ) : (
                    doctors.map((doc) => (
                      <TableRow key={doc.id} className="text-xs hover:bg-muted/30">
                        <TableCell className="font-semibold text-foreground py-2 px-3">
                          {doc.name}
                        </TableCell>
                        <TableCell className="font-mono text-[11px] text-muted-foreground py-2 px-3">
                          {doc.regNumber}
                        </TableCell>
                        <TableCell className="py-2 px-3 text-muted-foreground">
                          {doc.specialization} ({doc.qualification})
                        </TableCell>
                        <TableCell className="py-2 px-3 text-foreground">
                          {doc.clinicName}
                        </TableCell>
                        <TableCell className="py-2 px-3 text-right font-mono font-medium">
                          {doc.prescriptionsCount}
                        </TableCell>
                        <TableCell className="py-2 px-3 text-right font-mono font-bold text-foreground">
                          {formatCurrency(doc.totalSalesRevenue)}
                        </TableCell>
                        <TableCell className="py-2 px-3 text-right font-mono">
                          {doc.commissionPercent}%
                        </TableCell>
                        <TableCell className="py-2 px-3 text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(doc.totalCommission)}
                        </TableCell>
                        <TableCell className="py-2 px-3 text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs gap-1"
                            onClick={() => {
                              setSelectedDoctor(doc)
                              setDoctorModalOpen(true)
                            }}
                          >
                            <Eye className="h-3.5 w-3.5 text-primary" />
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ─── MODAL 1: SALE VIEW MODAL ───────────────────────── */}
      <Dialog open={saleModalOpen} onOpenChange={setSaleModalOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Invoice {selectedSale?.invoiceNumber}</span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setInvoiceWhatsAppOpen(true)}
                  className="h-7 text-xs text-emerald-600 border-emerald-500/30 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 gap-1 font-medium"
                >
                  <MessageSquare className="h-3 w-3" />
                  Share WhatsApp
                </Button>
                <Badge variant={selectedSale?.status === 'COMPLETED' ? 'success' : 'destructive'}>
                  {selectedSale?.status}
                </Badge>
              </div>
            </DialogTitle>
            <DialogDescription>
              Dispensed on {selectedSale?.saleDate ? formatDate(selectedSale.saleDate) : ''} • Customer: {selectedSale?.customerName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 rounded-lg border border-border/80 bg-muted/20">
              <div>
                <span className="text-muted-foreground">Doctor:</span>{' '}
                <p className="font-semibold text-foreground">{selectedSale?.doctorName}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Payment Method:</span>{' '}
                <p className="font-semibold text-foreground">{selectedSale?.paymentMethod}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Tax Amount:</span>{' '}
                <p className="font-mono font-semibold text-foreground">{selectedSale ? formatCurrency(selectedSale.taxAmount) : '—'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Total Bill:</span>{' '}
                <p className="font-mono font-bold text-sm text-emerald-600 dark:text-emerald-400">
                  {selectedSale ? formatCurrency(selectedSale.totalAmount) : '—'}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold text-foreground">Dispensed Line Items</h4>
              <div className="rounded-lg border border-border/70 overflow-hidden">
                <Table>
                  <TableHeader>
                    <tr className="bg-muted/40 text-[11px]">
                      <th className="py-2 px-3 text-left">Medicine</th>
                      <th className="py-2 px-3 text-left">Batch</th>
                      <th className="py-2 px-3 text-right">Qty</th>
                      <th className="py-2 px-3 text-right">MRP</th>
                      <th className="py-2 px-3 text-right">Disc%</th>
                      <th className="py-2 px-3 text-right">Net</th>
                    </tr>
                  </TableHeader>
                  <TableBody>
                    {selectedSale?.items.map((it) => (
                      <tr key={it.id} className="text-[11px] border-b border-border/40">
                        <td className="py-1.5 px-3 font-medium text-foreground">{it.productName}</td>
                        <td className="py-1.5 px-3 font-mono text-muted-foreground">{it.batchNumber}</td>
                        <td className="py-1.5 px-3 text-right font-mono font-bold">{it.quantity}</td>
                        <td className="py-1.5 px-3 text-right font-mono">{formatCurrency(it.unitPrice)}</td>
                        <td className="py-1.5 px-3 text-right font-mono">{it.discountPercent}%</td>
                        <td className="py-1.5 px-3 text-right font-mono font-bold">{formatCurrency(it.totalAmount)}</td>
                      </tr>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── MODAL 2: PRESCRIPTION VIEW MODAL ───────────────── */}
      <Dialog open={rxModalOpen} onOpenChange={setRxModalOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Prescription {selectedRx?.rxNumber}</span>
              <Badge variant="info">{selectedRx?.status}</Badge>
            </DialogTitle>
            <DialogDescription>
              Registered on {selectedRx?.createdAt ? formatDate(selectedRx.createdAt) : ''}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="grid grid-cols-2 gap-3 p-3 rounded-lg border border-border/80 bg-muted/20">
              <div>
                <span className="text-muted-foreground">Patient Name:</span>
                <p className="font-semibold text-foreground">{selectedRx?.patientName}</p>
                <p className="text-[11px] text-muted-foreground">
                  Age: {selectedRx?.patientAge ? `${selectedRx.patientAge} years` : 'Not specified'} • Phone: {selectedRx?.patientPhone || '—'}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Prescribing Physician:</span>
                <p className="font-semibold text-foreground">{selectedRx?.doctorName ?? 'Unassigned'}</p>
                <p className="text-[11px] text-muted-foreground">
                  {selectedRx?.doctorSpecialization ?? 'General Practitioner'} • Reg: {selectedRx?.doctorRegNumber ?? 'N/A'}
                </p>
              </div>
            </div>

            <div className="p-3 rounded-lg border border-border/70 bg-card">
              <span className="text-muted-foreground font-medium">Clinical Notes &amp; Regimen:</span>
              <p className="font-medium text-foreground mt-1 whitespace-pre-wrap leading-relaxed">
                {selectedRx?.notes || 'Standard dispensary counter prescription. No extra clinical instructions recorded.'}
              </p>
            </div>

            {selectedRx?.sale && (
              <div className="p-3 rounded-lg border border-teal-200 dark:border-teal-800 bg-teal-50/50 dark:bg-teal-950/20 flex items-center justify-between">
                <div>
                  <span className="text-muted-foreground text-[11px]">Associated Counter Sale:</span>
                  <p className="font-mono font-bold text-foreground">{selectedRx.sale.invoiceNumber}</p>
                  <p className="text-[11px] text-muted-foreground font-mono">
                    Total: {formatCurrency(selectedRx.sale.totalAmount)}
                  </p>
                </div>
                <Link href={`/sales/${selectedRx.sale.id}`} target="_blank">
                  <Button size="sm" variant="outline" className="h-8 gap-1 text-xs">
                    <ExternalLink className="h-3.5 w-3.5" />
                    Open Invoice
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── MODAL 3: DOCTOR PROFILE MODAL ──────────────────── */}
      <Dialog open={doctorModalOpen} onOpenChange={setDoctorModalOpen}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Stethoscope className="h-5 w-5 text-teal-600" />
              <span>{selectedDoctor?.name}</span>
            </DialogTitle>
            <DialogDescription>
              {selectedDoctor?.qualification} • {selectedDoctor?.specialization}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1 p-3 rounded-lg border border-border/80 bg-muted/20">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Council Registration:</span>
                <span className="font-mono font-semibold">{selectedDoctor?.regNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Clinic / Hospital:</span>
                <span className="font-medium">{selectedDoctor?.clinicName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Phone Contact:</span>
                <span>{selectedDoctor?.phone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Agreed Commission:</span>
                <span className="font-semibold text-teal-600">{selectedDoctor?.commissionPercent}%</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <Card>
                <CardContent className="p-3 text-center">
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold">Total Prescriptions</span>
                  <p className="text-lg font-bold text-foreground">{selectedDoctor?.prescriptionsCount}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-center">
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold">Dispensed Sales</span>
                  <p className="text-lg font-bold text-foreground">{selectedDoctor?.salesCount}</p>
                </CardContent>
              </Card>
              <Card className="col-span-2">
                <CardContent className="p-3 flex justify-between items-center">
                  <span className="text-[11px] text-muted-foreground uppercase font-semibold">Total Revenue Generated</span>
                  <p className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                    {selectedDoctor ? formatCurrency(selectedDoctor.totalSalesRevenue) : '—'}
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── MODAL 4: INVOICE WHATSAPP MODAL ────────────────── */}
      {selectedSale && (
        <WhatsAppInvoiceDialog
          open={invoiceWhatsAppOpen}
          onOpenChange={setInvoiceWhatsAppOpen}
          sale={selectedSale}
        />
      )}

      {/* ─── MODAL 5: WHATSAPP REPORT DIGEST SHARING ─────────── */}
      <Dialog open={whatsAppReportModalOpen} onOpenChange={setWhatsAppReportModalOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader className="border-b pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600/10 text-emerald-600 dark:text-emerald-400">
                  <MessageSquare className="h-4 w-4" />
                </div>
                <div>
                  <DialogTitle className="text-base font-semibold">
                    Share Executive Digest on WhatsApp
                  </DialogTitle>
                  <DialogDescription className="text-xs">
                    {digestData?.periodLabel || 'Financial summary and operational metrics'}
                  </DialogDescription>
                </div>
              </div>
              <Badge
                variant="outline"
                className="border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs uppercase font-semibold"
              >
                {reportPeriodForWhatsApp}
              </Badge>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Period Switcher Tabs */}
            <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg">
              {(['daily', 'weekly', 'monthly'] as const).map((p) => (
                <Button
                  key={p}
                  type="button"
                  variant={reportPeriodForWhatsApp === p ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => openWhatsAppReportShare(p)}
                  className={`flex-1 h-7 text-xs capitalize font-medium ${reportPeriodForWhatsApp === p ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}`}
                >
                  {p} Summary
                </Button>
              ))}
            </div>

            {/* Recipient Phone Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 text-emerald-600" />
                Recipient Mobile Number:
              </label>
              <div className="flex gap-2">
                <Input
                  type="tel"
                  placeholder="e.g. 9876543210 or +919876543210"
                  value={whatsAppPhone}
                  onChange={(e) => setWhatsAppPhone(e.target.value)}
                  className="h-9 text-xs font-mono"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCopyReportText}
                  disabled={!digestData?.formattedWhatsAppText}
                  className="h-9 gap-1 text-xs whitespace-nowrap"
                >
                  {copiedReportText ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  {copiedReportText ? 'Copied' : 'Copy'}
                </Button>
              </div>
            </div>

            {/* Formatted Message Bubble Preview */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                WhatsApp Message Preview:
              </label>
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/5 dark:bg-emerald-950/20 p-3.5 font-mono text-xs leading-relaxed text-foreground whitespace-pre-wrap max-h-64 overflow-y-auto">
                {loadingDigest ? (
                  <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
                    Generating {reportPeriodForWhatsApp} executive digest...
                  </div>
                ) : (
                  digestData?.formattedWhatsAppText || 'No report data available for this period.'
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="flex flex-col sm:flex-row items-center justify-between gap-2 border-t pt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setWhatsAppReportModalOpen(false)}
              className="w-full sm:w-auto text-xs"
            >
              Close
            </Button>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleSendReportViaApi}
                disabled={sendingWhatsApp || !whatsAppPhone.trim() || loadingDigest}
                className="gap-1.5 text-xs flex-1 sm:flex-initial"
              >
                {sendingWhatsApp ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5 text-teal-600" />
                )}
                Send via API
              </Button>

              <Button
                type="button"
                size="sm"
                onClick={() => {
                  if (reportWaMeLink) {
                    window.open(reportWaMeLink, '_blank', 'noopener,noreferrer')
                  }
                }}
                disabled={!reportWaMeLink || loadingDigest}
                className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium flex-1 sm:flex-initial"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                1-Click WhatsApp
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
