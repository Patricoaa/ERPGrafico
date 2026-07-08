"use client"

import { useRef } from "react"
import { useReactToPrint } from "react-to-print"

export function usePrintableDrawer() {
  const printRef = useRef<HTMLDivElement>(null)
  const handlePrint = useReactToPrint({ contentRef: printRef })

  return { printRef, handlePrint }
}
