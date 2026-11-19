'use client'

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { KeyboardShortcutsDialog } from './keyboard-shortcuts-dialog'
import { useDatabaseBackup } from './database-backup-provider'

interface KeyboardShortcutsContextType {
  openShortcuts: () => void
  closeShortcuts: () => void
  isOpen: boolean
}

const KeyboardShortcutsContext = createContext<KeyboardShortcutsContextType>({
  openShortcuts: () => {},
  closeShortcuts: () => {},
  isOpen: false,
})

export function useShortcuts() {
  return useContext(KeyboardShortcutsContext)
}

export function KeyboardShortcutsProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const router = useRouter()
  const pathname = usePathname()
  const { openBackup } = useDatabaseBackup()

  const openShortcuts = useCallback(() => setIsOpen(true), [])
  const closeShortcuts = useCallback(() => setIsOpen(false), [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement
      const isInput =
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        (activeElement as HTMLElement)?.isContentEditable

      // Global Shortcut: Ctrl+Shift+B for Database Backup
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'b') {
        e.preventDefault()
        openBackup()
        return
      }

      // Global Function Keys (F1..F8): Always execute, even inside input focus!
      if (e.key === 'F1') {
        e.preventDefault()
        setIsOpen((prev) => !prev)
        return
      }

      if (e.key === 'F2') {
        e.preventDefault()
        router.push('/pos')
        return
      }

      if (e.key === 'F3') {
        e.preventDefault()
        router.push('/products')
        return
      }

      if (e.key === 'F4') {
        e.preventDefault()
        router.push('/expiry')
        return
      }

      if (e.key === 'F6') {
        e.preventDefault()
        router.push('/purchases/scan')
        return
      }

      if (e.key === 'F7') {
        e.preventDefault()
        router.push('/inventory')
        return
      }

      if (e.key === 'F8') {
        e.preventDefault()
        router.push('/customers')
        return
      }

      // Alt key combinations (only if not editing multi-line text)
      if (e.altKey && !e.ctrlKey && !e.shiftKey) {
        const key = e.key.toLowerCase()

        if (key === 'p') {
          e.preventDefault()
          router.push('/purchases/new')
          return
        }

        if (key === 's') {
          e.preventDefault()
          router.push('/sales')
          return
        }

        if (key === 'r') {
          e.preventDefault()
          router.push('/returns/sales')
          return
        }

        if (key === 'h') {
          e.preventDefault()
          router.push('/')
          return
        }
      }

      // '?' with Shift (or Ctrl+/) when outside text inputs
      if (!isInput && (e.key === '?' || (e.ctrlKey && e.key === '/'))) {
        e.preventDefault()
        setIsOpen(true)
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [router, openBackup])

  return (
    <KeyboardShortcutsContext.Provider value={{ openShortcuts, closeShortcuts, isOpen }}>
      {children}
      <KeyboardShortcutsDialog open={isOpen} onOpenChange={setIsOpen} />
    </KeyboardShortcutsContext.Provider>
  )
}
