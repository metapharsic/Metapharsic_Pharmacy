'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Download,
  Eye,
  RefreshCw,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  CheckCircle2,
  Clock,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { useToast } from '@/lib/hooks/use-toast'
import { formatDate } from '@/lib/utils/date'

type AuditRecord = {
  id: string
  action: string
  entity: string
  entityId?: string | null
  oldData?: any
  newData?: any
  metadata?: any
  ipAddress?: string | null
  createdAt: string
  user?: {
    id: string
    name: string
    email: string
  } | null
}

const ACTION_COLORS: Record<string, string> = {
  CREATE: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300',
  UPDATE: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300',
  DELETE: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300',
  LOGIN: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300',
  PURCHASE_BILL_SCAN_CONFIRM: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300',
  PURCHASE_BILL_ADMIN_RISK_OVERRIDE: 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300',
  PURCHASE_SCAN_ERROR: 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/60 dark:text-rose-200',
  PURCHASE_SCAN_PROVISION_ERROR: 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/60 dark:text-rose-200',
}

export function AuditLogClient() {
  const [logs, setLogs] = useState<AuditRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState('ALL')
  const [entityFilter, setEntityFilter] = useState('ALL')
  const [selectedRecord, setSelectedRecord] = useState<AuditRecord | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const toast = useToast()

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (actionFilter !== 'ALL') params.set('action', actionFilter)
      if (entityFilter !== 'ALL') params.set('entity', entityFilter)
      if (search.trim()) params.set('search', search.trim())
      params.set('limit', '50')

      const res = await fetch(`/api/audit?${params.toString()}`)
      const json = await res.json()
      if (json.success && Array.isArray(json.data)) {
        setLogs(json.data)
      } else {
        toast.error('Failed to load audit logs')
      }
    } catch {
      toast.error('Network error loading audit logs')
    } finally {
      setLoading(false)
    }
  }, [actionFilter, entityFilter, search, toast])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  const handleExportCSV = async () => {
    try {
      const res = await fetch('/api/audit?export=csv')
      const json = await res.json()
      if (!json.success || !Array.isArray(json.data)) {
        toast.error('No audit records to export')
        return
      }

      const rows = json.data.map((l: AuditRecord) => ({
        Timestamp: new Date(l.createdAt).toISOString(),
        User: l.user?.name ? `${l.user.name} (${l.user.email})` : 'System',
        Action: l.action,
        Entity: l.entity,
        EntityId: l.entityId || 'N/A',
        IPAddress: l.ipAddress || 'Internal',
      }))

      const Papa = (await import('papaparse')).default
      const csv = Papa.unparse(rows)
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.setAttribute('download', `audit_trail_${new Date().toISOString().slice(0, 10)}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      toast.success('Audit trail exported successfully')
    } catch {
      toast.error('Failed to export CSV')
    }
  }

  const handleInspect = (record: AuditRecord) => {
    setSelectedRecord(record)
    setDialogOpen(true)
  }

  return (
    <div className="space-y-4">
      {/* Controls Bar */}
      <Card>
        <CardContent className="p-3.5 space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by user, email, or record ID…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 text-xs h-9"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                aria-label="Filter by action"
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                className="h-9 rounded-md border border-border/80 bg-background px-2.5 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="ALL">All Actions</option>
                <option value="CREATE">CREATE</option>
                <option value="UPDATE">UPDATE</option>
                <option value="DELETE">DELETE</option>
                <option value="LOGIN">LOGIN</option>
              </select>

              <select
                aria-label="Filter by entity"
                value={entityFilter}
                onChange={(e) => setEntityFilter(e.target.value)}
                className="h-9 rounded-md border border-border/80 bg-background px-2.5 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="ALL">All Entities</option>
                <option value="Sale">Sale</option>
                <option value="Product">Product</option>
                <option value="User">User</option>
                <option value="Role">Role</option>
                <option value="Batch">Batch</option>
                <option value="Organization">Organization</option>
              </select>

              <Button variant="outline" size="sm" onClick={fetchLogs} className="h-9 text-xs">
                <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>

              <Button size="sm" onClick={handleExportCSV} className="h-9 text-xs">
                <Download className="h-3.5 w-3.5 mr-1.5" />
                Export CSV
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Audit Log Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <tr className="border-b border-border/70 bg-muted/40 font-semibold text-muted-foreground text-xs">
                <th className="py-2.5 px-3 text-left">Timestamp</th>
                <th className="py-2.5 px-3 text-left">User</th>
                <th className="py-2.5 px-3 text-left">Action</th>
                <th className="py-2.5 px-3 text-left">Entity</th>
                <th className="py-2.5 px-3 text-left">Target ID</th>
                <th className="py-2.5 px-3 text-left">IP Address</th>
                <th className="py-2.5 px-3 text-center w-20">Inspect</th>
              </tr>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-40 text-center text-xs text-muted-foreground">
                    Loading audit trail records…
                  </TableCell>
                </TableRow>
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-40 text-center text-xs text-muted-foreground">
                    No compliance audit records found matching the filter criteria.
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((record) => (
                  <TableRow key={record.id} className="text-xs hover:bg-muted/30">
                    <TableCell className="font-mono text-muted-foreground py-2 px-3 whitespace-nowrap">
                      {formatDate(record.createdAt)} {new Date(record.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </TableCell>
                    <TableCell className="py-2 px-3">
                      <div>
                        <p className="font-medium text-foreground">{record.user?.name ?? 'System Service'}</p>
                        <p className="text-[11px] text-muted-foreground">{record.user?.email ?? 'automation@pharmacare'}</p>
                      </div>
                    </TableCell>
                    <TableCell className="py-2 px-3">
                      <span
                        className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
                          ACTION_COLORS[record.action] || 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        {record.action}
                      </span>
                    </TableCell>
                    <TableCell className="font-semibold text-foreground py-2 px-3">
                      {record.entity}
                    </TableCell>
                    <TableCell className="font-mono text-[11px] text-muted-foreground py-2 px-3 truncate max-w-[140px]">
                      {record.entityId || '—'}
                    </TableCell>
                    <TableCell className="font-mono text-[11px] text-muted-foreground py-2 px-3">
                      {record.ipAddress || '127.0.0.1'}
                    </TableCell>
                    <TableCell className="py-2 px-3 text-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleInspect(record)}
                        title="View Change Diff"
                      >
                        <Eye className="h-3.5 w-3.5 text-primary" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* JSON Diff Inspector Modal */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span
                className={`px-2 py-0.5 rounded text-xs font-semibold border ${
                  selectedRecord ? ACTION_COLORS[selectedRecord.action] : ''
                }`}
              >
                {selectedRecord?.action}
              </span>
              <span>{selectedRecord?.entity} Record Modification</span>
            </DialogTitle>
            <DialogDescription>
              Logged on {selectedRecord?.createdAt ? formatDate(selectedRecord.createdAt) : ''} by{' '}
              <span className="font-semibold text-foreground">{selectedRecord?.user?.name ?? 'System'}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="grid grid-cols-2 gap-3 p-3 rounded-lg border border-border/80 bg-muted/20">
              <div>
                <span className="text-muted-foreground">Entity:</span>{' '}
                <span className="font-semibold">{selectedRecord?.entity}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Entity ID:</span>{' '}
                <span className="font-mono font-medium">{selectedRecord?.entityId || 'N/A'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Operator:</span>{' '}
                <span>{selectedRecord?.user?.email ?? 'System Engine'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">IP Address:</span>{' '}
                <span className="font-mono">{selectedRecord?.ipAddress || 'Internal Host'}</span>
              </div>
            </div>

            {selectedRecord?.metadata && (
              <div className="space-y-1">
                <p className="font-semibold text-teal-600 dark:text-teal-400">Troubleshooting & Diagnostic Metadata:</p>
                <pre className="p-2.5 rounded-lg border border-teal-500/30 bg-teal-500/5 font-mono text-[11px] overflow-x-auto max-h-60 text-slate-800 dark:text-slate-200">
                  {JSON.stringify(selectedRecord.metadata, null, 2)}
                </pre>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <p className="font-semibold text-muted-foreground">Prior State (oldData):</p>
                <pre className="p-2.5 rounded-lg border border-border/70 bg-card font-mono text-[11px] overflow-x-auto max-h-60 text-slate-700 dark:text-slate-300">
                  {selectedRecord?.oldData
                    ? JSON.stringify(selectedRecord.oldData, null, 2)
                    : '// No prior snapshot recorded'}
                </pre>
              </div>

              <div className="space-y-1">
                <p className="font-semibold text-emerald-600 dark:text-emerald-400">Committed State (newData):</p>
                <pre className="p-2.5 rounded-lg border border-border/70 bg-card font-mono text-[11px] overflow-x-auto max-h-60 text-slate-700 dark:text-slate-300">
                  {selectedRecord?.newData
                    ? JSON.stringify(selectedRecord.newData, null, 2)
                    : '// No new state payload'}
                </pre>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
