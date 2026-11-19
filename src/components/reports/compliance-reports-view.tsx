'use client'

import {
  AlertTriangle,
  Calendar,
  FileCheck,
  FileSpreadsheet,
  FileText,
  Printer,
  ShieldAlert,
  Stethoscope,
  TrendingUp,
} from 'lucide-react'
import React, { useEffect, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/lib/hooks/use-toast'
import { downloadExcelWorkbook } from '@/lib/reports/excel-export-service'


interface ScheduleHRow {
  id: string
  invoiceNumber: string
  date: string | Date
  patientName: string
  patientPhone: string | null
  patientAddress: string | null
  doctorName: string
  doctorRegNumber: string | null
  productName: string
  composition: string | null
  schedule: string
  batchNumber: string
  expiryDate: string | Date | null
  quantity: number
  rate: number
  totalAmount: number
}

interface GrossProfitData {
  summary: {
    totalRevenue: number
    totalCogs: number
    grossProfit: number
    profitMarginPercent: number
    totalItemsSold: number
  }
  items: Array<{
    id: string
    productName: string
    sku: string
    category: string
    quantity: number
    saleRevenue: number
    purchaseCost: number
    grossProfit: number
    profitMargin: number
  }>
}

interface ComplianceReportsViewProps {
  branchId?: string
  branchName?: string
}

export function ComplianceReportsView({ branchId = '', branchName: _branchName }: ComplianceReportsViewProps) {
  const toast = useToast()
  const [activeTab, setActiveTab] = useState('schedule-h')
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'custom'>('monthly')

  // Schedule H/H1 states
  const [scheduleData, setScheduleData] = useState<ScheduleHRow[]>([])
  const [scheduleFilter, setScheduleFilter] = useState<'ALL' | 'H' | 'H1'>('ALL')
  const [loadingSchedule, setLoadingSchedule] = useState(false)

  // Gross Profit states
  const [grossProfitData, setGrossProfitData] = useState<GrossProfitData | null>(null)
  const [loadingProfit, setLoadingProfit] = useState(false)

  // Near Expiry states
  const [nearExpiryData, setNearExpiryData] = useState<any[]>([])
  const [expiryWindow, setExpiryWindow] = useState('90')
  const [loadingExpiry, setLoadingExpiry] = useState(false)

  // Doctor Commissions states
  const [commissionsData, setCommissionsData] = useState<any[]>([])
  const [commSummary, setCommSummary] = useState<{ totalSalesVolume: number; totalCommissionEarned: number }>({
    totalSalesVolume: 0,
    totalCommissionEarned: 0,
  })
  const [loadingComm, setLoadingComm] = useState(false)

  // Fetch Schedule H data
  const loadScheduleH = async () => {
    setLoadingSchedule(true)
    try {
      const res = await fetch(
        `/api/reports/schedule-h?branchId=${branchId}&scheduleType=${scheduleFilter}&period=${period}&limit=100`
      )
      const json = await res.json()
      if (json.success) {
        setScheduleData(json.data)
      }
    } catch {
      toast.error('Failed to load Schedule H register')
    } finally {
      setLoadingSchedule(false)
    }
  }

  // Fetch Gross Profit data
  const loadGrossProfit = async () => {
    setLoadingProfit(true)
    try {
      const res = await fetch(`/api/reports/gross-profit?branchId=${branchId}&period=${period}`)
      const json = await res.json()
      if (json.success) {
        setGrossProfitData(json.data)
      }
    } catch {
      toast.error('Failed to load Gross Profit report')
    } finally {
      setLoadingProfit(false)
    }
  }

  // Fetch Near Expiry data
  const loadNearExpiry = async () => {
    setLoadingExpiry(true)
    try {
      const res = await fetch(`/api/reports/expiry?branchId=${branchId}&daysThreshold=${expiryWindow}`)
      const json = await res.json()
      if (json.success) {
        setNearExpiryData(json.data)
      }
    } catch {
      toast.error('Failed to load Near Expiry summary')
    } finally {
      setLoadingExpiry(false)
    }
  }

  // Fetch Doctor Commissions data
  const loadDoctorCommissions = async () => {
    setLoadingComm(true)
    try {
      const res = await fetch(`/api/doctors/commissions?branchId=${branchId}&limit=100`)
      const json = await res.json()
      if (json.success) {
        setCommissionsData(json.items)
        setCommSummary(json.summary)
      }
    } catch {
      toast.error('Failed to load Doctor Commissions')
    } finally {
      setLoadingComm(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'schedule-h') void loadScheduleH()
    else if (activeTab === 'gross-profit') void loadGrossProfit()
    else if (activeTab === 'near-expiry') void loadNearExpiry()
    else if (activeTab === 'commissions') void loadDoctorCommissions()
  }, [activeTab, scheduleFilter, expiryWindow, period, branchId])

  // Mark commission settled
  const handleSettleCommission = async (id: string) => {
    try {
      const res = await fetch('/api/doctors/commissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commissionId: id }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success('Commission settled successfully')
        void loadDoctorCommissions()
      }
    } catch {
      toast.error('Failed to settle commission')
    }
  }


  // Single-Click Excel (.xlsx) Exports
  const exportScheduleHExcel = () => {
    if (scheduleData.length === 0) {
      toast.error('No Schedule H / H1 records available to export')
      return
    }
    const totalQty = scheduleData.reduce((acc, r) => acc + (r.quantity || 0), 0)
    const totalRev = scheduleData.reduce((acc, r) => acc + (r.totalAmount || 0), 0)
    const data = scheduleData.map((row) => [
      row.date ? new Date(row.date).toLocaleDateString() : '',
      row.invoiceNumber,
      row.patientName,
      row.patientPhone || '—',
      row.doctorName,
      row.doctorRegNumber || '—',
      row.productName,
      row.composition || '—',
      `Schedule ${row.schedule}`,
      row.batchNumber,
      row.expiryDate ? new Date(row.expiryDate).toLocaleDateString() : '—',
      row.quantity,
      row.totalAmount,
    ])
    downloadExcelWorkbook({
      filename: `Schedule-H-Register-${period}-${new Date().toISOString().split('T')[0]}.xlsx`,
      organizationName: 'Metapharsic Pharmacy',
      sheets: [
        {
          sheetName: 'Schedule H Register',
          title: 'Drug Inspector Statutory Register (Schedule H & H1 Drugs)',
          subtitle: `Filter: ${scheduleFilter} | Period: ${period.toUpperCase()}`,
          headers: [
            'Date',
            'Invoice #',
            'Patient Name',
            'Patient Phone',
            'Doctor Name',
            'Doctor Reg #',
            'Medicine Name',
            'Composition',
            'Schedule',
            'Batch #',
            'Expiry Date',
            'Quantity',
            'Total (₹)',
          ],
          data,
          summaryRow: ['Total Dispensed', '', '', '', '', '', '', '', '', '', '', totalQty, totalRev],
        },
      ],
    })
    toast.success('Exported Schedule-H-Register.xlsx')
  }

  const exportNearExpiryExcel = () => {
    if (nearExpiryData.length === 0) {
      toast.error('No near-expiry records available to export')
      return
    }
    const totalUnits = nearExpiryData.reduce((acc, b) => acc + (b.availableQuantity || 0), 0)
    const totalVal = nearExpiryData.reduce((acc, b) => acc + (Number(b.stockValue) || 0), 0)
    const data = nearExpiryData.map((b) => [
      b.productName,
      b.productSku || '—',
      b.batchNumber,
      b.expiryDate ? new Date(b.expiryDate).toLocaleDateString() : '—',
      b.availableQuantity,
      Number(b.stockValue || 0),
    ])
    downloadExcelWorkbook({
      filename: `Near-Expiry-Stock-${expiryWindow}d-${new Date().toISOString().split('T')[0]}.xlsx`,
      organizationName: 'Metapharsic Pharmacy',
      sheets: [
        {
          sheetName: 'Near-Expiry Batches',
          title: `Near-Expiry & Expired Stock Register (Window: ${expiryWindow} Days)`,
          headers: ['Medicine Name', 'SKU / Code', 'Batch Number', 'Expiry Date', 'Available Qty', 'Stock Value (₹)'],
          data,
          summaryRow: ['Total Units / Value', '', '', '', totalUnits, totalVal],
        },
      ],
    })
    toast.success('Exported Near-Expiry-Stock.xlsx')
  }

  const exportGrossProfitExcel = () => {
    if (!grossProfitData || grossProfitData.items.length === 0) {
      toast.error('No gross profit records available to export')
      return
    }
    const data = grossProfitData.items.map((it) => [
      it.productName,
      it.category || 'General',
      it.quantity,
      it.saleRevenue,
      it.purchaseCost,
      it.grossProfit,
      `${it.profitMargin}%`,
    ])
    downloadExcelWorkbook({
      filename: `Gross-Profit-Report-${period}-${new Date().toISOString().split('T')[0]}.xlsx`,
      organizationName: 'Metapharsic Pharmacy',
      sheets: [
        {
          sheetName: 'Gross Profit Analytics',
          title: 'Medicine-Wise Profit & Margin Breakdown',
          subtitle: `Period: ${period.toUpperCase()}`,
          metadata: {
            'Total Revenue': `₹${grossProfitData.summary.totalRevenue.toLocaleString('en-IN')}`,
            'Cost of Goods Sold (COGS)': `₹${grossProfitData.summary.totalCogs.toLocaleString('en-IN')}`,
            'Gross Profit': `₹${grossProfitData.summary.grossProfit.toLocaleString('en-IN')}`,
            'Margin': `${grossProfitData.summary.profitMarginPercent}%`,
          },
          headers: [
            'Medicine Name',
            'Category',
            'Units Sold',
            'Revenue (₹)',
            'Batch Cost (₹)',
            'Gross Profit (₹)',
            'Margin',
          ],
          data,
          summaryRow: [
            'Total / Summary',
            '',
            grossProfitData.items.reduce((acc, it) => acc + (it.quantity || 0), 0),
            grossProfitData.summary.totalRevenue,
            grossProfitData.summary.totalCogs,
            grossProfitData.summary.grossProfit,
            `${grossProfitData.summary.profitMarginPercent}%`,
          ],
        },
      ],
    })
    toast.success('Exported Gross-Profit-Report.xlsx')
  }

  const exportDoctorCommissionsExcel = () => {
    if (commissionsData.length === 0) {
      toast.error('No doctor commission records available to export')
      return
    }
    const totalSales = commissionsData.reduce((acc, c) => acc + (Number(c.saleAmount) || 0), 0)
    const totalComm = commissionsData.reduce((acc, c) => acc + (Number(c.commissionAmount) || 0), 0)
    const data = commissionsData.map((c) => [
      c.doctorName,
      c.clinicName || '—',
      c.invoiceNumber,
      c.saleDate ? new Date(c.saleDate).toLocaleDateString() : '—',
      c.customerName,
      c.saleAmount,
      `${c.commissionPercent}%`,
      c.commissionAmount,
      c.isPaid ? 'Settled' : 'Payable',
    ])
    downloadExcelWorkbook({
      filename: `Doctor-Commissions-${new Date().toISOString().split('T')[0]}.xlsx`,
      organizationName: 'Metapharsic Pharmacy',
      sheets: [
        {
          sheetName: 'Doctor Commissions',
          title: 'Doctor Referral & Commission Ledger',
          headers: [
            'Doctor Name',
            'Clinic / Hospital',
            'Bill / Invoice #',
            'Date',
            'Patient',
            'Bill Amount (₹)',
            'Comm. Rate',
            'Commission (₹)',
            'Status',
          ],
          data,
          summaryRow: ['Total / Summary', '', '', '', '', totalSales, '', totalComm, ''],
        },
      ],
    })
    toast.success('Exported Doctor-Commissions.xlsx')
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-muted/40 p-5 rounded-xl border">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-md">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">
              Regulatory & Operational Pharmacy Registers
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Drug Inspector statutory registers, Schedule H/H1 records, Expiry windows, and Gross Profit analytics.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={(val: any) => setPeriod(val)}>
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
            onClick={() => window.print()}
            className="h-9 text-xs gap-1.5"
          >
            <Printer className="h-3.5 w-3.5" />
            Print Register
          </Button>
        </div>
      </div>


      {/* Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-muted p-1 h-auto flex flex-wrap gap-1">
          <TabsTrigger value="schedule-h" className="text-xs gap-1.5 py-1.5">
            <FileText className="h-3.5 w-3.5" />
            Schedule H / H1 Register
          </TabsTrigger>
          <TabsTrigger value="near-expiry" className="text-xs gap-1.5 py-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
            Near-Expiry & Expired Stock
          </TabsTrigger>
          <TabsTrigger value="gross-profit" className="text-xs gap-1.5 py-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
            Gross Profit Analytics
          </TabsTrigger>
          <TabsTrigger value="commissions" className="text-xs gap-1.5 py-1.5">
            <Stethoscope className="h-3.5 w-3.5 text-blue-500" />
            Doctor Commissions
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Schedule H & H1 Register */}
        <TabsContent value="schedule-h" className="space-y-4">
          <Card>
            <CardHeader className="pb-3 border-b">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <FileCheck className="h-4 w-4 text-emerald-600" />
                    Drug Inspector Statutory Register (Schedule H & H1 Drugs)
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Mandatory audit register logging patient name, doctor reg. no, batch, and dispensing details.
                  </CardDescription>
                </div>

                <div className="flex items-center gap-2">
                  <Select
                    value={scheduleFilter}
                    onValueChange={(val: 'ALL' | 'H' | 'H1') => setScheduleFilter(val)}
                  >
                    <SelectTrigger className="h-8 text-xs w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All (H & H1)</SelectItem>
                      <SelectItem value="H">Schedule H Only</SelectItem>
                      <SelectItem value="H1">Schedule H1 Only</SelectItem>
                    </SelectContent>
                  </Select>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => exportScheduleHExcel()}
                    className="h-8 text-xs gap-1 font-medium bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300 border-emerald-300 hover:bg-emerald-100"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" /> Export Excel
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/70 font-semibold text-muted-foreground border-y">
                    <tr>
                      <th className="py-2.5 px-3 text-left">Date & Inv #</th>
                      <th className="py-2.5 px-3 text-left">Patient Details</th>
                      <th className="py-2.5 px-3 text-left">Prescribing Doctor</th>
                      <th className="py-2.5 px-3 text-left">Drug & Composition</th>
                      <th className="py-2.5 px-3 text-center">Schedule</th>
                      <th className="py-2.5 px-3 text-left">Batch #</th>
                      <th className="py-2.5 px-3 text-left">Expiry</th>
                      <th className="py-2.5 px-3 text-right">Qty</th>
                      <th className="py-2.5 px-3 text-right">Total (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {scheduleData.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-muted-foreground text-xs">
                          {loadingSchedule ? 'Generating statutory register...' : 'No Schedule H / H1 drugs dispensed in this period.'}
                        </td>
                      </tr>
                    ) : (
                      scheduleData.map((row) => (
                        <tr key={row.id} className="hover:bg-muted/30">
                          <td className="py-2 px-3 font-mono">
                            <div className="font-bold text-primary">{row.invoiceNumber}</div>
                            <div className="text-[10px] text-muted-foreground">{new Date(row.date).toLocaleDateString()}</div>
                          </td>
                          <td className="py-2 px-3">
                            <div className="font-semibold">{row.patientName}</div>
                            {row.patientPhone && (
                              <div className="text-[10px] text-muted-foreground font-mono">{row.patientPhone}</div>
                            )}
                          </td>
                          <td className="py-2 px-3">
                            <div className="font-medium">{row.doctorName}</div>
                            {row.doctorRegNumber && (
                              <div className="text-[10px] text-muted-foreground font-mono">Reg: {row.doctorRegNumber}</div>
                            )}
                          </td>
                          <td className="py-2 px-3">
                            <div className="font-semibold">{row.productName}</div>
                            {row.composition && (
                              <div className="text-[10px] text-muted-foreground truncate max-w-[140px]">{row.composition}</div>
                            )}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <Badge
                              className={`text-[10px] py-0 px-1 font-mono ${
                                row.schedule === 'H1'
                                  ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-400'
                                  : 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-400'
                              }`}
                            >
                              Sched {row.schedule}
                            </Badge>
                          </td>
                          <td className="py-2 px-3 font-mono">{row.batchNumber}</td>
                          <td className="py-2 px-3 font-mono text-[11px]">
                            {row.expiryDate ? new Date(row.expiryDate).toLocaleDateString() : '-'}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold">{row.quantity}</td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-emerald-600">
                            ₹{row.totalAmount.toFixed(2)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Near-Expiry & Expired Stock */}
        <TabsContent value="near-expiry" className="space-y-4">
          <Card>
            <CardHeader className="pb-3 border-b">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    Near-Expiry & Expired Batch Summary
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Batches expiring in 30, 60, or 90 days for supplier return or clearance.
                  </CardDescription>
                </div>

                <div className="flex items-center gap-2">
                  <Select value={expiryWindow} onValueChange={setExpiryWindow}>
                    <SelectTrigger className="h-8 text-xs w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">Expiring in 30 Days</SelectItem>
                      <SelectItem value="60">Expiring in 60 Days</SelectItem>
                      <SelectItem value="90">Expiring in 90 Days</SelectItem>
                      <SelectItem value="180">Expiring in 180 Days</SelectItem>
                    </SelectContent>
                  </Select>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => exportNearExpiryExcel()}
                    className="h-8 text-xs gap-1 font-medium bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300 border-emerald-300 hover:bg-emerald-100"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" /> Export Excel
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/70 font-semibold text-muted-foreground border-y">
                    <tr>
                      <th className="py-2.5 px-3 text-left">Medicine Name</th>
                      <th className="py-2.5 px-3 text-left">SKU / Code</th>
                      <th className="py-2.5 px-3 text-left">Batch Number</th>
                      <th className="py-2.5 px-3 text-left">Expiry Date</th>
                      <th className="py-2.5 px-3 text-right">Available Qty</th>
                      <th className="py-2.5 px-3 text-right">Stock Value (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {nearExpiryData.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-muted-foreground text-xs">
                          {loadingExpiry ? 'Scanning batch expiries...' : 'No batches found in this expiry window.'}
                        </td>
                      </tr>
                    ) : (
                      nearExpiryData.map((b) => (
                        <tr key={b.id} className="hover:bg-muted/30">
                          <td className="py-2 px-3 font-semibold">{b.productName}</td>
                          <td className="py-2 px-3 font-mono text-muted-foreground">{b.productSku}</td>
                          <td className="py-2 px-3 font-mono font-medium">{b.batchNumber}</td>
                          <td className="py-2 px-3 font-mono text-rose-600 font-bold">
                            {new Date(b.expiryDate).toLocaleDateString()}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold">{b.availableQuantity}</td>
                          <td className="py-2 px-3 text-right font-mono font-semibold text-emerald-600">
                            ₹{Number(b.stockValue || 0).toFixed(2)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Gross Profit Analytics */}
        <TabsContent value="gross-profit" className="space-y-4">
          {grossProfitData && (
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <Card className="p-4 bg-muted/40">
                <div className="text-xs text-muted-foreground">Total Revenue</div>
                <div className="text-lg font-bold font-mono text-foreground mt-1">
                  ₹{grossProfitData.summary.totalRevenue.toLocaleString('en-IN')}
                </div>
              </Card>

              <Card className="p-4 bg-muted/40">
                <div className="text-xs text-muted-foreground">Cost of Goods Sold (COGS)</div>
                <div className="text-lg font-bold font-mono text-muted-foreground mt-1">
                  ₹{grossProfitData.summary.totalCogs.toLocaleString('en-IN')}
                </div>
              </Card>

              <Card className="p-4 bg-emerald-500/10 border-emerald-500/20">
                <div className="text-xs text-emerald-800 dark:text-emerald-300 font-semibold">Total Gross Profit</div>
                <div className="text-lg font-bold font-mono text-emerald-600 mt-1">
                  ₹{grossProfitData.summary.grossProfit.toLocaleString('en-IN')}
                </div>
              </Card>

              <Card className="p-4 bg-emerald-500/10 border-emerald-500/20">
                <div className="text-xs text-emerald-800 dark:text-emerald-300 font-semibold">Gross Profit Margin</div>
                <div className="text-lg font-bold font-mono text-emerald-600 mt-1">
                  {grossProfitData.summary.profitMarginPercent}%
                </div>
              </Card>
            </div>
          )}

          <Card>
            <CardHeader className="pb-3 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-emerald-600" />
                    Medicine-Wise Profit & Margin Breakdown
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Compares retail sales revenue against actual batch purchase cost.
                  </CardDescription>
                </div>
                {grossProfitData && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => exportGrossProfitExcel()}
                    className="h-8 text-xs gap-1 font-medium bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300 border-emerald-300 hover:bg-emerald-100"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" /> Export Excel
                  </Button>
                )}
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/70 font-semibold text-muted-foreground border-y">
                    <tr>
                      <th className="py-2 px-3 text-left">Medicine Name</th>
                      <th className="py-2 px-3 text-left">Category</th>
                      <th className="py-2 px-3 text-right">Units Sold</th>
                      <th className="py-2 px-3 text-right">Revenue (₹)</th>
                      <th className="py-2 px-3 text-right">Batch Cost (₹)</th>
                      <th className="py-2 px-3 text-right">Gross Profit (₹)</th>
                      <th className="py-2 px-3 text-right">Margin (%)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {!grossProfitData || grossProfitData.items.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-muted-foreground text-xs">
                          {loadingProfit ? 'Calculating profit margins...' : 'No sales records found.'}
                        </td>
                      </tr>
                    ) : (
                      grossProfitData.items.map((it) => (
                        <tr key={it.id} className="hover:bg-muted/30">
                          <td className="py-2 px-3 font-semibold">{it.productName}</td>
                          <td className="py-2 px-3 text-muted-foreground">{it.category}</td>
                          <td className="py-2 px-3 text-right font-mono">{it.quantity}</td>
                          <td className="py-2 px-3 text-right font-mono font-medium">₹{it.saleRevenue.toFixed(2)}</td>
                          <td className="py-2 px-3 text-right font-mono text-muted-foreground">₹{it.purchaseCost.toFixed(2)}</td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-emerald-600">
                            ₹{it.grossProfit.toFixed(2)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold">
                            <Badge
                              className={`text-[10px] py-0 ${
                                it.profitMargin >= 25
                                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                                  : 'bg-muted text-muted-foreground'
                              }`}
                            >
                              {it.profitMargin}%
                            </Badge>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 4: Doctor Commissions */}
        <TabsContent value="commissions" className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card className="p-4 bg-muted/40">
              <div className="text-xs text-muted-foreground">Total Referred Sales Volume</div>
              <div className="text-lg font-bold font-mono mt-1">
                ₹{commSummary.totalSalesVolume.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </Card>

            <Card className="p-4 bg-blue-500/10 border-blue-500/20">
              <div className="text-xs text-blue-800 dark:text-blue-300 font-semibold">Total Commissions Earned</div>
              <div className="text-lg font-bold font-mono text-blue-600 mt-1">
                ₹{commSummary.totalCommissionEarned.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-3 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Stethoscope className="h-4 w-4 text-blue-600" />
                    Doctor Referral & Commission Ledger
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Track prescriptions, sales volume, and commission payout settlements per doctor.
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => exportDoctorCommissionsExcel()}
                  className="h-8 text-xs gap-1 font-medium bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300 border-emerald-300 hover:bg-emerald-100"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" /> Export Excel
                </Button>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/70 font-semibold text-muted-foreground border-y">
                    <tr>
                      <th className="py-2 px-3 text-left">Doctor Name</th>
                      <th className="py-2 px-3 text-left">Clinic / Hospital</th>
                      <th className="py-2 px-3 text-left">Bill / Invoice #</th>
                      <th className="py-2 px-3 text-left">Date</th>
                      <th className="py-2 px-3 text-left">Patient</th>
                      <th className="py-2 px-3 text-right">Bill Amount (₹)</th>
                      <th className="py-2 px-3 text-right">Comm. Rate</th>
                      <th className="py-2 px-3 text-right">Commission (₹)</th>
                      <th className="py-2 px-3 text-center">Status</th>
                      <th className="py-2 px-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {commissionsData.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="py-8 text-center text-muted-foreground text-xs">
                          {loadingComm ? 'Loading commission records...' : 'No doctor commissions recorded yet.'}
                        </td>
                      </tr>
                    ) : (
                      commissionsData.map((c) => (
                        <tr key={c.id} className="hover:bg-muted/30">
                          <td className="py-2 px-3 font-semibold text-primary">{c.doctorName}</td>
                          <td className="py-2 px-3 text-muted-foreground">{c.clinicName || '-'}</td>
                          <td className="py-2 px-3 font-mono font-medium">{c.invoiceNumber}</td>
                          <td className="py-2 px-3 text-muted-foreground">{new Date(c.saleDate).toLocaleDateString()}</td>
                          <td className="py-2 px-3">{c.customerName}</td>
                          <td className="py-2 px-3 text-right font-mono font-medium">₹{c.saleAmount.toFixed(2)}</td>
                          <td className="py-2 px-3 text-right font-mono text-blue-600">{c.commissionPercent}%</td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-emerald-600">
                            ₹{c.commissionAmount.toFixed(2)}
                          </td>
                          <td className="py-2 px-3 text-center">
                            {c.isPaid ? (
                              <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-400 text-[10px] py-0">
                                Settled
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="border-amber-400 text-amber-600 text-[10px] py-0">
                                Payable
                              </Badge>
                            )}
                          </td>
                          <td className="py-2 px-3 text-center">
                            {!c.isPaid && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 text-[11px] text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                                onClick={() => handleSettleCommission(c.id)}
                              >
                                Settle
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
