'use client'

import {
  AlertCircle,
  Camera,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  UploadCloud,
  X,
} from 'lucide-react'
import React, { useCallback, useRef, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'

const MAX_FILE_SIZE = 15 * 1024 * 1024 // 15MB standard pharmaceutical document limit

const ALLOWED_EXTENSIONS = new Set([
  'pdf',
  'png',
  'jpg',
  'jpeg',
  'webp',
  'tiff',
  'tif',
  'bmp',
  'heic',
  'xlsx',
  'xls',
  'csv',
  'tsv',
  'json',
  'txt',
])

function isAllowedFileFormat(file: File): boolean {
  const ext = file.name.split('.').pop()?.toLowerCase() || ''
  if (ALLOWED_EXTENSIONS.has(ext)) return true

  const mime = file.type.toLowerCase()
  if (
    mime.startsWith('image/') ||
    mime === 'application/pdf' ||
    mime.includes('spreadsheet') ||
    mime.includes('excel') ||
    mime.includes('csv') ||
    mime.includes('json') ||
    mime.includes('text')
  ) {
    return true
  }

  return false
}

export interface DocumentUploadZoneProps {
  onFileSelected: (file: File) => void
  selectedFile?: File | null
  onClearFile?: () => void
  disabled?: boolean
  className?: string
}

export function DocumentUploadZone({
  onFileSelected,
  selectedFile,
  onClearFile,
  disabled = false,
  className,
}: DocumentUploadZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  const validateAndHandleFile = useCallback(
    (file: File) => {
      setErrorMessage(null)

      if (file.size > MAX_FILE_SIZE) {
        const sizeMb = (file.size / (1024 * 1024)).toFixed(2)
        setErrorMessage(`File is too large (${sizeMb} MB). Maximum allowed size is 15 MB.`)
        return
      }

      if (!isAllowedFileFormat(file)) {
        setErrorMessage(
          `Invalid file format "${file.type || file.name.split('.').pop()}". Supported formats: PDF, Excel (.xlsx, .xls), CSV, TSV, JSON, Images (PNG, JPEG, WebP, TIFF).`
        )
        return
      }

      onFileSelected(file)
    },
    [onFileSelected]
  )

  const handleDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()
      if (disabled) return
      setIsDragOver(true)
    },
    [disabled]
  )

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragOver(false)
      if (disabled) return

      const droppedFiles = e.dataTransfer.files
      if (droppedFiles && droppedFiles.length > 0) {
        validateAndHandleFile(droppedFiles[0])
      }
    },
    [disabled, validateAndHandleFile]
  )

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files
      if (files && files.length > 0) {
        validateAndHandleFile(files[0])
      }
      // Reset input value so re-selecting same file triggers change
      e.target.value = ''
    },
    [validateAndHandleFile]
  )

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }

  return (
    <div className={cn('space-y-3', className)}>
      {/* Hidden file inputs with full universal format support */}
      <input
        ref={fileInputRef}
        type="file"
        data-testid="bill-file-input"
        accept=".pdf,.png,.jpg,.jpeg,.webp,.tiff,.bmp,.xlsx,.xls,.csv,.tsv,.json,.txt,application/pdf,image/*,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv,text/plain,application/json"
        onChange={handleFileChange}
        disabled={disabled}
        className="hidden"
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        disabled={disabled}
        className="hidden"
      />

      {/* Main Dropzone Card */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition-all duration-200',
          isDragOver
            ? 'border-primary bg-primary/5 shadow-md scale-[1.005]'
            : 'border-border/80 hover:border-primary/50 hover:bg-muted/30 bg-card/40',
          disabled && 'opacity-60 cursor-not-allowed hover:border-border/80 hover:bg-transparent',
          errorMessage && 'border-destructive/60 bg-destructive/5'
        )}
      >
        {selectedFile ? (
          // Active Loaded Document Pill State
          <div className="flex w-full max-w-md items-center justify-between rounded-lg border border-border bg-background p-3 shadow-xs">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                {selectedFile.type.includes('spreadsheet') || selectedFile.name.endsWith('.xlsx') || selectedFile.name.endsWith('.csv') ? (
                  <FileSpreadsheet className="h-5 w-5" />
                ) : selectedFile.type.includes('image') ? (
                  <ImageIcon className="h-5 w-5" />
                ) : (
                  <FileText className="h-5 w-5" />
                )}
              </div>
              <div className="min-w-0 text-left">
                <p className="text-xs font-semibold text-foreground truncate max-w-[240px]">
                  {selectedFile.name}
                </p>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                  <span>{formatFileSize(selectedFile.size)}</span>
                  <span>•</span>
                  <Badge variant="secondary" className="text-[9px] px-1.5 py-0 font-mono uppercase">
                    {selectedFile.name.split('.').pop() || 'FILE'}
                  </Badge>
                  <span>•</span>
                  <span className="text-emerald-600 font-medium">Ready for OCR parsing</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled}
                className="h-7 text-xs px-2"
              >
                Change
              </Button>
              {onClearFile && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={onClearFile}
                  disabled={disabled}
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  aria-label="Remove file"
                  title="Remove file"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        ) : (
          // Idle Upload Invitation State
          <div className="space-y-3 max-w-lg">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary shadow-inner">
              <UploadCloud className="h-6 w-6" />
            </div>

            <div className="space-y-1">
              <h3 className="text-sm font-semibold tracking-tight text-foreground">
                Drag &amp; drop purchase bill document (Universal Any-Format Ingestion)
              </h3>
              <p className="text-xs text-muted-foreground">
                Universal parser accepts <strong className="text-foreground">PDF</strong> (digital text &amp; scanned images),{' '}
                <strong className="text-foreground">Excel (.xlsx, .xls)</strong>,{' '}
                <strong className="text-foreground">CSV, TSV, JSON, TXT</strong>, and{' '}
                <strong className="text-foreground">Images (PNG, JPEG, WebP, TIFF)</strong> up to 25MB
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled}
                className="gap-1.5 text-xs font-semibold shadow-xs"
              >
                <FileText className="h-3.5 w-3.5" />
                Browse Files
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => cameraInputRef.current?.click()}
                disabled={disabled}
                className="gap-1.5 text-xs shadow-xs"
              >
                <Camera className="h-3.5 w-3.5 text-muted-foreground" />
                Capture Photo
              </Button>
            </div>
          </div>
        )}

        {/* Client Error Notice */}
        {errorMessage && (
          <div className="mt-3 flex items-center gap-2 text-xs text-destructive bg-destructive/10 px-3 py-1.5 rounded-md border border-destructive/20 animate-in fade-in-50">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}
      </div>
    </div>
  )
}
