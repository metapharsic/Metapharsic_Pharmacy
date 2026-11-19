'use client'

// ─────────────────────────────────────────────────────────────
// Store — POS 2 Cart Sync (Isolated Feature Lab Terminal Session)
// Allows products scanned or added in POS 2 to persist across
// tabs & navigation without interfering with primary POS cart.
// ─────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react'

export interface Pos2CartLine {
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
  tabsPerStrip?: number | null
  unit?: string
  isTabletSale?: boolean
  originalMrp?: number
}

const STORAGE_KEY = 'pharmacare_pos2_cart'
const EVENT_NAME = 'pharmacare:pos2-cart-updated'

// ─── Non-React Core Helpers ──────────────────────────────────

export function getPos2Cart(): Pos2CartLine[] {
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

export function setPos2Cart(items: Pos2CartLine[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: items }))
  } catch {
    // Ignore storage quota errors
  }
}

export function clearPos2Cart(): void {
  setPos2Cart([])
}

export function addPos2CartItem(item: Pos2CartLine): {
  cart: Pos2CartLine[]
  isNew: boolean
  updatedItem: Pos2CartLine
} {
  const current = getPos2Cart()
  const existingIndex = current.findIndex(
    (c) => c.productId === item.productId && (!item.batchId || c.batchId === item.batchId)
  )

  let isNew = false
  let updatedItem: Pos2CartLine

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

  setPos2Cart(current)
  return { cart: current, isNew, updatedItem }
}

export function updatePos2CartItemQuantity(
  productId: string,
  quantity: number,
  batchId?: string
): Pos2CartLine[] {
  const current = getPos2Cart()
  if (quantity <= 0) {
    return removePos2CartItem(productId, batchId)
  }
  const updated = current.map((c) => {
    if (c.productId === productId && (!batchId || c.batchId === batchId)) {
      const maxQty = c.availableQuantity > 0 ? c.availableQuantity : 999
      return { ...c, quantity: Math.min(quantity, maxQty) }
    }
    return c
  })
  setPos2Cart(updated)
  return updated
}

export function removePos2CartItem(productId: string, batchId?: string): Pos2CartLine[] {
  const current = getPos2Cart()
  const updated = current.filter(
    (c) => !(c.productId === productId && (!batchId || c.batchId === batchId))
  )
  setPos2Cart(updated)
  return updated
}

export function getPos2CartSummary(): {
  itemCount: number
  totalQuantity: number
  totalAmount: number
} {
  const cart = getPos2Cart()
  return {
    itemCount: cart.length,
    totalQuantity: cart.reduce((acc, c) => acc + c.quantity, 0),
    totalAmount: cart.reduce((acc, c) => {
      const lineGross = c.mrp * c.quantity
      const discount = (lineGross * (c.discountPercent || 0)) / 100
      return acc + (lineGross - discount)
    }, 0),
  }
}

export function subscribeToPos2Cart(callback: (items: Pos2CartLine[]) => void): () => void {
  if (typeof window === 'undefined') return () => {}

  const handleCustomEvent = (e: Event) => {
    const custom = e as CustomEvent<Pos2CartLine[]>
    callback(custom.detail || getPos2Cart())
  }

  const handleStorageEvent = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      callback(getPos2Cart())
    }
  }

  window.addEventListener(EVENT_NAME, handleCustomEvent)
  window.addEventListener('storage', handleStorageEvent)

  return () => {
    window.removeEventListener(EVENT_NAME, handleCustomEvent)
    window.removeEventListener('storage', handleStorageEvent)
  }
}

// ─── React Hook ──────────────────────────────────────────────

export function usePos2Cart() {
  const [cart, setCartState] = useState<Pos2CartLine[]>([])

  useEffect(() => {
    setCartState(getPos2Cart())
    return subscribeToPos2Cart((newCart) => {
      setCartState(newCart)
    })
  }, [])

  return {
    cart,
    itemCount: cart.length,
    totalQuantity: cart.reduce((acc, c) => acc + c.quantity, 0),
    totalAmount: cart.reduce((acc, c) => {
      const lineGross = c.mrp * c.quantity
      const discount = (lineGross * (c.discountPercent || 0)) / 100
      return acc + (lineGross - discount)
    }, 0),
    addToCart: addPos2CartItem,
    updateQuantity: updatePos2CartItemQuantity,
    removeFromCart: removePos2CartItem,
    clearCart: clearPos2Cart,
    setCart: setPos2Cart,
  }
}
