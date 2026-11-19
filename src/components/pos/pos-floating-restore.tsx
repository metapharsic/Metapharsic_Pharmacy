'use client'

import { ShoppingCart } from 'lucide-react'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { usePosCart } from '@/lib/stores/pos-cart-store'
import { formatCurrency } from '@/lib/utils/currency'

export function PosFloatingRestore() {
  const [mounted, setMounted] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const { cart, summary } = usePosCart()

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return null
  }

  // Do not show on POS pages or when cart is empty
  if (
    pathname === '/pos' ||
    pathname === '/pos/' ||
    pathname === '/pos2' ||
    pathname === '/pos2/' ||
    cart.length === 0
  ) {
    return null
  }

  return (
    <button
      onClick={() => router.push('/pos')}
      className="fixed bottom-6 right-6 z-50 flex cursor-pointer items-center gap-3 rounded-full border border-primary/30 bg-card p-2 pr-4 shadow-xl transition-all hover:scale-105 hover:shadow-2xl focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
      aria-label="Restore Point of Sale bill"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md">
        <ShoppingCart className="h-5 w-5" />
      </div>
      <div className="flex flex-col text-left">
        <span className="text-xs font-bold leading-tight">
          {summary.itemCount} {summary.itemCount === 1 ? 'medicine' : 'medicines'} in bill
        </span>
        <span className="text-[11px] font-semibold text-primary">
          {formatCurrency(summary.subtotal)}
        </span>
      </div>
      <span className="ml-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/20">
        Restore POS &uarr;
      </span>
    </button>
  )
}
