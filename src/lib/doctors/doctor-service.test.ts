import { prisma } from '@/lib/db/prisma'
import {
  createDoctor,
  getDoctorCommissions,
  listDoctors,
  settleDoctorCommission,
} from './doctor-service'

jest.mock('@/lib/db/prisma', () => {
  const doctor = {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  }
  const doctorCommission = {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    aggregate: jest.fn(),
    count: jest.fn(),
  }
  const client = { doctor, doctorCommission }
  return {
    __esModule: true,
    default: client,
    prisma: client,
  }
})

describe('Doctor Service Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('lists active doctors with count', async () => {
    const mockDoctors = [
      {
        id: 'doc-1',
        name: 'Dr. John Doe',
        regNumber: 'REG-123',
        commissionPercent: 5,
        isActive: true,
        notes: null,
        createdAt: new Date(),
        _count: { sales: 2, commissions: 0 },
      },
    ]
    ;(prisma.doctor.findMany as jest.Mock).mockResolvedValue(mockDoctors)
    ;(prisma.doctor.count as jest.Mock).mockResolvedValue(1)

    const result = await listDoctors({ search: 'John', limit: 10 })
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Dr. John Doe')
    expect(prisma.doctor.findMany).toHaveBeenCalledTimes(1)
  })

  it('creates a doctor profile with formatted commission rate', async () => {
    const newDoc = {
      id: 'doc-2',
      name: 'Dr. Jane Smith',
      regNumber: 'REG-456',
      commissionPercent: 8,
      isActive: true,
    }
    ;(prisma.doctor.create as jest.Mock).mockResolvedValue(newDoc)

    const result = await createDoctor({
      name: 'Dr. Jane Smith',
      regNumber: 'REG-456',
      commissionPercent: 8,
    })
    expect(result).toEqual(newDoc)
    expect(prisma.doctor.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: 'Dr. Jane Smith',
        regNumber: 'REG-456',
        commissionPercent: 8,
      }),
    })
  })

  it('settles a doctor commission record', async () => {
    const mockCommission = {
      id: 'comm-1',
      doctorId: 'doc-1',
      doctor: { id: 'doc-1', organizationId: 'org-1' },
      isPaid: false,
      saleAmount: 1000,
      commissionAmount: 50,
      commissionPercent: 5,
    }
    const mockSettled = {
      id: 'comm-1',
      doctorId: 'doc-1',
      isPaid: true,
      paidAt: new Date(),
      paymentReference: 'UPI-12345',
      saleAmount: 1000,
      commissionAmount: 50,
      commissionPercent: 5,
    }
    ;(prisma.doctorCommission.findUnique as jest.Mock).mockResolvedValue(mockCommission)
    ;(prisma.doctorCommission.update as jest.Mock).mockResolvedValue(mockSettled)

    const result = await settleDoctorCommission('comm-1', { paymentReference: 'UPI-12345' })
    expect(result.isPaid).toBe(true)
    expect(result.paymentReference).toBe('UPI-12345')
    expect(prisma.doctorCommission.update).toHaveBeenCalledWith({
      where: { id: 'comm-1' },
      data: expect.objectContaining({
        isPaid: true,
        paymentReference: 'UPI-12345',
      }),
    })
  })

  it('rejects settling doctor commission from another organization', async () => {
    const mockCommission = {
      id: 'comm-foreign',
      doctorId: 'doc-foreign',
      doctor: { id: 'doc-foreign', organizationId: 'foreign-org' },
      isPaid: false,
    }
    ;(prisma.doctorCommission.findUnique as jest.Mock).mockResolvedValue(mockCommission)

    const actor = { id: 'user-1', branchId: 'br-1', organizationId: 'my-org', isSuperAdmin: false }
    await expect(
      settleDoctorCommission('comm-foreign', { paymentReference: 'CASH' }, actor)
    ).rejects.toThrow('Forbidden: doctor commission belongs to another organization')
  })

  it('fetches commission ledger with summary aggregation', async () => {
    const mockCommissions = [
      {
        id: 'comm-1',
        doctorId: 'doc-1',
        saleId: 'sale-1',
        saleAmount: 1000,
        commissionPercent: 5,
        commissionAmount: 50,
        isPaid: false,
        paidAt: null,
        paymentReference: null,
        createdAt: new Date(),
        doctor: {
          name: 'Dr. John Doe',
          regNumber: 'REG-123',
          clinicName: 'Apollo',
          phone: '9988776655',
        },
        sale: {
          invoiceNumber: 'INV-1001',
          saleDate: new Date(),
          customer: { name: 'Patient A' },
        },
      },
    ]
    ;(prisma.doctorCommission.findMany as jest.Mock).mockResolvedValue(mockCommissions)
    ;(prisma.doctorCommission.count as jest.Mock).mockResolvedValue(1)
    ;(prisma.doctorCommission.aggregate as jest.Mock).mockResolvedValue({
      _sum: {
        saleAmount: 1000,
        commissionAmount: 50,
      },
    })

    const result = await getDoctorCommissions({ doctorId: 'doc-1' })
    expect(result.items).toHaveLength(1)
    expect(result.items[0].doctorName).toBe('Dr. John Doe')
    expect(result.summary.totalSalesVolume).toBe(1000)
    expect(result.summary.totalCommissionEarned).toBe(50)
  })
})
