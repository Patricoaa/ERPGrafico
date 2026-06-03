import { 
  ReceiptText, Truck, Undo2, FileText,
  Wrench, Package, ArrowLeftRight, Landmark, BookOpen, 
  Hash, Users, User, UserCheck, Book, ShoppingCart, Receipt,
  List, LayoutDashboard, LayoutGrid, Kanban, CalendarDays, ClipboardCheck,
  Building2, Smartphone, CreditCard, Calendar, CalendarX2, Repeat,
  Tag, Percent, Ruler, PieChart, HandCoins, ClipboardList, PackageCheck,
  CheckSquare, Banknote,
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
  /**
   * If true, this entity has a drawer registered in lib/entity-drawers.tsx.
   * EntityBadge and openEntity() will open the drawer in-context instead of
   * navigating to detailUrlPattern. The drawer registration is the source of truth.
   */
  hasDrawer?: boolean;
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
    hasDrawer: true,
  },
  'production.bom': {
    label: 'production.bom',
    title: 'Lista de Materiales',
    titlePlural: 'Listas de Materiales',
    icon: ClipboardList,
    shortTemplate: 'BOM-{id}',
    listUrl: '/production/boms',
    detailUrlPattern: '/production/boms/{id}',
    viewPolicy: { availableViews: ['list', 'card'], defaultView: 'list', cardComponent: 'entity' },
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
    hasDrawer: true,
    viewPolicy: { availableViews: ['list', 'card'], defaultView: 'list', cardComponent: 'entity', gridLayout: 'single-column' },
  },
  'inventory.subscription': {
    label: 'inventory.subscription',
    title: 'Suscripción',
    titlePlural: 'Suscripciones',
    icon: Repeat,
    shortTemplate: 'SUB-{id}',
    listUrl: '/inventory/products?tab=subscriptions',
    detailUrlPattern: '/inventory/products/{id}',
    partnerField: 'customer_name',
    viewPolicy: { availableViews: ['list', 'card'], defaultView: 'list', cardComponent: 'entity', gridLayout: 'single-column' },
  },
  'inventory.warehouse': {
    label: 'inventory.warehouse',
    title: 'Bodega',
    titlePlural: 'Bodegas',
    icon: Building2,
    shortTemplate: '{code}',
    listUrl: '/inventory/stock?tab=warehouses',
    detailUrlPattern: '/inventory/warehouses/{id}',
    hasDrawer: true,
    viewPolicy: { availableViews: ['list'], defaultView: 'list', cardComponent: 'custom' },
  },
  'inventory.category': {
    label: 'inventory.category',
    title: 'Categoría',
    titlePlural: 'Categorías',
    icon: Tag,
    shortTemplate: '{name}',
    listUrl: '/inventory/stock?tab=categories',
    detailUrlPattern: '/inventory/categories/{id}',
    hasDrawer: true,
    viewPolicy: { availableViews: ['list', 'card'], defaultView: 'list', cardComponent: 'entity' },
  },
  'inventory.uom': {
    label: 'inventory.uom',
    title: 'Unidad de Medida',
    titlePlural: 'Unidades de Medida',
    icon: Ruler,
    shortTemplate: '{name}',
    listUrl: '/inventory/stock?tab=uoms',
    detailUrlPattern: '/inventory/uoms/{id}',
    hasDrawer: true,
    viewPolicy: { availableViews: ['list', 'card'], defaultView: 'list', cardComponent: 'entity' },
  },
  'inventory.uomcategory': {
    label: 'inventory.uomcategory',
    title: 'Categoría de UDM',
    titlePlural: 'Categorías de UDM',
    icon: List,
    shortTemplate: '{name}',
    listUrl: '/inventory/stock?tab=uom-categories',
    detailUrlPattern: '/inventory/uom-categories/{id}',
    viewPolicy: { availableViews: ['list', 'card'], defaultView: 'list', cardComponent: 'entity' },
  },
  'inventory.pricingrule': {
    label: 'inventory.pricingrule',
    title: 'Regla de Precio',
    titlePlural: 'Reglas de Precio',
    icon: Percent,
    shortTemplate: '{name}',
    listUrl: '/inventory/stock?tab=pricing-rules',
    detailUrlPattern: '/inventory/pricing-rules/{id}',
    hasDrawer: true,
    viewPolicy: { availableViews: ['list', 'card'], defaultView: 'list', cardComponent: 'entity' },
  },
  'pos.session': {
    label: 'pos.session',
    title: 'Sesión POS',
    titlePlural: 'Sesiones POS',
    icon: ShoppingCart,
    shortTemplate: 'POS-{id}',
    listUrl: '/sales/pos-sessions',
    detailUrlPattern: '/sales/pos-sessions/{id}',
    hasDrawer: true,
    viewPolicy: { availableViews: ['list', 'card'], defaultView: 'card', cardComponent: 'entity', gridLayout: 'single-column' },
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
    hasDrawer: true,
  },
  'treasury.bankstatement': {
    label: 'treasury.bankstatement',
    title: 'Cartola Bancaria',
    titlePlural: 'Cartolas Bancarias',
    icon: BookOpen,
    shortTemplate: 'CAR-{id}',
    listUrl: '/treasury/reconciliation?tab=statements',
    detailUrlPattern: '/treasury/reconciliation/statements/{id}',
    hasDrawer: true,
  },
  'treasury.terminal': {
    label: 'treasury.terminal',
    title: 'Caja',
    titlePlural: 'Cajas',
    icon: CreditCard,
    shortTemplate: 'CAJ-{id}',
    listUrl: '/treasury/terminals',
    detailUrlPattern: '/treasury/terminals?selected={id}',
    hasDrawer: true,
    viewPolicy: { availableViews: ['list', 'card'], defaultView: 'card', cardComponent: 'custom' },
  },
  'treasury.terminaldevice': {
    label: 'treasury.terminaldevice',
    title: 'Dispositivo',
    titlePlural: 'Dispositivos',
    icon: Smartphone,
    shortTemplate: 'DIS-{id}',
    listUrl: '/treasury/hardware',
    detailUrlPattern: '/treasury/hardware?selected={id}',
    hasDrawer: true,
    viewPolicy: { availableViews: ['list', 'card'], defaultView: 'card', cardComponent: 'custom' },
  },
  'treasury.terminalprovider': {
    label: 'treasury.terminalprovider',
    title: 'Proveedor',
    titlePlural: 'Proveedores',
    icon: Building2,
    shortTemplate: 'PROV-{id}',
    listUrl: '/treasury/hardware',
    detailUrlPattern: '/treasury/hardware?selected={id}',
    hasDrawer: true,
    viewPolicy: { availableViews: ['list', 'card'], defaultView: 'card', cardComponent: 'custom' },
  },
  'treasury.terminalbatch': {
    label: 'treasury.terminalbatch',
    title: 'Liquidación',
    titlePlural: 'Liquidaciones',
    icon: Receipt,
    shortTemplate: 'LIQ-{id}',
    listUrl: '/treasury/terminal-cobro?tab=batches',
    detailUrlPattern: '/treasury/terminal-cobro?tab=batches&selected={id}',
    viewPolicy: { availableViews: ['list', 'card'], defaultView: 'list', cardComponent: 'entity', gridLayout: 'single-column' },
  },
  'treasury.check': {
    label: 'treasury.check',
    title: 'Cheque',
    titlePlural: 'Cheques',
    icon: CheckSquare,
    shortTemplate: 'CHQ-{id}',
    listUrl: '/treasury/checks',
    detailUrlPattern: '/treasury/checks?selected={id}',
    partnerField: (data) => data.counterparty_name || data.drawer_name || '---',
    viewPolicy: { availableViews: ['list', 'card'], defaultView: 'list', cardComponent: 'entity', gridLayout: 'single-column' },
  },
  'treasury.bankloan': {
    label: 'treasury.bankloan',
    title: 'Crédito Bancario',
    titlePlural: 'Créditos Bancarios',
    icon: Banknote,
    shortTemplate: 'CRE-{id}',
    listUrl: '/treasury/loans',
    detailUrlPattern: '/treasury/loans?selected={id}',
    partnerField: (data) => data.lender_name || '---',
    viewPolicy: { availableViews: ['list', 'card'], defaultView: 'list', cardComponent: 'entity', gridLayout: 'single-column' },
  },
  'treasury.loaninstallment': {
    label: 'treasury.loaninstallment',
    title: 'Cuota de Crédito',
    titlePlural: 'Cuotas de Crédito',
    icon: Calendar,
    shortTemplate: 'CUO-{id}',
    listUrl: '/treasury/loans',
    detailUrlPattern: '/treasury/loans?selected={loan}&installment={id}',
    partnerField: (data) => data.loan_display_id || '---',
    viewPolicy: { availableViews: ['list'], defaultView: 'list', cardComponent: 'entity', gridLayout: 'single-column' },
  },
  'treasury.creditcardstatement': {
    label: 'treasury.creditcardstatement',
    title: 'Estado de Cuenta Tarjeta',
    titlePlural: 'Estados de Cuenta Tarjeta',
    icon: CreditCard,
    shortTemplate: 'EST-{id}',
    listUrl: '/treasury/accounts',
    detailUrlPattern: '/treasury/accounts?tab=credit-cards&statement={id}',
    partnerField: (data) => data.card_account_name || '---',
    viewPolicy: { availableViews: ['list'], defaultView: 'list', cardComponent: 'entity', gridLayout: 'single-column' },
  },
  'accounting.fiscalyear': {
    label: 'accounting.fiscalyear',
    title: 'Ejercicio Contable',
    titlePlural: 'Ejercicios Contables',
    icon: Calendar,
    shortTemplate: 'EJ-{year}',
    listUrl: '/accounting/closures',
    detailUrlPattern: '/accounting/closures/{id}',
    viewPolicy: { availableViews: ['list', 'card'], defaultView: 'card', cardComponent: 'custom' },
  },
  'accounting.account': {
    label: 'accounting.account',
    title: 'Cuenta Contable',
    titlePlural: 'Plan de Cuentas',
    icon: Book,
    shortTemplate: '{code}',
    listUrl: '/accounting/ledger',
    detailUrlPattern: '/accounting/accounts/{id}/ledger',
    hasDrawer: true,
  },
  'accounting.budget': {
    label: 'accounting.budget',
    title: 'Presupuesto',
    titlePlural: 'Presupuestos',
    icon: PieChart,
    shortTemplate: 'BUD-{id}',
    listUrl: '/finance/budgets',
    detailUrlPattern: '/finance/budgets/{id}',
    viewPolicy: { availableViews: ['list', 'card'], defaultView: 'list', cardComponent: 'entity' },
  },
  'accounting.journalentry': {
    label: 'accounting.journalentry',
    title: 'Asiento Contable',
    titlePlural: 'Libro Diario',
    icon: Hash,
    shortTemplate: 'AS-{number}',
    listUrl: '/accounting/entries',
    detailUrlPattern: '/accounting/entries/{id}',
    hasDrawer: true,
    viewPolicy: { availableViews: ['list'], defaultView: 'list', cardComponent: 'custom' },
  },
  'tax.taxperiod': {
    label: 'tax.taxperiod',
    title: 'Período Tributario',
    titlePlural: 'Períodos Tributarios',
    icon: Calendar,
    shortTemplate: '{month_display}-{year}',
    listUrl: '/tax/declarations',
    detailUrlPattern: '/tax/periods/{id}',
    viewPolicy: { availableViews: ['list', 'card'], defaultView: 'card', cardComponent: 'custom', gridLayout: 'single-column' },
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
    hasDrawer: true,
  },
  'hr.employee': {
    label: 'hr.employee',
    title: 'Empleado',
    titlePlural: 'Empleados',
    icon: UserCheck,
    shortTemplate: 'EMP-{id}',
    listUrl: '/hr/employees',
    detailUrlPattern: '/hr/employees/{id}',
    hasDrawer: true,
    viewPolicy: { availableViews: ['list', 'card'], defaultView: 'list', cardComponent: 'entity', gridLayout: 'single-column' },
  },
  'hr.absence': {
    label: 'hr.absence',
    title: 'Inasistencia',
    titlePlural: 'Inasistencias',
    icon: CalendarX2,
    shortTemplate: 'AUS-{id}',
    listUrl: '/hr/absences',
    detailUrlPattern: '/hr/absences/{id}',
    partnerField: 'employee_name',
    hasDrawer: true,
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
    hasDrawer: true,
    viewPolicy: { availableViews: ['list'], defaultView: 'list', cardComponent: 'custom' },
  },
  'hr.salaryadvance': {
    label: 'hr.salaryadvance',
    title: 'Anticipo de Sueldo',
    titlePlural: 'Anticipos de Sueldo',
    icon: HandCoins,
    shortTemplate: 'ANT-{id}',
    listUrl: '/hr/advances',
    detailUrlPattern: '/hr/advances/{id}',
    hasDrawer: true,
    viewPolicy: { availableViews: ['list', 'card'], defaultView: 'list', cardComponent: 'entity' },
  },
  'core.user': {
    label: 'core.user',
    title: 'Usuario',
    titlePlural: 'Usuarios',
    icon: User,
    shortTemplate: '{username}',
    listUrl: '/settings/users',
    detailUrlPattern: '/settings/users/{id}',
    hasDrawer: true,
    viewPolicy: { availableViews: ['list'], defaultView: 'list', cardComponent: 'custom' },
  },
  'workflow.task': {
    label: 'workflow.task',
    title: 'Tarea',
    titlePlural: 'Tareas',
    icon: ClipboardCheck,
    shortTemplate: 'TASK-{id}',
    listUrl: '/workflow/tasks',
    detailUrlPattern: '/workflow/tasks/{id}',
    viewPolicy: { availableViews: ['list'], defaultView: 'list', cardComponent: 'custom' },
  },
  'finance.bankjournal': {
    label: 'finance.bankjournal',
    title: 'Diario Banco',
    titlePlural: 'Diarios de Banco',
    icon: Landmark,
    shortTemplate: 'BJ-{id}',
    listUrl: '/finances/statements',
    detailUrlPattern: '/finances/statements?selected={id}',
    hasDrawer: true,
    viewPolicy: { availableViews: ['list'], defaultView: 'list', cardComponent: 'custom' },
  },
  'finance.payment': {
    label: 'finance.payment',
    title: 'Pago',
    titlePlural: 'Pagos',
    icon: Receipt,
    shortTemplate: 'PAY-{id}',
    listUrl: '/finances',
    detailUrlPattern: '/finances?selected={id}',
    hasDrawer: true,
    viewPolicy: { availableViews: ['list'], defaultView: 'list', cardComponent: 'custom' },
  },
  'users.group': {
    label: 'users.group',
    title: 'Grupo',
    titlePlural: 'Grupos',
    icon: Users,
    shortTemplate: 'GRP-{id}',
    listUrl: '/settings/users',
    detailUrlPattern: '/settings/users?selected={id}',
    hasDrawer: true,
    viewPolicy: { availableViews: ['list'], defaultView: 'list', cardComponent: 'custom' },
  },

  // ── Purchasing (missing entities) ──────────────────────────────────────
  'purchasing.purchasereceipt': {
    label: 'purchasing.purchasereceipt',
    title: 'Recepción de Compra',
    titlePlural: 'Recepciones de Compra',
    icon: PackageCheck,
    shortTemplate: 'REC-{number}',
    listUrl: '/purchasing/orders',
    detailUrlPattern: '/purchasing/receipts/{id}',
    partnerField: 'supplier_name',
    hasDrawer: true,
  },
  'purchasing.purchasereturn': {
    label: 'purchasing.purchasereturn',
    title: 'Devolución de Compra',
    titlePlural: 'Devoluciones de Compra',
    icon: Undo2,
    shortTemplate: 'DEV-COM-{number}',
    listUrl: '/purchasing/orders',
    detailUrlPattern: '/purchasing/returns/{id}',
    partnerField: 'supplier_name',
    hasDrawer: true,
  },

  // ── Tax ────────────────────────────────────────────────────────────────
  'tax.accountingperiod': {
    label: 'tax.accountingperiod',
    title: 'Período Contable',
    titlePlural: 'Períodos Contables',
    icon: Calendar,
    shortTemplate: 'PER-{id}',
    listUrl: '/tax/declarations',
    detailUrlPattern: '/tax/periods/{id}',
    hasDrawer: true,
  },
  'tax.f29declaration': {
    label: 'tax.f29declaration',
    title: 'Declaración F29',
    titlePlural: 'Declaraciones F29',
    icon: FileText,
    shortTemplate: 'F29-{id}',
    listUrl: '/tax/declarations',
    detailUrlPattern: '/tax/declarations/{id}',
    hasDrawer: true,
  },

  // ── Contacts (partner entities) ────────────────────────────────────────
  'contacts.profitdistributionresolution': {
    label: 'contacts.profitdistributionresolution',
    title: 'Resolución de Distribución',
    titlePlural: 'Resoluciones de Distribución',
    icon: PieChart,
    shortTemplate: 'RD-{id}',
    listUrl: '/settings/partners',
    detailUrlPattern: '/settings/partners?tab=distributions',
  },

  // ── Treasury (missing entities) ────────────────────────────────────────
  'treasury.bank': {
    label: 'treasury.bank',
    title: 'Banco',
    titlePlural: 'Bancos',
    icon: Landmark,
    shortTemplate: '{name}',
    listUrl: '/treasury/terminals',
    detailUrlPattern: '/treasury/terminals?tab=accounts',
  },
  'treasury.paymentmethod': {
    label: 'treasury.paymentmethod',
    title: 'Método de Pago',
    titlePlural: 'Métodos de Pago',
    icon: CreditCard,
    shortTemplate: '{name}',
    listUrl: '/treasury/terminals',
    detailUrlPattern: '/treasury/terminals?tab=payment-methods',
  },

  // ── HR (missing entities) ──────────────────────────────────────────────
  'hr.payrollconcept': {
    label: 'hr.payrollconcept',
    title: 'Concepto de Liquidación',
    titlePlural: 'Conceptos de Liquidación',
    icon: ClipboardList,
    shortTemplate: 'CON-LIQ-{id}',
    listUrl: '/hr/payrolls',
    detailUrlPattern: '/hr/settings?tab=concepts',
  },

  // ── Inventory (missing entities) ───────────────────────────────────────
  'inventory.customfieldtemplate': {
    label: 'inventory.customfieldtemplate',
    title: 'Campo Personalizado',
    titlePlural: 'Campos Personalizados',
    icon: Tag,
    shortTemplate: 'CF-{id}',
    listUrl: '/inventory/products',
    detailUrlPattern: '/inventory/products?tab=custom-fields',
  },
};

