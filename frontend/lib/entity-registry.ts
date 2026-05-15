import { 
  ReceiptText, Truck, Undo2, FileText,
  Wrench, Package, ArrowLeftRight, Landmark, BookOpen, 
  Hash, Users, User, UserCheck, Book, PiggyBank, ShoppingCart, Receipt,
  List, LayoutDashboard, LayoutGrid, Kanban,
  type LucideIcon 
} from 'lucide-react';

/**
 * EntityRegistry — Central source of truth for ERP entity identity.
 * Syncs with backend SearchableEntity registry.
 */

/** Declarative view configuration for DataTable routes */
export interface ViewPolicy {
  /** Available view modes for this entity's list page */
  availableViews: ('list' | 'card' | 'grid' | 'kanban')[];
  /** Default view when no ?view= param is present */
  defaultView: 'list' | 'card' | 'grid' | 'kanban';
  /** Card component strategy: 'domain' = DomainCard (workflow entities), 'entity' = EntityCard, 'entity-compact' = EntityCard compact, 'custom' = domain-specific */
  cardComponent?: 'domain' | 'entity' | 'entity-compact' | 'custom';
  /** Grid layout for card/grid views */
  gridLayout?: 'single-column' | 'multi-column';
}

export interface EntityMetadata {
  label: string;
  title: string;
  titlePlural: string;
  icon: LucideIcon;
  shortTemplate: string;
  listUrl: string;
  detailUrlPattern: string;
  /** Field to use for the main partner name in cards/headers */
  partnerField?: string | ((data: any) => string);
  /** Workflow status calculation strategy */
  workflowType?: 'order' | 'invoice' | 'note';
  /** Declarative view mode policy */
  viewPolicy?: ViewPolicy;
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
    partnerField: (data) => (typeof data.customer_name === 'object' ? data.customer_name?.name : data.customer_name) || data.partner_name || '---',
    workflowType: 'order',
    viewPolicy: { availableViews: ['list', 'card'], defaultView: 'card', cardComponent: 'domain', gridLayout: 'single-column' },
  },
  'sales.saledelivery': {
    label: 'sales.saledelivery',
    title: 'Guía de Despacho',
    titlePlural: 'Guías de Despacho',
    icon: Truck,
    shortTemplate: 'DES-{number}',
    listUrl: '/sales/deliveries',
    detailUrlPattern: '/sales/deliveries/{id}',
    partnerField: 'partner_name',
  },
  'sales.salereturn': {
    label: 'sales.salereturn',
    title: 'Devolución',
    titlePlural: 'Devoluciones',
    icon: Undo2,
    shortTemplate: 'DEV-{number}',
    listUrl: '/sales/returns',
    detailUrlPattern: '/sales/returns/{id}',
    partnerField: 'partner_name',
  },
  'purchasing.purchaseorder': {
    label: 'purchasing.purchaseorder',
    title: 'Orden de Compra',
    titlePlural: 'Ordenes de Compra',
    icon: ShoppingCart,
    shortTemplate: 'OCS-{number}',
    listUrl: '/purchasing/orders',
    detailUrlPattern: '/purchasing/orders/{id}',
    partnerField: 'supplier_name',
    workflowType: 'order',
    viewPolicy: { availableViews: ['list', 'card'], defaultView: 'card', cardComponent: 'domain', gridLayout: 'single-column' },
  },
  'billing.invoice': {
    label: 'billing.invoice',
    title: 'Factura/DTE',
    titlePlural: 'Facturas/DTEs',
    icon: FileText,
    shortTemplate: 'FAC-{number}',
    listUrl: '/billing/sales',
    detailUrlPattern: '/billing/invoices/{id}',
    partnerField: (data) => data.partner_name || data.customer_name || data.supplier_name || '---',
    workflowType: 'invoice',
    viewPolicy: { availableViews: ['list', 'card'], defaultView: 'card', cardComponent: 'domain', gridLayout: 'single-column' },
  },
  'production.workorder': {
    label: 'production.workorder',
    title: 'Orden de Trabajo',
    titlePlural: 'Ordenes de Trabajo',
    icon: Wrench,
    shortTemplate: 'OT-{number}',
    listUrl: '/production/orders',
    detailUrlPattern: '/production/orders/{id}',
    partnerField: 'name',
    workflowType: 'order',
    viewPolicy: { availableViews: ['list', 'kanban'], defaultView: 'list', cardComponent: 'custom' },
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
    viewPolicy: { availableViews: ['list', 'card'], defaultView: 'list', cardComponent: 'entity', gridLayout: 'single-column' },
  },
  'treasury.treasurymovement': {
    label: 'treasury.treasurymovement',
    title: 'Movimiento de Tesorería',
    titlePlural: 'Movimientos de Tesorería',
    icon: Landmark,
    shortTemplate: 'TRX-{id}',
    listUrl: '/treasury/movements',
    detailUrlPattern: '/treasury/movements/{id}',
    viewPolicy: { availableViews: ['list', 'grid'], defaultView: 'list', cardComponent: 'entity-compact', gridLayout: 'multi-column' },
  },
  'treasury.treasuryaccount': {
    label: 'treasury.treasuryaccount',
    title: 'Cuenta de Tesorería',
    titlePlural: 'Cuentas de Tesorería',
    icon: Landmark,
    shortTemplate: 'CTA-{id}',
    listUrl: '/treasury/terminals?tab=accounts',
    detailUrlPattern: '/treasury/terminals?tab=accounts&selected={id}',
    viewPolicy: { availableViews: ['list', 'grid'], defaultView: 'list', cardComponent: 'entity-compact', gridLayout: 'multi-column' },
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
    viewPolicy: { availableViews: ['list', 'card'], defaultView: 'list', cardComponent: 'entity', gridLayout: 'single-column' },
  },
  'hr.employee': {
    label: 'hr.employee',
    title: 'Empleado',
    titlePlural: 'Empleados',
    icon: UserCheck,
    shortTemplate: 'EMP-{id}',
    listUrl: '/hr/employees',
    detailUrlPattern: '/hr/employees/{id}',
    viewPolicy: { availableViews: ['list', 'card'], defaultView: 'list', cardComponent: 'entity', gridLayout: 'single-column' },
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
  
  let template = entity.shortTemplate;

  // Domain-specific override for Billing Invoices (Dynamic Prefixes)
  if (label === 'billing.invoice' && data?.dte_type) {
    const dtePrefixes: Record<string, string> = {
      'FACTURA': 'FAC',
      'FACTURA_EXENTA': 'FE',
      'BOLETA': 'BOL',
      'BOLETA_EXENTA': 'BE',
      'NOTA_CREDITO': 'NC',
      'NOTA_DEBITO': 'ND'
    };
    const prefix = dtePrefixes[data.dte_type] || 'FAC';
    template = `${prefix}-{number}`;
  }

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

export function getPartnerName(label: string, data: any): string {
  const entity = ENTITY_REGISTRY[label];
  if (!entity?.partnerField) return data.partner_name || data.name || '---';
  
  if (typeof entity.partnerField === 'function') {
    return entity.partnerField(data);
  }
  
  return data[entity.partnerField] || '---';
}

/**
 * Icon and label map for canonical view types.
 */
const VIEW_ICON_MAP: Record<string, { label: string; icon: LucideIcon }> = {
  list:   { label: 'Lista',    icon: List },
  card:   { label: 'Tarjeta',  icon: LayoutDashboard },
  grid:   { label: 'Grilla',   icon: LayoutGrid },
  kanban: { label: 'Kanban',   icon: Kanban },
};

/**
 * Generates the viewOptions array for DataTable toolbar from entity metadata.
 * Returns undefined if the entity only has one view (no selector needed).
 */
export function getViewOptions(label: string) {
  const policy = ENTITY_REGISTRY[label]?.viewPolicy;
  if (!policy || policy.availableViews.length <= 1) return undefined;
  
  return policy.availableViews.map(v => ({
    label: VIEW_ICON_MAP[v]?.label ?? v,
    value: v,
    icon: VIEW_ICON_MAP[v]?.icon ?? List,
  }));
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
