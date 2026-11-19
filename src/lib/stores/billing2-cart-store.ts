'use client'

// ─────────────────────────────────────────────────────────────
// Store — Billing 2 Cart Sync (Replicate 2 Terminal Session)
// Isolated persistence store for Billing Replicate 2 terminal
// ─────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react'

export interface Billing2CartLine {
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
}

const STORAGE_KEY = 'pharmacare_billing2_cart'
const EVENT_NAME = 'pharmacare:billing2-cart-updated'

// ─── Non-React Core Helpers ──────────────────────────────────

export function getBilling2Cart(): Billing2CartLine[] {
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

export function setBilling2Cart(items: Billing2CartLine[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: items }))
  } catch {
    // Ignore storage quota errors
  }
}

export function clearBilling2Cart(): void {
  setBilling2Cart([])
}

export function addBilling2CartItem(item: Billing2CartLine): {
  cart: Billing2CartLine[]
  isNew: boolean
  updatedItem: Billing2CartLine
} {
  const current = getBilling2Cart()
  const existingIndex = current.findIndex(
    (c) => c.productId === item.productId && (!item.batchId || c.batchId === item.batchId)
  )

  let isNew = false
  let updatedItem: Billing2CartLine

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

  setBilling2Cart(current)
  return { cart: current, isNew, updatedItem }
}

export function updateBilling2CartItemQuantity(
  productId: string,
  quantity: number,
  batchId?: string
): Billing2CartLine[] {
  const current = getBilling2Cart()
  if (quantity <= 0) {
    return removeBilling2CartItem(productId, batchId)
  }

  const updated = current.map((c) => {
    if (c.productId === productId && (!batchId || c.batchId === batchId)) {
      const maxQty = c.availableQuantity > 0 ? c.availableQuantity : 999
      return { ...c, quantity: Math.min(quantity, maxQty) }
    }
    return c
  })

  setBilling2Cart(updated)
  return updated
}

export function removeBilling2CartItem(productId: string, batchId?: string): Billing2CartLine[] {
  const current = getBilling2Cart()
  const updated = current.filter(
    (c) => !(c.productId === productId && (!batchId || c.batchId === batchId))
  )
  setBilling2Cart(updated)
  return updated
}

export function getBilling2CartSummary(): {
  itemCount: number
  totalUnits: number
  subtotal: number
} {
  const cart = getBilling2Cart()
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

export function subscribeToBilling2Cart(callback: (items: Billing2CartLine[]) => void): () => void {
  if (typeof window === 'undefined') return () => {}

  const handleCustom = (e: Event) => {
    const custom = e as CustomEvent<Billing2CartLine[]>
    callback(custom.detail || getBilling2Cart())
  }

  const handleStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      callback(getBilling2Cart())
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

export function useBilling2Cart() {
  const [cart, setCartState] = useState<Billing2CartLine[]>([])

  useEffect(() => {
    setCartState(getBilling2Cart())
    return subscribeToBilling2Cart((newCart) => {
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
    addToCart: addBilling2CartItem,
    updateQuantity: updateBilling2CartItemQuantity,
    removeFromCart: removeBilling2CartItem,
    clearCart: clearBilling2Cart,
  }
}
