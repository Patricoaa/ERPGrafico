'use client'

import { useRef, useCallback } from 'react'
import { useReactToPrint } from 'react-to-print'

export function usePrintTransaction(documentTitle?: string) {
  const contentRef = useRef<HTMLDivElement>(null)

  const handlePrint = useReactToPrint({
    contentRef,
    documentTitle: () => documentTitle || 'Comprobante ERPGrafico',
  })

  const print = useCallback(() => {
    handlePrint()
  }, [handlePrint])

  return { contentRef, print }
}
