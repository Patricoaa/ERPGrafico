import React from "react"
import { cn } from "@/lib/utils"

interface QuantityDisplayProps {
  value: number | string | null | undefined
  /** Unit of measure label, e.g. 'kg', 'un', 'm²' */
  uom?: string
  /** Decimal places (default: 4 for production quantities) */
  decimals?: number
  /** Show sign prefix (+/-) */
  showSign?: boolean
  className?: string
  inline?: boolean
}

export function QuantityDisplay({ value, uom, decimals = 4, showSign, className, inline }: QuantityDisplayProps) {
  const n = Number(value)
  if (isNaN(n) || value === null || value === undefined) return <span className={className}>—</span>
  
  const sign = showSign && n > 0 ? '+' : ''
  const formatted = new Intl.NumberFormat('es-CL', { maximumFractionDigits: decimals }).format(n)
  
  return (
    <span className={cn('font-mono tabular-nums', inline && 'inline-flex', className)}>
      {sign}{formatted}{uom ? ` ${uom}` : ''}
    </span>
  )
}
