import { 
  ReceiptText, Truck, Undo2, FileText,
  Wrench, Package, ArrowLeftRight, Landmark, BookOpen, 
  Hash, Users, User, UserCheck, Book, PiggyBank, ShoppingCart, Receipt,
  type LucideIcon 
} from 'lucide-react';

/**
 * EntityRegistry — Central source of truth for ERP entity identity.
 * Syncs with backend SearchableEntity registry.
 */

export interface EntityMetadata {
  label: string;
  title: string;
  titlePlural: string;
  icon: LucideIcon;
  shortTemplate: string;
  listUrl: string;
  detailUrlPattern: string;
}

export const ENTITY_REGISTRY: Record<string, EntityMetadata> = {
  'sales.saleorder': {
    label: 'sales.saleorder',
    title: 'Nota de Venta',
    titlePlural: 'Notas de Venta',
    icon: ReceiptText,
    shortTemplate: 'NV-{number}',
    listUrl: '/sales/orders',
    detailUrlPattern: '/sales/orders/{id}',
  },
  'sales.saledelivery': {
    label: 'sales.saledelivery',
    title: 'Guía de Despacho',
    titlePlural: 'Guías de Despacho',
    icon: Truck,
    shortTemplate: 'DES-{number}',
    listUrl: '/sales/deliveries',
    detailUrlPattern: '/sales/deliveries/{id}',
  },
  'sales.salereturn': {
    label: 'sales.salereturn',
    title: 'Devolución',
    titlePlural: 'Devoluciones',
    icon: Undo2,
    shortTemplate: 'DEV-{number}',
    listUrl: '/sales/returns',
    detailUrlPattern: '/sales/returns/{id}',
  },
  'purchasing.purchaseorder': {
    label: 'purchasing.purchaseorder',
    title: 'Orden de Compra',
    titlePlural: 'Ordenes de Compra',
    icon: ShoppingCart,
    shortTemplate: 'OCS-{number}',
    listUrl: '/purchasing/orders',
    detailUrlPattern: '/purchasing/orders/{id}',
  },
  'billing.invoice': {
    label: 'billing.invoice',
    title: 'Factura/DTE',
    titlePlural: 'Facturas/DTEs',
    icon: FileText,
    shortTemplate: 'FAC-{number}',
    listUrl: '/billing/sales',
    detailUrlPattern: '/billing/invoices/{id}',
  },
  'production.workorder': {
    label: 'production.workorder',
    title: 'Orden de Trabajo',
    titlePlural: 'Ordenes de Trabajo',
    icon: Wrench,
    shortTemplate: 'OT-{number}',
    listUrl: '/production/orders',
    detailUrlPattern: '/production/orders/{id}',
  },
  'inventory.stockmove': {
    label: 'inventory.stockmove',
    title: 'Movimiento de Stock',
    titlePlural: 'Kardex',
    icon: ArrowLeftRight,
    shortTemplate: 'MOV-{id}',
    listUrl: '/inventory/stock?tab=movements',
    detailUrlPattern: '/inventory/stock-moves/{id}',
  },
  'inventory.product': {
    label: 'inventory.product',
    title: 'Producto',
    titlePlural: 'Productos',
    icon: Package,
    shortTemplate: 'PRD-{id}',
    listUrl: '/inventory/products',
    detailUrlPattern: '/inventory/products/{id}',
  },
  'treasury.treasurymovement': {
    label: 'treasury.treasurymovement',
    title: 'Movimiento de Tesorería',
    titlePlural: 'Movimientos de Tesorería',
    icon: Landmark,
    shortTemplate: 'TRX-{id}',
    listUrl: '/treasury/movements',
    detailUrlPattern: '/treasury/movements/{id}',
  },
  'treasury.bankstatement': {
    label: 'treasury.bankstatement',
    title: 'Cartola Bancaria',
    titlePlural: 'Cartolas Bancarias',
    icon: BookOpen,
    shortTemplate: 'CAR-{id}',
    listUrl: '/treasury/reconciliation?tab=statements',
    detailUrlPattern: '/treasury/reconciliation/statements/{id}',
  },
  'accounting.account': {
    label: 'accounting.account',
    title: 'Cuenta Contable',
    titlePlural: 'Plan de Cuentas',
    icon: Book,
    shortTemplate: '{code}',
    listUrl: '/accounting/ledger',
    detailUrlPattern: '/accounting/accounts/{id}/ledger',
  },
  'accounting.journalentry': {
    label: 'accounting.journalentry',
    title: 'Asiento Contable',
    titlePlural: 'Libro Diario',
    icon: Hash,
    shortTemplate: 'AS-{number}',
    listUrl: '/accounting/entries',
    detailUrlPattern: '/accounting/entries/{id}',
  },
  'contacts.contact': {
    label: 'contacts.contact',
    title: 'Contacto',
    titlePlural: 'Contactos',
    icon: Users,
    shortTemplate: 'CON-{id}',
    listUrl: '/contacts',
    detailUrlPattern: '/contacts/{id}',
  },
  'hr.employee': {
    label: 'hr.employee',
    title: 'Empleado',
    titlePlural: 'Empleados',
    icon: UserCheck,
    shortTemplate: 'EMP-{id}',
    listUrl: '/hr/employees',
    detailUrlPattern: '/hr/employees/{id}',
  },
  'hr.payroll': {
    label: 'hr.payroll',
    title: 'Liquidación de Sueldo',
    titlePlural: 'Liquidaciones de Sueldo',
    icon: Receipt,
    shortTemplate: 'LIQ-{id}',
    listUrl: '/hr/payrolls',
    detailUrlPattern: '/hr/payrolls/{id}',
  },
  'core.user': {
    label: 'core.user',
    title: 'Usuario',
    titlePlural: 'Usuarios',
    icon: User,
    shortTemplate: 'USR-{id}',
    listUrl: '/settings/users',
    detailUrlPattern: '/settings/users/{id}',
  },
};

