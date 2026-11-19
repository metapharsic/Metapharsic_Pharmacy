/**
 * Shared query-parameter parsing for report API routes.
 *
 * Throwing `Error('Validation: ...')` maps to HTTP 400 with code
 * VALIDATION in the report routes (mirrors the app-wide errStatus
 * convention). Invalid input must never reach Prisma (which would 500).
 */

export const REPORT_MAX_LIMIT = 2000
export const REPORT_DEFAULT_LIMIT = 500
export const REPORT_MAX_DAYS_THRESHOLD = 365

export function parseReportDate(value: unknown, name: string): Date {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Validation: invalid ${name}`)
  }
  const date = new Date(value)
  if (isNaN(date.getTime())) {
    throw new Error(`Validation: invalid ${name}`)
  }
  return date
}

export function parseOptionalReportDate(value: unknown, name: string): Date | undefined {
  if (value === undefined || value === null || value === '') return undefined
  return parseReportDate(value, name)
}

export function parseDateRange(query: Record<string, string | undefined>): {
  startDate: Date
  endDate: Date
} {
  const startDate =
    query.startDate !== undefined && query.startDate !== ''
      ? parseReportDate(query.startDate, 'startDate')
      : new Date(0)
  const endDate =
    query.endDate !== undefined && query.endDate !== ''
      ? parseReportDate(query.endDate, 'endDate')
      : new Date()
  if (startDate.getTime() > endDate.getTime()) {
    throw new Error('Validation: startDate must not be after endDate')
  }
  return { startDate, endDate }
}

export function parseDaysThreshold(value: unknown): number {
  if (value === undefined || value === null || value === '') return 90
  const days = Number(value)
  if (!Number.isInteger(days) || days < 1 || days > REPORT_MAX_DAYS_THRESHOLD) {
    throw new Error('Validation: invalid daysThreshold')
  }
  return days
}

export function parseReportPagination(query: Record<string, string | undefined>): {
  page: number
  limit: number
} {
  let page = 1
  if (query.page !== undefined && query.page !== '') {
    page = Number(query.page)
    if (!Number.isInteger(page) || page < 1) {
      throw new Error('Validation: invalid page')
    }
  }
  let limit = REPORT_DEFAULT_LIMIT
  if (query.limit !== undefined && query.limit !== '') {
    limit = Number(query.limit)
    if (!Number.isInteger(limit) || limit < 1 || limit > REPORT_MAX_LIMIT) {
      throw new Error('Validation: invalid limit')
    }
  }
  return { page, limit }
}

export type ReportPeriod = 'daily' | 'weekly' | 'monthly' | 'custom'

export function parseReportPeriod(query: Record<string, string | undefined>): {
  period: ReportPeriod
  startDate: Date
  endDate: Date
  label: string
} {
  const rawPeriod = query.period !== undefined && query.period !== '' ? query.period.toLowerCase().trim() : undefined

  let period: ReportPeriod
  if (rawPeriod) {
    if (rawPeriod !== 'daily' && rawPeriod !== 'weekly' && rawPeriod !== 'monthly' && rawPeriod !== 'custom') {
      throw new Error('Validation: invalid report period')
    }
    period = rawPeriod as ReportPeriod
  } else if (query.startDate !== undefined || query.endDate !== undefined) {
    period = 'custom'
  } else {
    period = 'daily'
  }

  const baseDate = query.date ? parseReportDate(query.date, 'date') : new Date()

  if (period === 'daily') {
    const startDate = new Date(baseDate)
    startDate.setHours(0, 0, 0, 0)
    const endDate = new Date(baseDate)
    endDate.setHours(23, 59, 59, 999)
    const yyyy = startDate.getFullYear()
    const mm = String(startDate.getMonth() + 1).padStart(2, '0')
    const dd = String(startDate.getDate()).padStart(2, '0')
    return {
      period: 'daily',
      startDate,
      endDate,
      label: `Daily Report (${yyyy}-${mm}-${dd})`,
    }
  }

  if (period === 'weekly') {
    const endDate = new Date(baseDate)
    endDate.setHours(23, 59, 59, 999)
    const startDate = new Date(endDate)
    startDate.setDate(startDate.getDate() - 6)
    startDate.setHours(0, 0, 0, 0)
    const startStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`
    const endStr = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`
    return {
      period: 'weekly',
      startDate,
      endDate,
      label: `Weekly Report (${startStr} to ${endStr})`,
    }
  }

  if (period === 'monthly') {
    const year = baseDate.getFullYear()
    const month = baseDate.getMonth()
    const startDate = new Date(year, month, 1, 0, 0, 0, 0)
    const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999)
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ]
    return {
      period: 'monthly',
      startDate,
      endDate,
      label: `Monthly Report (${monthNames[month]} ${year})`,
    }
  }

  // period === 'custom'
  const { startDate, endDate } = parseDateRange(query)
  const startStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`
  const endStr = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`
  return {
    period: 'custom',
    startDate,
    endDate,
    label: `Custom Report (${startStr} to ${endStr})`,
  }
}

