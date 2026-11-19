'use client'

// ─────────────────────────────────────────────────────────────
// Store — POS Cart Sync (Cross-Page & Cross-Tab Persistence)
// Allows products scanned or added from Inventory Management
// to seamlessly appear in the active POS checkout session.
// ─────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react'

export interface PosCartLine {
  productId: string
  sku: string
  barcode: string | null
  name: string
  genericName?: string | null
  unitOfMeasure: string
  mrp: number
  gstRate: number
  cgstRate: number
  sgstRate: number
  igstRate: number
  hsnCode: string | null
  drugSchedule: string
  isPrescriptionRequired: boolean
  isGstExempt: boolean
  quantity: number
  discountPercent: number
  availableQuantity: number
  categoryName?: string | null
  composition?: string | null
  batchId?: string
  batchNumber?: string
  expiryDate?: string | Date
  unit?: 'STRIP' | 'TABLET' | string
  isTabletSale?: boolean
  tabsCut?: number | null
  tabsPerStrip?: number | null
  originalMrp?: number
}

const STORAGE_KEY = 'pharmacare_pos_cart'
const EVENT_NAME = 'pharmacare:pos-cart-updated'

// ─── Non-React Core Helpers ──────────────────────────────────

export function getPosCart(): PosCartLine[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function setPosCart(items: PosCartLine[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: items }))
  } catch {
    // Ignore storage quota errors
  }
}

export function clearPosCart(): void {
  setPosCart([])
}

export function addPosCartItem(item: PosCartLine): {
  cart: PosCartLine[]
  isNew: boolean
  updatedItem: PosCartLine
} {
  const current = getPosCart()
  const existingIndex = current.findIndex(
    (c) => c.productId === item.productId && (!item.batchId || c.batchId === item.batchId)
  )

  let isNew = false
  let updatedItem: PosCartLine

  if (existingIndex >= 0) {
    const existing = current[existingIndex]
    const maxQty = existing.availableQuantity > 0 ? existing.availableQuantity : 999
    const newQty = Math.min(existing.quantity + (item.quantity || 1), maxQty)
    updatedItem = { ...existing, quantity: newQty }
    current[existingIndex] = updatedItem
  } else {
    isNew = true
    updatedItem = {
      ...item,
      quantity: Math.max(1, item.quantity || 1),
    }
    current.push(updatedItem)
  }

  setPosCart(current)
  return { cart: current, isNew, updatedItem }
}

export function updatePosCartItemQuantity(
  productId: string,
  quantity: number,
  batchId?: string
): PosCartLine[] {
  const current = getPosCart()
  if (quantity <= 0) {
    return removePosCartItem(productId, batchId)
  }

  const updated = current.map((c) => {
    if (c.productId === productId && (!batchId || c.batchId === batchId)) {
      const maxQty = c.availableQuantity > 0 ? c.availableQuantity : 999
      return { ...c, quantity: Math.min(quantity, maxQty) }
    }
    return c
  })

  setPosCart(updated)
  return updated
}

export function removePosCartItem(productId: string, batchId?: string): PosCartLine[] {
  const current = getPosCart()
  const updated = current.filter(
    (c) => !(c.productId === productId && (!batchId || c.batchId === batchId))
  )
  setPosCart(updated)
  return updated
}

export function getPosCartSummary(): {
  itemCount: number
  totalUnits: number
  subtotal: number
} {
  const cart = getPosCart()
  let totalUnits = 0
  let subtotal = 0
  for (const line of cart) {
    totalUnits += line.quantity
    subtotal += line.mrp * line.quantity
  }
  return {
    itemCount: cart.length,
    totalUnits,
    subtotal: Math.round(subtotal * 100) / 100,
  }
}

export function subscribeToPosCart(callback: (items: PosCartLine[]) => void): () => void {
  if (typeof window === 'undefined') return () => {}

  const handleCustom = (e: Event) => {
    const custom = e as CustomEvent<PosCartLine[]>
    callback(custom.detail || getPosCart())
  }

  const handleStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      callback(getPosCart())
    }
  }

  window.addEventListener(EVENT_NAME, handleCustom)
  window.addEventListener('storage', handleStorage)

  return () => {
    window.removeEventListener(EVENT_NAME, handleCustom)
    window.removeEventListener('storage', handleStorage)
  }
}

// ─── React Hook ──────────────────────────────────────────────

export function usePosCart() {
  const [cart, setCartState] = useState<PosCartLine[]>([])

  useEffect(() => {
    setCartState(getPosCart())
    return subscribeToPosCart((newCart) => {
      setCartState(newCart)
    })
  }, [])

  const summary = {
    itemCount: cart.length,
    totalUnits: cart.reduce((acc, c) => acc + c.quantity, 0),
    subtotal:
      Math.round(cart.reduce((acc, c) => acc + c.mrp * c.quantity, 0) * 100) / 100,
  }

  return {
    cart,
    summary,
    addToCart: addPosCartItem,
    updateQuantity: updatePosCartItemQuantity,
    removeFromCart: removePosCartItem,
    clearCart: clearPosCart,
  }
}
