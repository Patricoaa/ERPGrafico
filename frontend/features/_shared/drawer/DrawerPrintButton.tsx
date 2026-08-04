"use client"

import { DataCell } from "@/components/shared"

export interface DrawerPrintButtonProps {
  /** Controla si el botón se renderiza. Default: true */
  show?: boolean
  onPrint: () => void
}

export function DrawerPrintButton({ show = true, onPrint }: DrawerPrintButtonProps) {
  if (!show) return null

  return (
    <DataCell.Action action="print" onClick={onPrint} />
  )
}
