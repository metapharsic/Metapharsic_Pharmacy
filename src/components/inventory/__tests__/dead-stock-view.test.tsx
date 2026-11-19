import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { DeadStockView } from '../dead-stock-view'

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    refresh: jest.fn(),
  }),
}))

const mockToast = {
  success: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  warning: jest.fn(),
}

jest.mock('@/lib/hooks/use-toast', () => ({
  useToast: () => mockToast,
}))

describe('DeadStockView Component', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    global.fetch = jest.fn()
  })

  it('renders dead stock KPI cards and table rows when data loads successfully', async () => {
    const mockData = {
      deadItems: [
        {
          inventoryId: 'inv-1',
          productId: 'p-1',
          productName: 'Cetirizine 10mg',
          sku: 'CET-10',
          rack: 'RACK-B',
          shelf: 'S2',
          box: 'Box 03',
          supplierName: 'Sun Pharma',
          daysInactive: 120,
          status: 'DEAD_STOCK',
          availableQuantity: 50,
          unitOfMeasure: 'Strip',
          costPrice: 20,
          mrp: 35,
          capitalLockedAtCost: 1000,
          capitalLockedAtMrp: 1750,
        },
      ],
      summary: {
        totalDeadItemsCount: 1,
        totalDeadCapitalAtCost: 1000,
        totalDeadCapitalAtMrp: 1750,
        slowMovingCount: 0,
        deadStockCount: 1,
        obsoleteCount: 0,
      },
    }

    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: mockData,
      }),
    })

    render(<DeadStockView branchId="br-1" />)

    await waitFor(() => {
      expect(screen.getByText('Cetirizine 10mg')).toBeInTheDocument()
      expect(screen.getByText('Locked Working Capital')).toBeInTheDocument()
      expect(screen.getByText('Sun Pharma')).toBeInTheDocument()
    })
  })

  it('renders error state and retry button when fetch fails, allowing user to retry', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({
        success: false,
        error: { message: 'Internal Server Error' },
      }),
    })

    render(<DeadStockView branchId="br-1" />)

    await waitFor(() => {
      expect(screen.getByText('Internal Server Error')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
    })

    // Click retry
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          deadItems: [],
          summary: {
            totalDeadItemsCount: 0,
            totalDeadCapitalAtCost: 0,
            totalDeadCapitalAtMrp: 0,
            slowMovingCount: 0,
            deadStockCount: 0,
            obsoleteCount: 0,
          },
        },
      }),
    })

    fireEvent.click(screen.getByRole('button', { name: /retry/i }))

    await waitFor(() => {
      expect(screen.getByText(/Zero Dead Stock/i)).toBeInTheDocument()
    })
  })

  it('renders zero dead stock empty state when no items meet inactivity threshold', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          deadItems: [],
          summary: {
            totalDeadItemsCount: 0,
            totalDeadCapitalAtCost: 0,
            totalDeadCapitalAtMrp: 0,
            slowMovingCount: 0,
            deadStockCount: 0,
            obsoleteCount: 0,
          },
        },
      }),
    })

    render(<DeadStockView branchId="br-1" />)

    await waitFor(() => {
      expect(screen.getByText(/Zero Dead Stock/i)).toBeInTheDocument()
    })
  })

  it('filters displayed items when search query is typed', async () => {
    const mockData = {
      deadItems: [
        {
          inventoryId: 'inv-1',
          productId: 'p-1',
          productName: 'Paracetamol 500mg',
          sku: 'PCM-500',
          supplierName: 'Cipla',
          daysInactive: 75,
          status: 'SLOW_MOVING',
          availableQuantity: 100,
          costPrice: 10,
          mrp: 20,
          capitalLockedAtCost: 1000,
          capitalLockedAtMrp: 2000,
        },
        {
          inventoryId: 'inv-2',
          productId: 'p-2',
          productName: 'Azithromycin 500mg',
          sku: 'AZI-500',
          supplierName: 'Sun Pharma',
          daysInactive: 120,
          status: 'DEAD_STOCK',
          availableQuantity: 30,
          costPrice: 40,
          mrp: 65,
          capitalLockedAtCost: 1200,
          capitalLockedAtMrp: 1950,
        },
      ],
      summary: {
        totalDeadItemsCount: 2,
        totalDeadCapitalAtCost: 2200,
        totalDeadCapitalAtMrp: 3950,
        slowMovingCount: 1,
        deadStockCount: 1,
        obsoleteCount: 0,
      },
    }

    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: mockData,
      }),
    })

    render(<DeadStockView branchId="br-1" />)

    await waitFor(() => {
      expect(screen.getByText('Paracetamol 500mg')).toBeInTheDocument()
      expect(screen.getByText('Azithromycin 500mg')).toBeInTheDocument()
    })

    const searchInput = screen.getByPlaceholderText(/Filter medicine, vendor, rack, box…/i)
    fireEvent.change(searchInput, { target: { value: 'Azithro' } })

    expect(screen.queryByText('Paracetamol 500mg')).not.toBeInTheDocument()
    expect(screen.getByText('Azithromycin 500mg')).toBeInTheDocument()
  })
})