/**
 * Renders a template string using the provided data.
 * Supports dot notation (e.g. {customer.name}) and simple padding (e.g. {id:06d}).
 */
export function formatEntityDisplay(label: string, data: any): string {
  const entity = ENTITY_REGISTRY[label];
  if (!entity) return String(data?.id || data);
  
  const template = entity.shortTemplate;
  return template.replace(/{([^}]+)}/g, (match, key) => {
    const [path, format] = key.split(':');
    let value = data;
    
    // Resolve dot notation
    for (const part of path.split('.')) {
      value = value?.[part];
    }
    
    if (value === undefined || value === null) return '';
    
    // Simple padding support (matching backend :06d style)
    if (format && format.startsWith('0') && format.endsWith('d')) {
      const length = parseInt(format.slice(1, -1), 10);
      return String(value).padStart(length, '0');
    }
    
    return String(value);
  });
}

export function getEntityMetadata(label: string): EntityMetadata | undefined {
  return ENTITY_REGISTRY[label];
}

export function getEntityIcon(label: string) {
  return ENTITY_REGISTRY[label]?.icon || Package;
}

/**
 * Detects the entity label (registry key) from a string (e.g. task type or title).
 * Used for smart navigation and dynamic identity formatting.
 */
export function detectEntityLabel(text: string): string | null {
  const t = text.toUpperCase();
  
  if (t.includes('OT_') || t.includes('OT-')) return 'production.workorder';
  if (t.includes('OCS_') || t.includes('OCS-')) return 'purchasing.purchaseorder';
  if (t.includes('OC_') || t.includes('OC-')) return 'purchasing.purchaseorder'; // Legacy support
  if (t.includes('OV_') || t.includes('OV-') || t.includes('NV_') || t.includes('NV-')) return 'sales.saleorder';
  if (t.includes('FAC_') || t.includes('FAC-')) return 'billing.invoice';
  if (t.includes('NC_') || t.includes('NC-') || t.includes('ND_') || t.includes('ND-')) return 'billing.invoice';
  if (t.includes('EMP_') || t.includes('EMP-')) return 'hr.employee';
  if (t.includes('LIQ_') || t.includes('LIQ-')) return 'hr.payroll';
  if (t.includes('PRD_') || t.includes('PRD-')) return 'inventory.product';
  if (t.includes('CON_') || t.includes('CON-')) return 'contacts.contact';
  if (t.includes('USR_') || t.includes('USR-')) return 'core.user';
  if (t.includes('CAR_') || t.includes('CAR-')) return 'treasury.bankstatement';
  if (t.includes('TRX_') || t.includes('TRX-')) return 'treasury.treasurymovement';
  if (t.includes('MOV_') || t.includes('MOV-')) return 'inventory.stockmove';
  if (t.includes('AS_') || t.includes('AS-')) return 'accounting.journalentry';
  
  return null;
}
