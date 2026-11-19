'use client'

import React, { createContext, useContext, useState, useCallback } from 'react'
import { DatabaseBackupDialog } from './database-backup-dialog'

interface DatabaseBackupContextType {
  openBackup: () => void
  closeBackup: () => void
  isOpen: boolean
}

const DatabaseBackupContext = createContext<DatabaseBackupContextType>({
  openBackup: () => {},
  closeBackup: () => {},
  isOpen: false,
})

export function useDatabaseBackup() {
  return useContext(DatabaseBackupContext)
}

export function DatabaseBackupProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)

  const openBackup = useCallback(() => setIsOpen(true), [])
  const closeBackup = useCallback(() => setIsOpen(false), [])

  return (
    <DatabaseBackupContext.Provider value={{ openBackup, closeBackup, isOpen }}>
      {children}
      <DatabaseBackupDialog open={isOpen} onOpenChange={setIsOpen} />
    </DatabaseBackupContext.Provider>
  )
}