export const DTE_CONFIG: Record<string, { prefix: string, label: string }> = {
  'FACTURA': { prefix: 'FAC', label: 'Factura' },
  'FACTURA_EXENTA': { prefix: 'FE', label: 'Factura Exenta' },
  'BOLETA': { prefix: 'BOL', label: 'Boleta' },
  'BOLETA_EXENTA': { prefix: 'BE', label: 'Boleta Exenta' },
  'NOTA_CREDITO': { prefix: 'NC', label: 'Nota de Crédito' },
  'NOTA_DEBITO': { prefix: 'ND', label: 'Nota de Débito' },
  'GUIA_DESPACHO': { prefix: 'GUI', label: 'Guía de Despacho' },
  'NONE': { prefix: 'SD', label: 'Sin Documento' },
};

export function getDtePrefix(dteType?: string | null): string {
  if (!dteType) return 'DOC';
  return DTE_CONFIG[dteType]?.prefix || 'DOC';
}

export function getDteLabel(dteType?: string | null): string {
  if (!dteType) return 'Documento';
  return DTE_CONFIG[dteType]?.label || dteType;
}

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
    const prefix = getDtePrefix(data.dte_type);
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
  list:    { label: 'Lista',      icon: List },
  card:    { label: 'Tarjeta',    icon: LayoutDashboard },
  grid:    { label: 'Grilla',     icon: LayoutGrid },
  kanban:  { label: 'Kanban',     icon: Kanban },
  timeline:{ label: 'Cronograma', icon: CalendarDays },
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
 * Maps snake_case docType keys (used in transaction-modal, serializers) to registry labels.
 * Single source of truth — consumed by DataCell.Entity and any other resolver that needs it.
 * To add a new type, register the entity in ENTITY_REGISTRY first, then add the mapping here.
 */
