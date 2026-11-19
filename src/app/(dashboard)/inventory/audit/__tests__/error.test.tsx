import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import InventoryAuditError, {
  isChunkLoadError,
  CHUNK_RELOAD_STORAGE_KEY,
  CHUNK_RELOAD_DEBOUNCE_MS,
} from '../error'

describe('InventoryAuditError - isChunkLoadError helper', () => {
  it('identifies an error with name ChunkLoadError', () => {
    const error = new Error('Some chunk failed')
    error.name = 'ChunkLoadError'
    expect(isChunkLoadError(error)).toBe(true)
  })

  it('identifies an error with message matching "Loading chunk 9194 failed"', () => {
    const error = new Error('Loading chunk 9194 failed.\n(error: http://localhost:5888/chunk.js)')
    expect(isChunkLoadError(error)).toBe(true)
  })

  it('identifies case-insensitive chunkloaderror in name or message', () => {
    expect(isChunkLoadError(new Error('chunkloaderror occurred'))).toBe(true)
    expect(isChunkLoadError({ name: 'chunkloaderror', message: 'failed' })).toBe(true)
  })

  it('identifies css chunk loading errors', () => {
    expect(isChunkLoadError(new Error('Loading CSS chunk 1234 failed'))).toBe(true)
  })

  it('returns false for generic errors', () => {
    expect(isChunkLoadError(new Error('Database connection timeout'))).toBe(false)
    expect(isChunkLoadError(new TypeError('Cannot read properties of undefined'))).toBe(false)
  })

  it('returns false for null or undefined input', () => {
    expect(isChunkLoadError(null)).toBe(false)
    expect(isChunkLoadError(undefined)).toBe(false)
  })
})

describe('InventoryAuditError Component - Regular Error Handling', () => {
  let originalConsoleError: typeof console.error
  let reloadMock: jest.Mock

  beforeEach(() => {
    originalConsoleError = console.error
    console.error = jest.fn()
    sessionStorage.clear()

    reloadMock = jest.fn()
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        reload: reloadMock,
      },
    })
  })

  afterEach(() => {
    console.error = originalConsoleError
    sessionStorage.clear()
  })

  it('renders error message and "Try Again" button for generic errors', () => {
    const mockReset = jest.fn()
    const error = new Error('Database connection failed')

    render(<InventoryAuditError error={error} reset={mockReset} />)

    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByText('Database connection failed')).toBeInTheDocument()

    const tryAgainBtn = screen.getByRole('button', { name: /try again/i })
    expect(tryAgainBtn).toBeInTheDocument()

    fireEvent.click(tryAgainBtn)
    expect(mockReset).toHaveBeenCalledTimes(1)
  })

  it('renders "Reload Page" button and invokes location.reload when clicked', () => {
    const mockReset = jest.fn()
    const error = new Error('Unexpected network glitch')

    render(<InventoryAuditError error={error} reset={mockReset} />)

    const reloadBtn = screen.getByRole('button', { name: /reload page/i })
    expect(reloadBtn).toBeInTheDocument()

    fireEvent.click(reloadBtn)
    expect(reloadMock).toHaveBeenCalledTimes(1)
  })

  it('displays digest if provided on error object', () => {
    const mockReset = jest.fn()
    const error = Object.assign(new Error('Crash with digest'), { digest: 'ERR_DIGEST_98765' })

    render(<InventoryAuditError error={error} reset={mockReset} />)

    expect(screen.getByText(/Digest:\s*ERR_DIGEST_98765/)).toBeInTheDocument()
  })
})

describe('InventoryAuditError Component - ChunkLoadError Auto-Recovery', () => {
  let originalConsoleError: typeof console.error
  let reloadMock: jest.Mock

  beforeEach(() => {
    originalConsoleError = console.error
    console.error = jest.fn()
    sessionStorage.clear()

    reloadMock = jest.fn()
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        reload: reloadMock,
      },
    })
  })

  afterEach(() => {
    console.error = originalConsoleError
    sessionStorage.clear()
  })

  it('triggers auto-reload handler and displays deployment update notification on fresh ChunkLoadError', () => {
    const mockReset = jest.fn()
    const chunkError = new Error('Loading chunk 9194 failed. (error: http://localhost:5888/...)')
    chunkError.name = 'ChunkLoadError'

    render(<InventoryAuditError error={chunkError} reset={mockReset} />)

    // Should display update detected header
    expect(screen.getByText('Application Update Detected')).toBeInTheDocument()
    // Should display deployment update notification banner
    expect(screen.getByText(/Deployment update notification:/i)).toBeInTheDocument()
    expect(screen.getByText(/A newer version of the application was deployed/i)).toBeInTheDocument()

    // Auto-reload handler should have been triggered
    expect(reloadMock).toHaveBeenCalledTimes(1)

    // Timestamp should be stored in sessionStorage
    const storedTs = sessionStorage.getItem(CHUNK_RELOAD_STORAGE_KEY)
    expect(storedTs).toBeTruthy()
    expect(Number(storedTs)).toBeGreaterThan(0)
  })

  it('prevents infinite reload loops when reload was already attempted within debounce window', () => {
    const mockReset = jest.fn()
    const now = Date.now()
    // Simulate a reload attempted 3 seconds ago (within 10s cooldown)
    sessionStorage.setItem(CHUNK_RELOAD_STORAGE_KEY, (now - 3000).toString())

    const chunkError = new Error('Loading chunk 9194 failed.')
    chunkError.name = 'ChunkLoadError'

    render(<InventoryAuditError error={chunkError} reset={mockReset} />)

    // Auto-reload should NOT have been triggered
    expect(reloadMock).not.toHaveBeenCalled()

    // Deployment update notification indicates loop prevention
    expect(
      screen.getByText(/Automatic reload was paused to prevent an infinite loop/i)
    ).toBeInTheDocument()

    // User can still manually click "Reload Page"
    const reloadBtn = screen.getByRole('button', { name: /reload page/i })
    fireEvent.click(reloadBtn)
    expect(reloadMock).toHaveBeenCalledTimes(1)

    // User can also click "Try Again"
    const tryAgainBtn = screen.getByRole('button', { name: /try again/i })
    fireEvent.click(tryAgainBtn)
    expect(mockReset).toHaveBeenCalledTimes(1)
  })

  it('triggers auto-reload if the previous reload was outside the 10-second debounce window', () => {
    const mockReset = jest.fn()
    const now = Date.now()
    // Simulate a reload attempted 15 seconds ago (outside 10s cooldown)
    sessionStorage.setItem(CHUNK_RELOAD_STORAGE_KEY, (now - 15000).toString())

    const chunkError = new Error('Loading chunk 9194 failed.')

    render(<InventoryAuditError error={chunkError} reset={mockReset} />)

    // Reload handler should be called
    expect(reloadMock).toHaveBeenCalledTimes(1)
  })
})
