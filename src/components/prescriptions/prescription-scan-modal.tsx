'use client'

import React, { useState, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/lib/hooks/use-toast'
import type {
  ParsedPrescriptionResult,
  PrescriptionMedicineItem,
  MatchedInventoryCandidate,
} from '@/lib/scanner/prescription-parser'

interface PrescriptionScanModalProps {
  isOpen: boolean
  onClose: () => void
  onApply: (extracted: ParsedPrescriptionResult) => void
  branchId?: string
}

export function PrescriptionScanModal({
  isOpen,
  onClose,
  onApply,
  branchId,
}: PrescriptionScanModalProps) {
  const toast = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [result, setResult] = useState<ParsedPrescriptionResult | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (selected) {
      setFile(selected)
      setPreviewUrl(URL.createObjectURL(selected))
      setResult(null)
    }
  }

  const handleScan = async () => {
    if (!file) return

    setIsProcessing(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      if (branchId) formData.append('branchId', branchId)

      const res = await fetch('/api/prescriptions/scan', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to scan prescription')
      }

      setResult(data.data as ParsedPrescriptionResult)
      toast.success(
        'Prescription Analyzed',
        `Extracted ${data.data.medicines.length} items (${data.data.highConfidenceCount} auto-matched, ${data.data.needsReviewCount} review needed)`
      )
    } catch (err) {
      toast.error(
        'Scan Failed',
        err instanceof Error ? err.message : 'Unknown OCR error'
      )
    } finally {
      setIsProcessing(false)
    }
  }

  const handleSelectAlternative = (
    medIndex: number,
    candidate: MatchedInventoryCandidate
  ) => {
    if (!result) return
    const updated = { ...result }
    const med = updated.medicines[medIndex]
    med.matchedProduct = candidate
    med.status = 'AUTO_MATCHED'
    med.confidence = candidate.similarity
    setResult(updated)
    toast.success('Medicine Confirmed', `Selected: ${candidate.productName}`)
  }

  const handleApply = () => {
    if (result) {
      onApply(result)
      onClose()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>⚡ Zero-LLM AI / OCR Prescription Scanner</span>
            <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200">
              100% On-Premise & Private
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Scans printed and handwritten prescriptions, extracts dosage patterns (e.g. 1-0-1 x 5 days), and cross-matches drugs with local inventory.
          </DialogDescription>
        </DialogHeader>

        {/* Upload & Preview */}
        {!result && (
          <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-lg p-8 my-4 hover:border-primary/50 transition-colors">
            {previewUrl ? (
              <div className="flex flex-col items-center gap-4">
                <img
                  src={previewUrl}
                  alt="Prescription preview"
                  className="max-h-64 object-contain rounded-md shadow-sm"
                />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isProcessing}
                  >
                    Choose Different Image
                  </Button>
                  <Button onClick={handleScan} disabled={isProcessing}>
                    {isProcessing ? 'Analyzing Rx (OpenCV + PaddleOCR)...' : 'Scan Prescription Now'}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 text-center">
                <div className="p-3 bg-blue-50 text-blue-600 rounded-full text-2xl">
                  📄
                </div>
                <div>
                  <p className="font-medium text-sm">Upload Prescription Photo or Scan</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Supports JPEG, PNG, WebP (Printed or Doctor Handwritten)
                  </p>
                </div>
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  variant="secondary"
                  className="mt-2"
                >
                  Select File
                </Button>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        )}

        {/* Extraction Results */}
        {result && (
          <div className="space-y-6 my-2">
            {/* Demographics Card */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-lg border text-sm">
              <div>
                <span className="text-xs text-muted-foreground block">Doctor Name</span>
                <span className="font-semibold">{result.doctor.name || 'Not detected'}</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Doctor Reg No.</span>
                <span className="font-semibold">{result.doctor.regNumber || 'Not detected'}</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Patient Name</span>
                <span className="font-semibold">{result.patient.name || 'Not detected'}</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Rx Date</span>
                <span className="font-semibold">{result.prescriptionDate}</span>
              </div>
            </div>

            {/* Medicines List */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-sm">
                  Extracted Medications & Regimens ({result.medicines.length})
                </h4>
                <div className="flex gap-2">
                  <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700">
                    {result.highConfidenceCount} Auto-Matched
                  </Badge>
                  {result.needsReviewCount > 0 && (
                    <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-300">
                      {result.needsReviewCount} Needs Pharmacist Review
                    </Badge>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                {result.medicines.map((med, idx) => (
                  <div
                    key={med.id}
                    className={`p-3.5 rounded-lg border text-sm transition-all ${
                      med.status === 'AUTO_MATCHED'
                        ? 'border-emerald-200 bg-emerald-50/30'
                        : 'border-amber-300 bg-amber-50/20 shadow-sm'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-900">
                            {med.matchedProduct ? med.matchedProduct.productName : med.candidateName}
                          </span>
                          {med.status === 'AUTO_MATCHED' ? (
                            <Badge className="bg-emerald-600 text-white text-[10px] h-5">
                              ✓ {Math.round(med.confidence * 100)}% Matched
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-amber-400 text-amber-800 bg-amber-100 text-[10px] h-5">
                              ⚠️ Cursive Handwriting
                            </Badge>
                          )}
                        </div>

                        {/* Raw OCR Line */}
                        <p className="text-xs text-muted-foreground font-mono mt-1">
                          OCR Raw: "{med.rawText}"
                        </p>

                        {/* Dosage Info */}
                        <div className="flex flex-wrap gap-2 mt-2 text-xs text-slate-700">
                          <span className="px-2 py-0.5 bg-slate-100 rounded font-medium">
                            Form: {med.dosage.formulation}
                          </span>
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-800 rounded font-medium">
                            Schedule: {med.dosage.frequency}
                          </span>
                          {med.dosage.duration && (
                            <span className="px-2 py-0.5 bg-purple-50 text-purple-800 rounded font-medium">
                              Duration: {med.dosage.duration}
                            </span>
                          )}
                          {med.dosage.timing && (
                            <span className="px-2 py-0.5 bg-orange-50 text-orange-800 rounded font-medium">
                              {med.dosage.timing}
                            </span>
                          )}
                          {med.matchedProduct && (
                            <span className="px-2 py-0.5 bg-green-50 text-green-800 rounded font-medium">
                              Stock: {med.matchedProduct.stock} (Rack: {med.matchedProduct.rack || 'A1'})
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* 1-Click Suggestion Pills for Low Confidence lines */}
                    {med.status === 'NEEDS_REVIEW' && med.alternativeCandidates.length > 0 && (
                      <div className="mt-3 pt-2.5 border-t border-amber-200">
                        <p className="text-xs font-semibold text-amber-900 mb-1.5">
                          1-Click Pharmacist Selection (Matches from Store Catalog):
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {med.alternativeCandidates.map((cand) => (
                            <button
                              key={cand.productId}
                              type="button"
                              onClick={() => handleSelectAlternative(idx, cand)}
                              className="px-2.5 py-1 text-xs bg-white border border-amber-400 hover:bg-amber-100 text-slate-800 rounded-md font-medium transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer"
                            >
                              <span>{cand.productName}</span>
                              <span className="text-[10px] text-muted-foreground">
                                (Stock: {cand.stock})
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="flex justify-between items-center mt-4">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          {result && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setResult(null)
                  setFile(null)
                  setPreviewUrl(null)
                }}
              >
                Scan Another
              </Button>
              <Button onClick={handleApply}>
                Apply to Prescription Form
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