export const LEGACY_TYPE_LABEL_MAP: Record<string, string> = {
  // Core transactional documents
  'sale_order':      'sales.saleorder',
  'purchase_order':  'purchasing.purchaseorder',
  'invoice':         'billing.invoice',
  'payment':         'treasury.treasurymovement',
  'journal_entry':   'accounting.journalentry',
  'work_order':      'production.workorder',
  // Logistics
  'sale_delivery':   'sales.saledelivery',
  'sale_return':     'sales.salereturn',
  'purchase_receipt': 'purchasing.purchasereceipt',
  'purchase_return': 'purchasing.purchasereturn',
  // Stock / inventory movements
  'stock_move':      'inventory.stockmove',
  'inventory':       'inventory.stockmove',   // alias used in transaction-modal
  // Treasury
  'cash_movement':   'treasury.treasurymovement',
  'terminal_batch':  'treasury.terminalbatch',
  'bank_statement':  'treasury.bankstatement',
  'check':           'treasury.check',
  'credit_card_statement': 'treasury.creditcardstatement',
  'pos_session':     'pos.session',
  // Tax
  'f29_declaration': 'tax.f29declaration',
  'accounting_period': 'tax.accountingperiod',
};

/** Resolves a legacy snake_case docType to a registry label. Returns undefined if unknown. */
export function resolveLegacyEntityType(type: string): string | undefined {
  return LEGACY_TYPE_LABEL_MAP[type];
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
  if (t.includes('BOD_') || t.includes('BOD-')) return 'inventory.warehouse';
  if (t.includes('CON_') || t.includes('CON-')) return 'contacts.contact';
  if (t.includes('USR_') || t.includes('USR-')) return 'core.user';
  if (t.includes('CAR_') || t.includes('CAR-')) return 'treasury.bankstatement';
  if (t.includes('TRX_') || t.includes('TRX-')) return 'treasury.treasurymovement';
  if (t.includes('CHQ_') || t.includes('CHQ-')) return 'treasury.check';
  if (t.includes('EST_') || t.includes('EST-')) return 'treasury.creditcardstatement';
  if (t.includes('CRE_') || t.includes('CRE-')) return 'treasury.bankloan';
  if (t.includes('CUO_') || t.includes('CUO-')) return 'treasury.loaninstallment';
  if (t.includes('MOV_') || t.includes('MOV-')) return 'inventory.stockmove';
  if (t.includes('AS_') || t.includes('AS-')) return 'accounting.journalentry';
  
  return null;
}
