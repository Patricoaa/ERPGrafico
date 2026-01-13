import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function translateStatus(status: string | null | undefined): string {
  if (!status) return ''
  const map: Record<string, string> = {
    'DRAFT': 'Borrador',
    'CONFIRMED': 'Confirmado',
    'INVOICED': 'Facturado',
    'PAID': 'Pagado',
    'CANCELLED': 'Anulado',
    'RECEIVED': 'Recibido',
    'PARTIAL_RECEIVED': 'Recibido Parcial',
    'OPEN': 'Abierto',
    'POSTED': 'Publicado',
    'CANCEL': 'Cancelado',
  }
  return map[status.toUpperCase()] || status
}

export function translateProductType(type: string): string {
  const map: Record<string, string> = {
    'CONSUMABLE': 'Consumible',
    'STORABLE': 'Almacenable',
    'MANUFACTURABLE': 'Fabricable',
    'SERVICE': 'Servicio',
  }
  return map[type.toUpperCase()] || type
}

export function translatePaymentMethod(method: string): string {
  const map: Record<string, string> = {
    'CASH': 'Efectivo',
    'CARD': 'Tarjeta',
    'TRANSFER': 'Transferencia',
    'CREDIT': 'Crédito',
  }
  return map[method.toUpperCase()] || method
}

export function formatCurrency(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined) return '$0'
  const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(numericAmount)
}

