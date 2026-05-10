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
    'RECTIFICATION': 'Rectificación',
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
    'RECTIFICATION': 'Rectificación',
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
  if (!field) return '';
  const lowerField = field.toLowerCase();

  const exactMap: Record<string, string> = {
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
    'is_active': 'Activo',
    'internal_reference': 'Ref. Interna',
    'barcode': 'Código de Barras',
    'category': 'Categoría',
    'cost': 'Costo',
    'weight': 'Peso',
    'volume': 'Volumen',
    'email': 'Email',
    'phone': 'Teléfono',
    'address': 'Dirección',
    'city': 'Ciudad',
    'country': 'País',
    'tax_id': 'RUT',
    'rut': 'RUT',
    'user': 'Usuario',
    'role': 'Rol',
    'company': 'Empresa',
    'permissions': 'Permisos',
    'type': 'Tipo',
    'code': 'Código',
    'amount': 'Monto',
    'currency': 'Moneda',
    'is_default_customer': 'Es Cliente por Defecto',
    'contact_name': 'Nombre Contacto',
    'document_type': 'Tipo Documento',
    'document_number': 'Nº Documento',
    'issue_date': 'Fecha Emisión',
    'due_date': 'Fecha Vencimiento',
    'payment_term': 'Plazo de Pago',
    'sales_channel': 'Canal de Venta',
    'stage': 'Etapa',
    'priority': 'Prioridad',
    'discount': 'Descuento',
    'net_amount': 'Monto Neto',
    'base_amount': 'Monto Base',
    'balance': 'Saldo',
    'account': 'Cuenta',
    'bank': 'Banco',
    'journal': 'Diario',
    'invoice_status': 'Estado Factura',
    'delivery_status': 'Estado Entrega',
    'receipt_status': 'Estado Recepción',
    'location': 'Ubicación',
    'source_document': 'Documento Origen',
    'credit_last_valuated': 'Ult. Evaluación de Crédito',
    'can_be_sold': 'Habilitado para Venta',
    'can_be_purchased': 'Habilitado para Compra',
    'has_bom': 'Tiene Lista de Materiales',
    'requires_advanced_manufacturing': 'Requiere Fabricación Avanzada',
    'mfg_auto_finalize': 'Fabricación express',
    'mfg_enable_prepress': 'Fáb.: Hab. Pre-Impresión',
    'mfg_enable_press': 'Fáb.: Hab. Impresión',
    'mfg_enable_postpress': 'Fáb.: Hab. Post-Impresión',
    'mfg_prepress_design': 'Fáb. Pre: Diseño',
    'mfg_prepress_specs': 'Fáb. Pre: Especificaciones',
    'mfg_prepress_folio': 'Fáb. Pre: Folios',
    'mfg_press_offset': 'Fáb. Imp: Offset',
    'mfg_press_digital': 'Fáb. Imp: Digital',
    'mfg_postpress_finishing': 'Fáb. Post: Terminaciones',
    'mfg_postpress_binding': 'Fáb. Post: Encuadernación',
    'mfg_default_delivery_days': 'Días de Entrega Estándar',
    'track_inventory': 'Seguimiento de Stock',
    'is_dynamic_pricing': 'Precio Dinámico',
    'sale_uom': 'U. Medida Venta',
    'purchase_uom': 'U. Medida Compra',
    'allowed_sale_uoms': 'U. Medidas Permitidas',
    'receiving_warehouse': 'Bodega Recepción',
    'product_type': 'Tipo de Producto',
    'internal_code': 'Código Interno',
    'has_variants': 'Tiene Variantes',
    'is_variable_amount': 'Monto Variable',
    'recurrence_period': 'Período Recurrencia',
    'renewal_notice_days': 'Días Aviso Renovación',
    'subscription_supplier': 'Proveedor Suscripción',
    'subscription_amount': 'Monto Suscripción',
    'subscription_start_date': 'Inicio Suscripción',
    'auto_activate_subscription': 'Activar Suscripción Auto.',
    'is_indefinite': 'Contrato Indefinido',
    'contract_end_date': 'Fin de Contrato',
    'income_account': 'Cuenta de Ingresos',
    'expense_account': 'Cuenta de Gastos',
    'preferred_supplier': 'Proveedor Preferido',
  };

  if (exactMap[lowerField]) return exactMap[lowerField];

  const partialMap: Record<string, string> = {
    'date': 'fecha', 'amount': 'monto', 'price': 'precio', 'cost': 'costo',
    'name': 'nombre', 'status': 'estado', 'type': 'tipo', 'channel': 'canal',
    'stage': 'etapa', 'reference': 'referencia', 'user': 'usuario',
    'customer': 'cliente', 'supplier': 'proveedor', 'product': 'producto',
    'company': 'empresa', 'address': 'dirección', 'phone': 'teléfono',
    'email': 'correo', 'city': 'ciudad', 'country': 'país', 'tax': 'impuesto',
    'discount': 'descuento', 'total': 'total', 'qty': 'cantidad',
    'quantity': 'cantidad', 'number': 'número', 'code': 'código',
    'category': 'categoría', 'warehouse': 'bodega', 'location': 'ubicación',
    'payment': 'pago', 'invoice': 'factura', 'order': 'pedido', 'sale': 'venta',
    'purchase': 'compra', 'delivery': 'entrega', 'receipt': 'recepción',
    'subtotal': 'subtotal', 'is': 'es', 'has': 'tiene', 'can': 'puede',
    'be': 'ser', 'purchased': 'comprado', 'sold': 'vendido', 'tracked': 'seguido',
    'advanced': 'avanzada', 'manufacturing': 'fabricación', 'mfg': 'fáb.',
    'auto': 'auto', 'finalize': 'finalizar', 'uom': 'u.m.', 'variant': 'variante'
  };

  const humanized = lowerField.replace(/_/g, ' ');
  const words = humanized.split(' ').map(w => partialMap[w] || w);

  return words.join(' ').replace(/\b\w/g, l => l.toUpperCase());
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
    'WRITE_OFF': 'Castigo',
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

