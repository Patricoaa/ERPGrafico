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
    'ACTIVE': 'Activo',
    'PAUSED': 'Pausado',
    'PENDING': 'Pendiente',
    'PLANNED': 'Planificada',
    'IN_PROGRESS': 'En Proceso',
    'FINISHED': 'Terminada',
    'REJECTED': 'Rechazado',
    'RECONCILED': 'Conciliado',
    'VOID': 'Anulado',
    // Production Stages (some might be used as status)
    'MATERIAL_ASSIGNMENT': 'Asignación de Materiales',
    'MATERIAL_APPROVAL': 'Aprobación de Stock',
    'PREPRESS': 'Pre-Impresión',
    'PRESS': 'Impresión',
    'POSTPRESS': 'Post-Impresión',
    'PARTIAL': 'Parcial',
    'SUBSCRIPTION_IN_PROGRESS': 'Suscripción en Proceso',
  }
  return map[status.toUpperCase()] || status
}

export function translateProductionStage(stage: string): string {
  if (!stage) return ''
  const map: Record<string, string> = {
    'MATERIAL_ASSIGNMENT': 'Asignación de Materiales',
    'MATERIAL_APPROVAL': 'Aprobación de Stock',
    'PREPRESS': 'Pre-Impresión',
    'PRESS': 'Impresión',
    'POSTPRESS': 'Post-Impresión',
    'FINISHED': 'Finalizada',
  }
  return map[stage.toUpperCase()] || stage.toLowerCase().replace(/_/g, ' ')
}

export function translateSalesChannel(channel: string): string {
  if (!channel) return ''
  const map: Record<string, string> = {
    'POS': 'Punto de Venta',
    'MANUAL': 'Manual',
    'E-COMMERCE': 'E-Commerce',
    'STORE_PICKUP': 'Retiro en Tienda',
  }
  return map[channel.toUpperCase()] || channel
}

export function translateReceivingStatus(status: string): string {
  if (!status) return ''
  const map: Record<string, string> = {
    'RECEIVED': 'Recibido',
    'PARTIAL': 'Parcial',
    'PENDING': 'Pendiente',
  }
  return map[status.toUpperCase()] || status
}

export function translateFieldName(field: string): string {
  const map: Record<string, string> = {
    'customer_name': 'Nombre Cliente',
    'supplier_name': 'Nombre Proveedor',
    'status': 'Estado',
    'price': 'Precio',
    'quantity': 'Cantidad',
    'date': 'Fecha',
    'description': 'Descripción',
    'notes': 'Notas',
    'total': 'Total',
    'payment_method': 'Método de Pago',
    'delivery_date': 'Fecha de Entrega',
    'warehouse': 'Bodega',
    'product': 'Producto',
    'uom': 'U. Medida',
    'unit_price': 'Precio Unit.',
    'subtotal': 'Subtotal',
    'tax_amount': 'IVA',
    'total_amount': 'Monto Total',
  }
  return map[field.toLowerCase()] || field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}

export function translateProductType(type: string): string {
  const map: Record<string, string> = {
    'CONSUMABLE': 'Consumible',
    'STORABLE': 'Almacenable',
    'MANUFACTURABLE': 'Fabricable',
    'SERVICE': 'Servicio',
    'SUBSCRIPTION': 'Suscripción',
  }
  return map[type.toUpperCase()] || type
}

export function translatePaymentMethod(method: string | null | undefined): string {
  if (!method) return '-';
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
  const numericAmount = Math.round(typeof amount === 'string' ? parseFloat(amount) : amount)
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(numericAmount)
}


export function formatBytes(bytes: number, decimals = 2) {
  if (!+bytes) return '0 Bytes'

  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']

  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
}
export function formatPlainDate(value: string | Date | null | undefined): string {
  if (!value) return '-'

  let dateStr = ''
  if (typeof value === 'string') {
    // Handle full ISO strings (2024-04-15T...) by taking only the date part
    // This prevents the browser from applying local timezone offsets
    dateStr = value.split('T')[0]
  } else if (value instanceof Date) {
    // For Date objects, use ISO format but strip time/tz to remain "plain"
    dateStr = value.toISOString().split('T')[0]
  }

  if (dateStr) {
    const matches = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (matches) {
      const [, year, month, day] = matches
      return `${day}/${month}/${year}`
    }
  }

  // Fallback for non-standard formats
  const date = new Date(value)
  if (isNaN(date.getTime())) return '-'
  return date.toLocaleDateString('es-CL', { year: 'numeric', month: '2-digit', day: '2-digit' })
}
