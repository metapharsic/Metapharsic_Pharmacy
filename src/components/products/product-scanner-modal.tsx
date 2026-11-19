'use client'

// ─────────────────────────────────────────────────────────────
// Unified Alias — ProductScannerModal -> AiStripScannerModal
// Standardizes the AI Pharma Strip & Packaging Scanner across all modules.
// ─────────────────────────────────────────────────────────────

import { AiStripScannerModal, type AiStripScannerModalProps } from '@/components/scanner/ai-strip-scanner-modal'

export type ProductScannerModalProps = AiStripScannerModalProps

export const ProductScannerModal = AiStripScannerModal
export default AiStripScannerModal