import { formatEntityDisplay } from './entity-registry'

export function formatDocumentId(type: string | null | undefined, number: string | number | null | undefined): string {
  if (!number) return '---'

  const typeMap: Record<string, string> = {
    'FACTURA': 'billing.invoice',
    'BOLETA': 'billing.invoice',
    'GUIA_DESPACHO': 'sales.saledelivery',
    'DELIVERY': 'sales.saledelivery',
    'SALE_ORDER': 'sales.saleorder',
    'SALE': 'sales.saleorder',
    'NV': 'sales.saleorder',
    'PURCHASE_ORDER': 'purchasing.purchaseorder',
    'PURCHASE': 'purchasing.purchaseorder',
    'OCS': 'purchasing.purchaseorder',
    'INVENTORY_MOVEMENT': 'inventory.stockmove',
    'MOV': 'inventory.stockmove',
    'JOURNAL_ENTRY': 'accounting.journalentry',
    'AS': 'accounting.journalentry',
    'PRODUCTION_ORDER': 'production.workorder',
    'OT': 'production.workorder',
    'DEPOSIT': 'treasury.treasurymovement',
    'WITHDRAWAL': 'treasury.treasurymovement',
    'TRANSFER': 'treasury.treasurymovement',
    'ADJUSTMENT': 'treasury.treasurymovement',
    'WRITE_OFF': 'treasury.treasurymovement',
  }

  const label = typeMap[type?.toUpperCase() || '']
  if (label) {
    // If it's a dynamic treasury move, we might need more context, 
    // but formatEntityDisplay will handle it if data has display_id
    return formatEntityDisplay(label, { id: number, number, display_id: number })
  }

  return number.toString()
}
