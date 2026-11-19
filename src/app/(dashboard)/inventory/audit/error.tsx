'use client'

import React, { useEffect, useState } from 'react'
import { AlertCircle, RefreshCw, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export const CHUNK_RELOAD_STORAGE_KEY = 'chunk_reload_ts'
export const CHUNK_RELOAD_DEBOUNCE_MS = 10000 // 10 seconds

/**
 * Determines whether an error is caused by a webpack chunk loading failure
 * (typically caused by client requesting stale asset hashes after a new deployment).
 */
export function isChunkLoadError(error: unknown): boolean {
  if (!error) return false

  const err = error as { name?: string; message?: string }
  const name = typeof err.name === 'string' ? err.name : ''
  const message = typeof err.message === 'string' ? err.message : ''

  return (
    name === 'ChunkLoadError' ||
    /loading chunk|chunkloaderror/i.test(message) ||
    /loading chunk|chunkloaderror/i.test(name) ||
    /loading css chunk/i.test(message)
  )
}

function getSessionStorageItem(key: string): string | null {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      return window.sessionStorage.getItem(key)
    }
  } catch {
    // Ignore storage access errors (e.g. private mode / sandboxed iframes)
  }
  return null
}

function setSessionStorageItem(key: string, value: string): void {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.setItem(key, value)
    }
  } catch {
    // Ignore storage access errors
  }
}

interface InventoryAuditErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function InventoryAuditError({ error, reset }: InventoryAuditErrorProps) {
  const isChunk = isChunkLoadError(error)
  const [debounced, setDebounced] = useState(false)

  useEffect(() => {
    // Log the error for diagnostic tracking
    console.error('Inventory Audit route error:', error)

    if (isChunk) {
      const now = Date.now()
      const lastReloadStr = getSessionStorageItem(CHUNK_RELOAD_STORAGE_KEY)
      const lastReload = lastReloadStr ? parseInt(lastReloadStr, 10) : 0

      // Only auto-reload if outside the debounce cooldown (10 seconds)
      if (!lastReload || Number.isNaN(lastReload) || now - lastReload > CHUNK_RELOAD_DEBOUNCE_MS) {
        setSessionStorageItem(CHUNK_RELOAD_STORAGE_KEY, now.toString())
        if (typeof window !== 'undefined' && window.location) {
          try {
            window.location.reload()
          } catch {
            // Environment without full navigation implementation (e.g. unit tests)
          }
        }
      } else {
        // Within debounce window: avoid infinite reload loop
        setDebounced(true)
      }
    }
  }, [error, isChunk])

  const handleReload = () => {
    if (typeof window !== 'undefined' && window.location) {
      try {
        window.location.reload()
      } catch {
        // Fallback for non-standard navigation environments
      }
    }
  }

  return (
    <div className="flex min-h-[450px] w-full flex-col items-center justify-center p-4">
      <Card className="w-full max-w-lg border-border/80 shadow-md">
        <CardHeader className="flex flex-col items-center space-y-2 text-center">
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-full ${
              isChunk
                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                : 'bg-destructive/10 text-destructive'
            }`}
          >
            {isChunk ? (
              <RefreshCw className="h-6 w-6 animate-spin text-amber-600 dark:text-amber-400" />
            ) : (
              <AlertCircle className="h-6 w-6 text-destructive" />
            )}
          </div>
          <CardTitle className="text-xl font-bold tracking-tight">
            {isChunk ? 'Application Update Detected' : 'Something went wrong'}
          </CardTitle>
          <CardDescription className="text-sm">
            {isChunk
              ? 'A newer version of the application was deployed. Please reload the page to load updated assets and ensure data integrity.'
              : error?.message ||
                'An unexpected error occurred while loading inventory audit data.'}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-3 text-center">
          {isChunk ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-200">
              <span className="font-semibold">Deployment update notification:</span>{' '}
              {debounced
                ? 'Automatic reload was paused to prevent an infinite loop. Click "Reload Page" to force reload the latest bundle.'
                : 'A new deployment is available. Updating application bundle to match the server...'}
            </div>
          ) : (
            error?.digest && (
              <p className="rounded bg-muted p-2 font-mono text-xs text-muted-foreground">
                Digest: {error.digest}
              </p>
            )
          )}
        </CardContent>

        <CardFooter className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Button
            onClick={handleReload}
            variant={isChunk ? 'default' : 'outline'}
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Reload Page
          </Button>
          <Button
            onClick={reset}
            variant={isChunk ? 'outline' : 'default'}
            className="flex items-center gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            Try Again
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
