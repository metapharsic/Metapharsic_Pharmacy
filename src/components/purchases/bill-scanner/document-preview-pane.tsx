'use client'

import {
  ChevronLeft,
  ChevronRight,
  Columns,
  Contrast,
  Download,
  ExternalLink,
  Eye,
  Maximize2,
  Minimize2,
  Move,
  RotateCw,
  SlidersHorizontal,
  Sparkles,
  SunMedium,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import React, { useCallback, useEffect, useRef, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils/cn'

export interface DocumentPreviewPaneProps {
  fileUrl?: string | null
  fileName?: string
  mimeType?: string
  pageCount?: number
  className?: string
}

export type ViewPreset = 'fit-width' | 'fit-page' | 'actual-size'
export type ClarityMode =
  | 'normal'
  | 'high-contrast'
  | 'clean-scan'
  | 'dot-matrix'
  | 'inverted'

export function DocumentPreviewPane({
  fileUrl,
  fileName = 'Purchase Bill Document',
  mimeType = 'application/pdf',
  pageCount = 1,
  className,
}: DocumentPreviewPaneProps) {
  // Zoom & Spatial Transform State (50% to 500%)
  const [zoomLevel, setZoomLevel] = useState<number>(100)
  const [rotation, setRotation] = useState<number>(0) // 0, 90, 180, 270
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [viewPreset, setViewPreset] = useState<ViewPreset>('fit-width')
  const [isPanning, setIsPanning] = useState<boolean>(false)
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const containerRef = useRef<HTMLDivElement>(null)

  // Document Clarity & High-DPI Enhancement State
  const [clarityMode, setClarityMode] = useState<ClarityMode>('high-contrast')
  const [unsharpSharpen, setUnsharpSharpen] = useState<boolean>(true)
  const [naturalDimensions, setNaturalDimensions] = useState<{
    width: number
    height: number
  } | null>(null)
  const [isFullscreenModalOpen, setIsFullscreenModalOpen] = useState<boolean>(false)

  const isPdf =
    (mimeType?.toLowerCase().includes('pdf') ?? false) ||
    (fileName?.toLowerCase().endsWith('.pdf') ?? false)

  // Zoom Steps
  const handleZoomIn = () => {
    setZoomLevel((prev) => Math.min(500, prev + 25))
  }

  const handleZoomOut = () => {
    setZoomLevel((prev) => Math.max(50, prev - 25))
  }

  const handleResetView = () => {
    setZoomLevel(100)
    setRotation(0)
    setPanOffset({ x: 0, y: 0 })
    setViewPreset('fit-width')
  }

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360)
  }

  // Preset switchers
  const handleSetPreset = (preset: ViewPreset) => {
    setViewPreset(preset)
    setPanOffset({ x: 0, y: 0 })
    if (preset === 'actual-size') {
      setZoomLevel(100)
    } else if (preset === 'fit-width') {
      setZoomLevel(100)
    } else if (preset === 'fit-page') {
      setZoomLevel(100)
    }
  }

  // Interactive Pan for High-DPI Images
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (viewPreset === 'fit-page' && zoomLevel <= 100 && rotation === 0) return
    setIsPanning(true)
    dragStartRef.current = {
      x: e.clientX - panOffset.x,
      y: e.clientY - panOffset.y,
    }
  }

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!isPanning) return
      setPanOffset({
        x: e.clientX - dragStartRef.current.x,
        y: e.clientY - dragStartRef.current.y,
      })
    },
    [isPanning]
  )

  const handleMouseUp = () => {
    setIsPanning(false)
  }

  // Reset page and dimensions when a new file is uploaded
  useEffect(() => {
    setCurrentPage(1)
    setNaturalDimensions(null)
    setPanOffset({ x: 0, y: 0 })
    setZoomLevel(100)
    setViewPreset('fit-width')
  }, [fileUrl, pageCount])

  // Compute CSS filter string for crisp readability
  const getFilterStyle = (): string => {
    let base = ''
    switch (clarityMode) {
      case 'high-contrast':
        base = 'contrast(135%) brightness(103%) saturate(110%)'
        break
      case 'clean-scan':
        // Strips yellow/grey paper background and turns faint ink deep black
        base = 'grayscale(100%) contrast(165%) brightness(105%)'
        break
      case 'dot-matrix':
        // Pulls out faint ribbon dots from impact printers
        base = 'contrast(220%) brightness(95%)'
        break
      case 'inverted':
        base = 'invert(100%) hue-rotate(180deg)'
        break
      case 'normal':
      default:
        base = 'none'
        break
    }

    if (unsharpSharpen && base !== 'none') {
      return `${base} drop-shadow(0 0 0.5px rgba(0,0,0,0.6))`
    } else if (unsharpSharpen && base === 'none') {
      return 'drop-shadow(0 0 0.5px rgba(0,0,0,0.6)) contrast(110%)'
    }
    return base
  }

  // Image layout width computation to avoid GPU-stretch blur
  const getImageInlineStyle = (isModal: boolean = false): React.CSSProperties => {
    const filter = getFilterStyle()
    const transform = `rotate(${rotation}deg) translate(${panOffset.x}px, ${panOffset.y}px)`

    if (viewPreset === 'actual-size' && naturalDimensions?.width) {
      // 1:1 Native Resolution Pixel-for-Pixel
      const scale = zoomLevel / 100
      return {
        width: `${Math.round(naturalDimensions.width * scale)}px`,
        maxWidth: 'none',
        height: 'auto',
        transform,
        transformOrigin: 'top center',
        filter,
        imageRendering: '-webkit-optimize-contrast',
      }
    }

    if (viewPreset === 'fit-page' && !isModal) {
      return {
        maxWidth: '100%',
        maxHeight: '560px',
        width: `${zoomLevel}%`,
        objectFit: 'contain',
        transform,
        transformOrigin: 'center center',
        filter,
        imageRendering: '-webkit-optimize-contrast',
      }
    }

    // Default: 'fit-width' with continuous vertical scrolling
    // Scales layout width directly so browser samples high-res original pixels
    const widthPercentage = Math.max(100, zoomLevel)
    return {
      width: `${widthPercentage}%`,
      maxWidth: 'none',
      height: 'auto',
      transform,
      transformOrigin: 'top center',
      filter,
      imageRendering: '-webkit-optimize-contrast',
    }
  }

  // Shared Toolbar Controls Component
  const renderControls = (isModal: boolean = false) => (
    <div className="flex flex-wrap items-center gap-1">
      {/* Multi-Page PDF Navigator */}
      {isPdf && pageCount > 1 && (
        <div className="flex items-center gap-1 mr-1 border-r border-border pr-1.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <span className="text-[11px] font-mono text-muted-foreground whitespace-nowrap">
            {currentPage} / {pageCount}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            disabled={currentPage >= pageCount}
            onClick={() => setCurrentPage((p) => Math.min(pageCount, p + 1))}
            aria-label="Next page"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* View Presets Group (Fit Width, Fit Page, 1:1 Actual) */}
      {!isPdf && (
        <div className="flex items-center gap-0.5 bg-muted/60 p-0.5 rounded-md border border-border/50 mr-1">
          <Button
            type="button"
            variant={viewPreset === 'fit-width' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-6 px-1.5 text-[10px] font-medium"
            onClick={() => handleSetPreset('fit-width')}
            title="Fit to Width (Continuous Scroll - Best for reading bills)"
          >
            <Columns className="h-3 w-3 mr-1 text-primary" />
            Fit Width
          </Button>
          <Button
            type="button"
            variant={viewPreset === 'fit-page' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-6 px-1.5 text-[10px] font-medium"
            onClick={() => handleSetPreset('fit-page')}
            title="Fit Entire Page"
          >
            <Minimize2 className="h-3 w-3 mr-1" />
            Fit Page
          </Button>
          <Button
            type="button"
            variant={viewPreset === 'actual-size' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-6 px-1.5 text-[10px] font-medium"
            onClick={() => handleSetPreset('actual-size')}
            title="1:1 Native Resolution (Pixel-for-Pixel inspection)"
          >
            <Eye className="h-3 w-3 mr-1 text-emerald-500" />
            1:1 Actual
          </Button>
        </div>
      )}

      {/* Clarity / Contrast Modes Dropdown */}
      {!isPdf && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 px-2 text-[11px] gap-1 bg-background/80"
              title="Image Clarity & Text Enhancement Filters"
            >
              <Contrast className="h-3.5 w-3.5 text-primary" />
              <span className="hidden sm:inline">
                {clarityMode === 'high-contrast'
                  ? 'High Contrast'
                  : clarityMode === 'clean-scan'
                    ? 'B&W Scan'
                    : clarityMode === 'dot-matrix'
                      ? 'Dot Matrix'
                      : clarityMode === 'inverted'
                        ? 'Inverted'
                        : 'Normal'}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52 text-xs">
            <DropdownMenuLabel className="text-[11px] font-semibold text-muted-foreground">
              Clarity & Anti-Blur Filters
            </DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={clarityMode}
              onValueChange={(v) => setClarityMode(v as ClarityMode)}
            >
              <DropdownMenuRadioItem value="high-contrast" className="text-xs">
                <SunMedium className="h-3.5 w-3.5 mr-2 text-amber-500" />
                High Contrast (Crisp Text)
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="clean-scan" className="text-xs">
                <Sparkles className="h-3.5 w-3.5 mr-2 text-blue-500" />
                B&W Scan (Zero Paper Noise)
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="dot-matrix" className="text-xs">
                <SlidersHorizontal className="h-3.5 w-3.5 mr-2 text-violet-500" />
                Dot-Matrix Ribbon Boost
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="normal" className="text-xs">
                <Columns className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                Normal (Original Photo)
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="inverted" className="text-xs">
                <Eye className="h-3.5 w-3.5 mr-2 text-zinc-400" />
                Invert Colors (Dark Room)
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => setUnsharpSharpen((prev) => !prev)}
              className="text-xs justify-between"
            >
              <span className="flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-emerald-500" />
                Text Edge Sharpening
              </span>
              <Badge variant={unsharpSharpen ? 'default' : 'outline'} className="text-[9px] py-0 px-1">
                {unsharpSharpen ? 'ON' : 'OFF'}
              </Badge>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* Zoom Controls */}
      <div className="flex items-center gap-0.5 bg-muted/40 rounded-md p-0.5 border border-border/50">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          disabled={zoomLevel <= 50}
          onClick={handleZoomOut}
          aria-label="Zoom out"
          title="Zoom Out"
        >
          <ZoomOut className="h-3.5 w-3.5" />
        </Button>
        <span className="text-[11px] font-mono font-medium text-foreground w-11 text-center select-none">
          {zoomLevel}%
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          disabled={zoomLevel >= 500}
          onClick={handleZoomIn}
          aria-label="Zoom in"
          title="Zoom In"
        >
          <ZoomIn className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Rotate 90° Clockwise */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={handleRotate}
        aria-label="Rotate 90 degrees clockwise"
        title="Rotate 90° Clockwise"
      >
        <RotateCw className="h-3.5 w-3.5" />
      </Button>

      {/* Reset View */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={handleResetView}
        title="Reset zoom and rotation"
        aria-label="Reset zoom and rotation"
      >
        <Maximize2 className="h-3.5 w-3.5" />
      </Button>

      {/* Fullscreen Modal View (only in sidepane) */}
      {!isModal && (
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-7 w-7 border-primary/30 text-primary hover:bg-primary/10 ml-0.5"
          onClick={() => setIsFullscreenModalOpen(true)}
          title="Open Fullscreen Inspection Modal (Ultra High-DPI)"
          aria-label="Inspect document fullscreen"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  )

  // Document Content Canvas
  const renderDocumentContent = (isModal: boolean = false) => {
    if (!fileUrl) {
      return (
        <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground m-auto">
          <Move className="h-10 w-10 stroke-1 mb-2 text-muted-foreground/60" />
          <p className="text-sm font-medium">No document loaded</p>
          <p className="text-xs text-muted-foreground/80 mt-0.5">
            Upload a bill to preview and inspect details side-by-side
          </p>
        </div>
      )
    }

    if (isPdf) {
      return (
        <div className="w-full h-full flex flex-col bg-white">
          <iframe
            src={`${fileUrl}#page=${currentPage}&zoom=${zoomLevel}&view=${viewPreset === 'fit-width' ? 'FitH' : 'Fit'}`}
            title="Purchase Bill PDF Preview"
            className="w-full h-full min-h-[580px] border-none bg-white rounded"
          />
        </div>
      )
    }

    // High-Resolution Image Canvas
    const isDraggable =
      viewPreset === 'actual-size' ||
      viewPreset === 'fit-width' ||
      zoomLevel > 100 ||
      rotation !== 0

    return (
      <div
        className={cn(
          'w-full h-full overflow-auto flex flex-col',
          viewPreset === 'fit-page' && zoomLevel <= 100
            ? 'items-center justify-center p-2'
            : 'items-center justify-start p-3'
        )}
      >
        <div
          className={cn(
            'transition-transform duration-75 ease-out relative inline-block select-none',
            isDraggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
          )}
          style={{
            transformOrigin: 'top center',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={fileUrl}
            alt={fileName}
            style={getImageInlineStyle(isModal)}
            onLoad={(e) => {
              setNaturalDimensions({
                width: e.currentTarget.naturalWidth,
                height: e.currentTarget.naturalHeight,
              })
            }}
            className={cn(
              'rounded-md shadow-lg border border-border/80 bg-white block transition-all',
              viewPreset === 'fit-width' && 'w-full max-w-none',
              viewPreset === 'actual-size' && 'max-w-none'
            )}
            draggable={false}
          />
        </div>
      </div>
    )
  }

  return (
    <>
      <Card
        className={cn(
          'flex flex-col h-full border border-border shadow-sm overflow-hidden bg-card',
          className
        )}
      >
        {/* Toolbar Header */}
        <CardHeader className="py-2 px-3 border-b border-border bg-muted/40 space-y-0 shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-1.5">
            {/* Document Title & Specs */}
            <div className="flex items-center gap-1.5 min-w-0">
              <CardTitle className="text-xs font-semibold text-foreground truncate max-w-[160px] sm:max-w-[200px]">
                {fileName}
              </CardTitle>
              <Badge variant="outline" className="text-[9px] uppercase font-mono px-1.5 py-0">
                {isPdf ? 'PDF VECTOR' : 'HIGH-DPI IMAGE'}
              </Badge>
              {naturalDimensions && (
                <span className="hidden xl:inline text-[10px] font-mono text-muted-foreground">
                  {naturalDimensions.width}×{naturalDimensions.height}px
                </span>
              )}
            </div>

            {/* Controls Cluster */}
            {renderControls(false)}
          </div>
        </CardHeader>

        {/* Main Viewport Container */}
        <CardContent
          ref={containerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className="relative flex-1 p-0 overflow-auto bg-muted/20 flex flex-col min-h-[420px]"
        >
          {renderDocumentContent(false)}
        </CardContent>
      </Card>

      {/* Fullscreen High-Resolution Inspection Dialog */}
      <Dialog
        open={isFullscreenModalOpen}
        onOpenChange={setIsFullscreenModalOpen}
      >
        <DialogContent className="max-w-[96vw] w-[96vw] h-[92vh] max-h-[92vh] p-0 flex flex-col bg-background border border-border shadow-2xl">
          <DialogHeader className="py-2.5 px-4 border-b border-border bg-muted/40 shrink-0 space-y-0">
            <div className="flex flex-wrap items-center justify-between gap-2 pr-6">
              <div className="flex items-center gap-2">
                <DialogTitle className="text-sm font-semibold truncate max-w-[280px]">
                  {fileName}
                </DialogTitle>
                <Badge variant="outline" className="text-[10px] font-mono uppercase">
                  {isPdf ? 'PDF (Ultra-Crisp Vector)' : 'High-DPI Scan Inspection'}
                </Badge>
                {naturalDimensions && (
                  <span className="text-[11px] font-mono text-muted-foreground">
                    Native: {naturalDimensions.width} × {naturalDimensions.height} px
                  </span>
                )}
                <DialogDescription className="sr-only">
                  Inspect pharmaceutical bill at full native resolution with anti-blur filters
                </DialogDescription>
              </div>

              {/* Fullscreen Modal Toolbar Controls */}
              {renderControls(true)}
            </div>
          </DialogHeader>

          {/* Large Inspection Viewport */}
          <div
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            className="flex-1 p-0 overflow-auto bg-muted/30 flex flex-col relative"
          >
            {renderDocumentContent(true)}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
