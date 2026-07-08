"use client"

import { Printer } from "lucide-react"
import { Button } from "@/components/ui/button"

export interface DrawerPrintButtonProps {
  /** Controla si el botón se renderiza. Default: true */
  show?: boolean
  onPrint: () => void
}

export function DrawerPrintButton({ show = true, onPrint }: DrawerPrintButtonProps) {
  if (!show) return null

  return (
    <Button variant="ghost" size="icon" onClick={onPrint}>
      <Printer className="h-4 w-4" />
    </Button>
  )
}
