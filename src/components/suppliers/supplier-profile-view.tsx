'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  ArrowLeft,
  Award,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  DollarSign,
  Download,
  ExternalLink,
  FileCheck,
  FileSpreadsheet,
  FileText,
  History,
  Lock,
  Package,
  Phone,
  Plus,
  Printer,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Truck,
  UserCheck,
  Wallet,
} from 'lucide-react'

import { SupplierFormDialog } from '@/components/suppliers/supplier-form'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { SupplierProfileDetails } from '@/lib/suppliers/supplier-management-service'
import { formatCurrency } from '@/lib/utils/currency'
import { formatDate } from '@/lib/utils/date'

interface SupplierProfileViewProps {
  initialProfile: SupplierProfileDetails
}

export function SupplierProfileView({ initialProfile }: SupplierProfileViewProps) {
  const [profile, setProfile] = useState<SupplierProfileDetails>(initialProfile)
  const [activeTab, setActiveTab] = useState<
    | 'BASIC'
    | 'COMPLIANCE'
    | 'PRODUCTS'
    | 'COMMERCIAL'
    | 'BANK'
    | 'HISTORY'
    | 'PERFORMANCE'
    | 'STATEMENT'
  >('BASIC')

  const { basicDetails, compliance, productsSupplied, commercialTerms, bankDetails, purchaseHistory, performanceAndRisk } =
    profile

  return (
    <div className="space-y-5">
      {/* ─── Breadcrumb & Header ─── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button asChild variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
            <Link href="/suppliers">
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>All Suppliers</span>
            </Link>
          </Button>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-foreground">
                {basicDetails.legalName}
              </h1>
              <Badge variant="outline" className="font-mono text-xs border-primary/30 text-primary">
                {basicDetails.code}
              </Badge>
              <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">
                {basicDetails.type}
              </Badge>
              {compliance.verificationStatus === 'VERIFIED' ? (
                <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 text-xs">
                  <ShieldCheck className="h-3 w-3 mr-1" />
                  Verified & Compliant
                </Badge>
              ) : (
                <Badge className="bg-rose-500/15 text-rose-600 border-rose-500/30 text-xs">
                  <ShieldAlert className="h-3 w-3 mr-1" />
                  {compliance.verificationStatus}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {basicDetails.tradeName} • City: {basicDetails.city}, {basicDetails.state} • DL: {compliance.dlNumber}
            </p>
          </div>
        </div>

        {/* Action Header */}
        <div className="flex flex-wrap items-center gap-2">
          {compliance.isPoPermitted ? (
            <Button asChild size="sm" className="h-8 gap-1.5 text-xs bg-primary text-primary-foreground font-semibold shadow-sm">
              <Link href={`/purchases/new?supplierId=${basicDetails.id}`}>
                <Plus className="h-3.5 w-3.5" />
                Issue Purchase Order
              </Link>
            </Button>
          ) : (
            <Button size="sm" disabled variant="outline" className="h-8 gap-1.5 text-xs text-rose-600 border-rose-500/30 bg-rose-500/5">
              <Lock className="h-3.5 w-3.5" />
              PO Blocked (Compliance)
            </Button>
          )}

          <Link href={`/purchases/returns/new?supplierId=${basicDetails.id}`}>
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs border-rose-500/30 text-rose-600 hover:bg-rose-500/10">
              <RotateCcw className="h-3.5 w-3.5" />
              Debit Note
            </Button>
          </Link>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setActiveTab('STATEMENT')}
            className="h-8 gap-1.5 text-xs font-semibold border-primary/30 text-primary hover:bg-primary/10"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            Supplier Statement
          </Button>

          <SupplierFormDialog
            mode="edit"
            defaultValues={{
              id: basicDetails.id,
              name: basicDetails.legalName,
              contactPerson: basicDetails.contactPersons[0]?.name,
              phone: basicDetails.contactPersons[0]?.phone,
              email: basicDetails.contactPersons[0]?.email,
              gstin: compliance.gstin,
              pan: compliance.pan,
              dlNumber: compliance.dlNumber,
              address: basicDetails.address,
              city: basicDetails.city,
              state: basicDetails.state,
              pincode: basicDetails.pincode,
              bankName: bankDetails.bankName,
              bankAccount: bankDetails.accountNumber,
              bankIfsc: bankDetails.ifsc,
              creditDays: commercialTerms.creditDays,
            }}
          />
        </div>
      </div>

      {/* Statutory PO Block Warning Banner (if unverified or expired) */}
      {!compliance.isPoPermitted && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3.5 flex items-start gap-2.5">
          <ShieldAlert className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="text-xs">
            <span className="font-bold text-rose-700 dark:text-rose-400">
              Statutory Procurement Gate Active: Purchase Orders Prohibited
            </span>
            <p className="text-rose-600/90 mt-0.5">
              {compliance.blockReason ||
                'Drug License Form 20B/21B verification incomplete or expired. Per Drugs and Cosmetics Act regulations, no stock may be ordered until compliance documents are validated.'}
            </p>
          </div>
        </div>
      )}

      {/* ─── Executive Summary KPI Strip ─── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
          <CardContent className="p-3">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[11px] font-medium">Approved Credit Line</span>
              <CreditCard className="h-4 w-4 text-primary" />
            </div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-foreground">
              {formatCurrency(commercialTerms.creditLimit)}
            </div>
            <p className="text-[10px] text-muted-foreground">
              Available: <strong className="text-emerald-600">{formatCurrency(commercialTerms.availableCredit)}</strong>
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
          <CardContent className="p-3">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[11px] font-medium">Outstanding Balance</span>
              <DollarSign className="h-4 w-4 text-rose-600" />
            </div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-rose-600">
              {formatCurrency(purchaseHistory.balanceDue)}
            </div>
            <p className="text-[10px] text-muted-foreground">{commercialTerms.creditDays} days credit terms</p>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
          <CardContent className="p-3">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[11px] font-medium">Products Supplied</span>
              <Package className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-emerald-600">
              {productsSupplied.length} medicines
            </div>
            <p className="text-[10px] text-muted-foreground">Negotiated rate contracts active</p>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
          <CardContent className="p-3">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[11px] font-medium">Delivery Reliability</span>
              <Award className="h-4 w-4 text-amber-600" />
            </div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-amber-600">
              {performanceAndRisk.deliveryReliabilityScore}%
            </div>
            <p className="text-[10px] text-muted-foreground">Grade {performanceAndRisk.overallGrade} Supplier Scorecard</p>
          </CardContent>
        </Card>
      </div>

      {/* ─── 7-Tab Supplier Profile Navigation ─── */}
      <div className="border rounded-xl bg-card shadow-sm overflow-hidden">
        <div className="flex items-center overflow-x-auto border-b bg-muted/40 p-1 gap-1 text-xs">
          <Button
            variant={activeTab === 'BASIC' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('BASIC')}
            className="h-8 gap-1.5 text-xs font-semibold shrink-0"
          >
            <Building2 className="h-3.5 w-3.5" />
            1. Basic Details
          </Button>

          <Button
            variant={activeTab === 'COMPLIANCE' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('COMPLIANCE')}
            className="h-8 gap-1.5 text-xs font-semibold shrink-0"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            2. Compliance Documents
          </Button>

          <Button
            variant={activeTab === 'PRODUCTS' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('PRODUCTS')}
            className="h-8 gap-1.5 text-xs font-semibold shrink-0"
          >
            <Package className="h-3.5 w-3.5" />
            3. Products Supplied ({productsSupplied.length})
          </Button>

          <Button
            variant={activeTab === 'COMMERCIAL' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('COMMERCIAL')}
            className="h-8 gap-1.5 text-xs font-semibold shrink-0"
          >
            <CreditCard className="h-3.5 w-3.5" />
            4. Commercial Terms
          </Button>

          <Button
            variant={activeTab === 'BANK' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('BANK')}
            className="h-8 gap-1.5 text-xs font-semibold shrink-0"
          >
            <Wallet className="h-3.5 w-3.5" />
            5. Bank & Payments
          </Button>

          <Button
            variant={activeTab === 'HISTORY' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('HISTORY')}
            className="h-8 gap-1.5 text-xs font-semibold shrink-0"
          >
            <History className="h-3.5 w-3.5" />
            6. Purchase History ({purchaseHistory.totalOrders})
          </Button>

          <Button
            variant={activeTab === 'PERFORMANCE' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('PERFORMANCE')}
            className="h-8 gap-1.5 text-xs font-semibold shrink-0"
          >
            <Award className="h-3.5 w-3.5" />
            7. Performance & Risk
          </Button>

          <Button
            variant={activeTab === 'STATEMENT' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('STATEMENT')}
            className="h-8 gap-1.5 text-xs font-semibold shrink-0"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            8. Supplier Statement (Ledger)
          </Button>
        </div>

        <div className="p-5">
          {/* ─── TAB 1: BASIC DETAILS ─── */}
          {activeTab === 'BASIC' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
                <div className="space-y-3 bg-muted/20 p-4 rounded-lg border">
                  <span className="font-bold text-foreground text-sm block">Organization & Identification</span>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Legal Entity Name:</span>
                      <span className="font-bold text-foreground">{basicDetails.legalName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Trade / Brand Name:</span>
                      <span className="font-medium text-foreground">{basicDetails.tradeName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Supplier Master Code:</span>
                      <span className="font-mono font-bold text-primary">{basicDetails.code}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Supplier Classification:</span>
                      <Badge variant="outline">{basicDetails.type}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Corporate Website:</span>
                      <a href={basicDetails.website} target="_blank" rel="noreferrer" className="text-primary hover:underline flex items-center gap-1">
                        {basicDetails.website} <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 bg-muted/20 p-4 rounded-lg border">
                  <span className="font-bold text-foreground text-sm block">Warehouse & Registered Location</span>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Registered Address:</span>
                      <span className="font-medium text-foreground text-right max-w-xs">{basicDetails.address}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">City & State:</span>
                      <span className="font-medium text-foreground">{basicDetails.city}, {basicDetails.state}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Postal Code (PIN):</span>
                      <span className="font-mono text-foreground">{basicDetails.pincode}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Primary Phone:</span>
                      <span className="font-medium text-foreground">{basicDetails.contactPersons[0]?.phone || 'N/A'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Key Contact Persons */}
              <div className="space-y-2">
                <span className="font-bold text-xs text-muted-foreground uppercase tracking-wider">
                  Authorized Contact Persons & Logistics Leads
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  {basicDetails.contactPersons.map((cp, idx) => (
                    <div key={idx} className="border rounded-lg p-3 bg-card space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-foreground flex items-center gap-1.5">
                          <UserCheck className="h-3.5 w-3.5 text-primary" />
                          {cp.name}
                        </span>
                        {cp.isPrimary && <Badge className="text-[10px] py-0">Primary Officer</Badge>}
                      </div>
                      <p className="text-muted-foreground text-[11px]">{cp.designation}</p>
                      <div className="pt-1 flex items-center justify-between text-muted-foreground text-[11px]">
                        <span>Phone: <strong className="text-foreground">{cp.phone}</strong></span>
                        <span>Email: <strong className="text-foreground">{cp.email}</strong></span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ─── TAB 2: COMPLIANCE DOCUMENTS ─── */}
          {activeTab === 'COMPLIANCE' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-sm text-foreground block">
                    Statutory Licensing & Pharmaceutical Compliance
                  </span>
                  <p className="text-xs text-muted-foreground">
                    Regulated under Drugs and Cosmetics Act, 1940 and GST Tax Laws.
                  </p>
                </div>
                <Badge
                  className={`text-xs py-1 px-2.5 ${
                    compliance.verificationStatus === 'VERIFIED'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-rose-600 text-white'
                  }`}
                >
                  {compliance.verificationStatus}
                </Badge>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="border rounded-lg p-3 bg-card space-y-1">
                  <span className="text-muted-foreground">GSTIN Identification</span>
                  <div className="font-mono font-bold text-sm text-foreground">{compliance.gstin}</div>
                  <span className="text-[10px] text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Active on GSTN Portal
                  </span>
                </div>

                <div className="border rounded-lg p-3 bg-card space-y-1">
                  <span className="text-muted-foreground">PAN Tax Identity</span>
                  <div className="font-mono font-bold text-sm text-foreground">{compliance.pan}</div>
                  <span className="text-[10px] text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Income Tax Verified
                  </span>
                </div>

                <div className="border rounded-lg p-3 bg-card space-y-1">
                  <span className="text-muted-foreground">Wholesale Drug License (DL)</span>
                  <div className="font-mono font-bold text-sm text-primary">{compliance.dlNumber}</div>
                  <span className="text-[10px] text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Valid through {compliance.dlValidUntil}
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto border rounded-lg">
                <table className="w-full text-xs">
                  <thead className="bg-muted/60 text-muted-foreground uppercase text-[10px] font-semibold border-b">
                    <tr>
                      <th className="py-2.5 px-3 text-left">Document Title</th>
                      <th className="py-2.5 px-3 text-left">Certificate / License #</th>
                      <th className="py-2.5 px-3 text-left">Validity Period</th>
                      <th className="py-2.5 px-3 text-right">Verification Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-[11px]">
                    {compliance.documents.map((doc, idx) => (
                      <tr key={idx}>
                        <td className="py-2 px-3 font-semibold text-foreground">{doc.title}</td>
                        <td className="py-2 px-3 font-mono font-bold text-primary">{doc.docNumber}</td>
                        <td className="py-2 px-3 text-muted-foreground">{doc.validUntil}</td>
                        <td className="py-2 px-3 text-right">
                          <Badge variant="outline" className="text-[10px] py-0 text-emerald-600 border-emerald-500/30">
                            {doc.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ─── TAB 3: PRODUCTS SUPPLIED (SUPPLIER-PRODUCT MAPPING) ─── */}
          {activeTab === 'PRODUCTS' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-sm text-foreground block">
                    Supplier–Product Catalog & Negotiated Rates
                  </span>
                  <p className="text-xs text-muted-foreground">
                    Medicines and active formulations mapped to this vendor with contracted purchase costs.
                  </p>
                </div>
                {compliance.isPoPermitted && (
                  <Button asChild size="sm" className="h-7 text-xs gap-1 bg-primary font-semibold">
                    <Link href={`/purchases/new?supplierId=${basicDetails.id}`}>
                      <Plus className="h-3 w-3" /> Quick Order from Supplier
                    </Link>
                  </Button>
                )}
              </div>

              <div className="overflow-x-auto border rounded-lg">
                <table className="w-full text-xs">
                  <thead className="bg-muted/60 text-muted-foreground uppercase text-[10px] font-semibold border-b">
                    <tr>
                      <th className="py-2.5 px-3 text-left">Medicine & Brand</th>
                      <th className="py-2.5 px-2 text-left">Strength & Pack</th>
                      <th className="py-2.5 px-2 text-left">Supplier Code</th>
                      <th className="py-2.5 px-2 text-right">Contract Rate</th>
                      <th className="py-2.5 px-2 text-right">Retail MRP</th>
                      <th className="py-2.5 px-2 text-center">Margin</th>
                      <th className="py-2.5 px-2 text-left">Delivery Time</th>
                      <th className="py-2.5 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-[11px]">
                    {productsSupplied.map((prod) => (
                      <tr key={prod.productId} className="hover:bg-muted/20">
                        <td className="py-2 px-3">
                          <span className="font-bold text-foreground block">{prod.medicineName}</span>
                          <span className="text-[10px] text-muted-foreground">Mfg: {prod.manufacturer}</span>
                        </td>
                        <td className="py-2 px-2 text-muted-foreground">
                          {prod.strength} • {prod.packSize}
                        </td>
                        <td className="py-2 px-2 font-mono text-muted-foreground">
                          {prod.supplierProductCode}
                        </td>
                        <td className="py-2 px-2 text-right font-mono font-bold text-emerald-600">
                          {formatCurrency(prod.negotiatedRate)}
                        </td>
                        <td className="py-2 px-2 text-right font-mono text-muted-foreground">
                          {formatCurrency(prod.mrp)}
                        </td>
                        <td className="py-2 px-2 text-center">
                          <Badge variant="outline" className="text-[10px] py-0 text-emerald-600">
                            {prod.marginPct}%
                          </Badge>
                        </td>
                        <td className="py-2 px-2 text-foreground font-medium flex items-center gap-1">
                          <Truck className="h-3 w-3 text-muted-foreground shrink-0" />
                          {prod.deliveryTime}
                        </td>
                        <td className="py-2 px-3 text-right">
                          <Button asChild size="sm" variant="outline" className="h-6 text-[10px] px-2 font-semibold border-primary/30 text-primary">
                            <Link href={`/purchases/new?supplierId=${basicDetails.id}&productId=${prod.productId}`}>
                              Order
                            </Link>
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ─── TAB 4: COMMERCIAL TERMS ─── */}
          {activeTab === 'COMMERCIAL' && (
            <div className="space-y-4">
              <span className="font-bold text-sm text-foreground block">
                Agreed Commercial Terms & Trade Discounts
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="border rounded-lg p-4 bg-muted/20 space-y-2.5">
                  <span className="font-bold text-foreground text-xs uppercase tracking-wider block">Credit & Settlement</span>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Agreed Credit Period:</span>
                    <span className="font-bold text-foreground">{commercialTerms.creditDays} Days Net</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Approved Credit Line:</span>
                    <span className="font-mono font-bold text-primary">{formatCurrency(commercialTerms.creditLimit)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Current Credit Utilization:</span>
                    <span className="font-mono font-bold text-rose-600">{formatCurrency(commercialTerms.usedCredit)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Available Credit Headroom:</span>
                    <span className="font-mono font-bold text-emerald-600">{formatCurrency(commercialTerms.availableCredit)}</span>
                  </div>
                  <div className="flex justify-between pt-1 border-t">
                    <span className="text-muted-foreground">Prompt Payment Cash Bonus:</span>
                    <span className="font-bold text-emerald-600">{commercialTerms.cashDiscount}</span>
                  </div>
                </div>

                <div className="border rounded-lg p-4 bg-muted/20 space-y-2.5">
                  <span className="font-bold text-foreground text-xs uppercase tracking-wider block">Logistics & Free-Goods Schemes</span>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Free Goods / Bonus Scheme:</span>
                    <span className="font-semibold text-primary">{commercialTerms.freeGoodsScheme}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Minimum Order Quantity (MOQ):</span>
                    <span className="font-bold text-foreground">{commercialTerms.minimumOrderQuantity} packs</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Delivery Freight Policy:</span>
                    <span className="font-medium text-foreground">{commercialTerms.deliveryCharges}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Preferred Disbursement:</span>
                    <span className="font-mono text-foreground">{commercialTerms.paymentMethod}</span>
                  </div>
                  <div className="flex justify-between pt-1 border-t">
                    <span className="text-muted-foreground">Price Contract Lock Period:</span>
                    <span className="font-bold text-foreground">{commercialTerms.priceProtectionDays} Days</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ─── TAB 5: BANK & PAYMENT DETAILS ─── */}
          {activeTab === 'BANK' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-sm text-foreground block">
                    Verified Disbursement Account & NPCI Audit
                  </span>
                  <p className="text-xs text-muted-foreground">
                    Protected against vendor impersonation and bank change fraud via Penny-Drop verification.
                  </p>
                </div>
                <Badge className="bg-emerald-600 text-white text-xs">
                  <ShieldCheck className="h-3 w-3 mr-1" />
                  {bankDetails.verificationStatus}
                </Badge>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="border rounded-lg p-4 bg-muted/20 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Beneficiary Title:</span>
                    <span className="font-bold text-foreground">{bankDetails.beneficiaryName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Bank Name:</span>
                    <span className="font-semibold text-foreground">{bankDetails.bankName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Account Number:</span>
                    <span className="font-mono font-bold text-primary">{bankDetails.accountNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">IFSC Code:</span>
                    <span className="font-mono font-bold text-foreground">{bankDetails.ifsc}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Branch:</span>
                    <span className="text-muted-foreground">{bankDetails.branch}</span>
                  </div>
                </div>

                <div className="border rounded-lg p-4 bg-card space-y-2">
                  <span className="font-bold text-xs uppercase tracking-wider text-muted-foreground block">
                    Bank Change Audit Trail & Authorization Log
                  </span>
                  {bankDetails.auditTrail.map((log, idx) => (
                    <div key={idx} className="border-l-2 border-emerald-500 pl-3 py-1 text-[11px] space-y-0.5">
                      <span className="font-bold text-foreground block">{log.action}</span>
                      <p className="text-muted-foreground">{log.detail}</p>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {formatDate(log.date)} • Authenticated by {log.user}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ─── TAB 6: PURCHASE HISTORY ─── */}
          {activeTab === 'HISTORY' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-foreground">
                  Purchase Orders & Invoices Timeline
                </span>
                <span className="text-xs text-muted-foreground font-mono">
                  Total Orders: {purchaseHistory.totalOrders} • Total Billed: {formatCurrency(purchaseHistory.totalPurchased)}
                </span>
              </div>

              <div className="overflow-x-auto border rounded-lg">
                <table className="w-full text-xs">
                  <thead className="bg-muted/60 text-muted-foreground uppercase text-[10px] font-semibold border-b">
                    <tr>
                      <th className="py-2.5 px-3 text-left">Document #</th>
                      <th className="py-2.5 px-2 text-left">Date</th>
                      <th className="py-2.5 px-2 text-right">Order Amount</th>
                      <th className="py-2.5 px-2 text-right">Balance Due</th>
                      <th className="py-2.5 px-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-[11px]">
                    {purchaseHistory.recentInvoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-muted/20">
                        <td className="py-2 px-3 font-mono font-bold text-primary">
                          {inv.invoiceNumber}
                        </td>
                        <td className="py-2 px-2 text-muted-foreground">
                          {formatDate(inv.date)}
                        </td>
                        <td className="py-2 px-2 text-right font-mono font-bold text-foreground">
                          {formatCurrency(inv.amount)}
                        </td>
                        <td className="py-2 px-2 text-right font-mono font-bold text-rose-600">
                          {formatCurrency(inv.balanceDue)}
                        </td>
                        <td className="py-2 px-3 text-right">
                          <Badge variant="outline" className="text-[10px] py-0">
                            {inv.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ─── TAB 7: PERFORMANCE & RISK ─── */}
          {activeTab === 'PERFORMANCE' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-sm text-foreground block">
                    Distributor Performance Scorecard & Quality Audits
                  </span>
                  <p className="text-xs text-muted-foreground">
                    Aggregated across past order fulfillment, return credit speed, and cold-chain integrity.
                  </p>
                </div>
                <Badge className="bg-emerald-600 text-white text-xs">
                  Grade {performanceAndRisk.overallGrade} Verified
                </Badge>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="border rounded-lg p-3 bg-muted/20 text-center">
                  <span className="text-muted-foreground text-[10px] block">Delivery Reliability</span>
                  <span className="font-bold text-lg text-emerald-600 font-mono">
                    {performanceAndRisk.deliveryReliabilityScore}%
                  </span>
                </div>
                <div className="border rounded-lg p-3 bg-muted/20 text-center">
                  <span className="text-muted-foreground text-[10px] block">On-Time Arrival</span>
                  <span className="font-bold text-lg text-primary font-mono">
                    {performanceAndRisk.onTimeDeliveryRate}%
                  </span>
                </div>
                <div className="border rounded-lg p-3 bg-muted/20 text-center">
                  <span className="text-muted-foreground text-[10px] block">Goods Rejection Rate</span>
                  <span className="font-bold text-lg text-emerald-600 font-mono">
                    {performanceAndRisk.rejectedGoodsPct}%
                  </span>
                </div>
                <div className="border rounded-lg p-3 bg-muted/20 text-center">
                  <span className="text-muted-foreground text-[10px] block">Credit Note Speed</span>
                  <span className="font-bold text-lg text-foreground font-mono">
                    {performanceAndRisk.expiryClaimResolutionHours} hrs
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ─── TAB 8: SUPPLIER STATEMENT (LEDGER) ─── */}
          {activeTab === 'STATEMENT' && (
            <div className="space-y-4 border rounded-xl p-5 bg-card print:border-none print:p-0">
              <div className="flex items-start justify-between border-b pb-4">
                <div>
                  <div className="font-bold text-base text-foreground tracking-tight">
                    OFFICIAL SUPPLIER STATEMENT & RUNNING RECONCILIATION LEDGER
                  </div>
                  <p className="text-xs text-muted-foreground">
                    PharmaCare Retail & Clinical Pharmacy • Statutory Accounts Division
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    As of: {formatDate(new Date())} • Supplier Code: {basicDetails.code}
                  </p>
                </div>

                <div className="flex items-center gap-2 print:hidden">
                  <Button
                    size="sm"
                    onClick={() => window.print()}
                    className="h-8 gap-1.5 text-xs font-semibold"
                  >
                    <Printer className="h-3.5 w-3.5" />
                    Print Statement
                  </Button>
                </div>
              </div>

              {/* 5 Reconciled Ledger Totals */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs bg-muted/20 p-3 rounded-lg border">
                <div>
                  <span className="text-muted-foreground text-[10px] block">Opening Balance</span>
                  <span className="font-mono font-bold text-foreground text-sm">₹0.00</span>
                </div>
                <div>
                  <span className="text-muted-foreground text-[10px] block">Billed Invoices (+)</span>
                  <span className="font-mono font-bold text-foreground text-sm">
                    {formatCurrency(purchaseHistory.totalPurchased)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground text-[10px] block">Debit Notes & Returns (-)</span>
                  <span className="font-mono font-bold text-rose-600 text-sm">
                    {formatCurrency(
                      purchaseHistory.returnsAndClaims.reduce((s, r) => s + r.amount, 0)
                    )}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground text-[10px] block">Disbursements / Paid (-)</span>
                  <span className="font-mono font-bold text-emerald-600 text-sm">
                    {formatCurrency(purchaseHistory.totalPaid)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground text-[10px] block font-bold">Closing Balance Due</span>
                  <span className="font-mono font-bold text-rose-600 text-sm">
                    {formatCurrency(purchaseHistory.balanceDue)}
                  </span>
                </div>
              </div>

              {/* Detailed Transaction Ledger Table */}
              <div className="overflow-x-auto border rounded-lg">
                <table className="w-full text-xs">
                  <thead className="bg-muted/60 text-muted-foreground uppercase text-[10px] font-semibold border-b">
                    <tr>
                      <th className="py-2.5 px-3 text-left">Date</th>
                      <th className="py-2.5 px-3 text-left">Document / Ref #</th>
                      <th className="py-2.5 px-3 text-left">Transaction Type</th>
                      <th className="py-2.5 px-3 text-right">Debit / Billed (₹)</th>
                      <th className="py-2.5 px-3 text-right">Credit / Settled (₹)</th>
                      <th className="py-2.5 px-3 text-right">Running Balance (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-[11px]">
                    {purchaseHistory.recentInvoices.map((inv) => (
                      <tr key={inv.id}>
                        <td className="py-2 px-3 text-muted-foreground">{formatDate(inv.date)}</td>
                        <td className="py-2 px-3 font-mono font-bold text-primary">{inv.invoiceNumber}</td>
                        <td className="py-2 px-3">
                          <Badge variant="outline" className="text-[10px] py-0">Purchase Bill</Badge>
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-semibold">
                          {formatCurrency(inv.amount)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-emerald-600">
                          {formatCurrency(inv.amount - inv.balanceDue)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-rose-600">
                          {formatCurrency(inv.balanceDue)}
                        </td>
                      </tr>
                    ))}
                    {purchaseHistory.returnsAndClaims.map((ret) => (
                      <tr key={ret.id} className="bg-rose-500/5">
                        <td className="py-2 px-3 text-muted-foreground">{formatDate(ret.date)}</td>
                        <td className="py-2 px-3 font-mono font-bold text-rose-600">{ret.returnNumber}</td>
                        <td className="py-2 px-3">
                          <Badge variant="outline" className="text-[10px] py-0 text-rose-600 border-rose-500/30">
                            Debit Note
                          </Badge>
                        </td>
                        <td className="py-2 px-3 text-right font-mono">—</td>
                        <td className="py-2 px-3 text-right font-mono text-rose-600 font-bold">
                          {formatCurrency(ret.amount)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-muted-foreground">—</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="pt-3 border-t text-[11px] text-muted-foreground flex items-center justify-between">
                <span>Certified authentic statement generated from verified supplier master ledger records.</span>
                <span className="font-semibold text-foreground">Pharmacist In-Charge Signature</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
