import { 
  ReceiptText, Truck, Undo2, FileText,
  Wrench, Package, ArrowLeftRight, ArrowRightLeft, Landmark, BookOpen, 
  Hash, Users, User, UserCheck, Book, ShoppingCart, Receipt,
  List, LayoutDashboard, LayoutGrid, Kanban, CalendarDays, ClipboardCheck,
  Building2, Smartphone, CreditCard, Calendar, CalendarX2, Repeat,
  Tag, Percent, Ruler, PieChart, HandCoins, ClipboardList, PackageCheck,
  BarChart3,
  CheckSquare, Banknote, Monitor, Wallet, ScrollText,
  type LucideIcon 
} from 'lucide-react';

/**
 * EntityRegistry — Central source of truth for ERP entity identity.
 * Syncs with backend SearchableEntity registry.
 */

/** Declarative view configuration for DataTable routes */
export interface ViewPolicy {
  /** Available view modes for this entity's list page */
  availableViews: ('list' | 'card' | 'grid' | 'kanban' | 'timeline')[];
  /** Default view when no ?view= param is present */
  defaultView: 'list' | 'card' | 'grid' | 'kanban';
  /** Card component strategy: 'domain' = DomainCard (workflow entities), 'entity' = EntityCard, 'custom' = domain-specific */
  cardComponent?: 'domain' | 'entity' | 'custom';
  /** Grid layout for card/grid views */
  gridLayout?: 'single-column' | 'multi-column';
}

export interface EntityMetadata {
  label: string;
  title: string;
  titlePlural: string;
  icon: LucideIcon;
  iconName: string;
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
    iconName: 'ReceiptText',
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
    iconName: 'Truck',
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
    iconName: 'Undo2',
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
    iconName: 'ShoppingCart',
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
    iconName: 'FileText',
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
    iconName: 'Wrench',
    shortTemplate: 'OT-{number}',
    listUrl: '/production/orders',
    detailUrlPattern: '/production/orders/{id}',
    partnerField: 'name',
    workflowType: 'order',
    viewPolicy: { availableViews: ['list', 'kanban', 'timeline'], defaultView: 'list', cardComponent: 'custom' },
  },
  'production.bom': {
    label: 'production.bom',
    title: 'Lista de Materiales',
    titlePlural: 'Listas de Materiales',
    icon: ClipboardList,
    iconName: 'ClipboardList',
    shortTemplate: 'BOM-{id}',
    listUrl: '/production/boms',
    detailUrlPattern: '/production/boms/{id}',
    viewPolicy: { availableViews: ['card'], defaultView: 'card', cardComponent: 'entity' },
  },
  'inventory.stockmove': {
    label: 'inventory.stockmove',
    title: 'Movimiento de Stock',
    titlePlural: 'Kardex',
    icon: ArrowLeftRight,
    iconName: 'ArrowLeftRight',
    shortTemplate: 'MOV-{id}',
    listUrl: '/inventory/stock/movements',
    detailUrlPattern: '/inventory/stock-moves/{id}',
    viewPolicy: { availableViews: ['list', 'card'], defaultView: 'list', cardComponent: 'entity', gridLayout: 'single-column' },
  },
  'inventory.product': {
    label: 'inventory.product',
    title: 'Producto',
    titlePlural: 'Productos',
    icon: Package,
    iconName: 'Package',
    shortTemplate: 'PRD-{id}',
    listUrl: '/inventory/products',
    detailUrlPattern: '/inventory/products/{id}',
    viewPolicy: { availableViews: ['list', 'card'], defaultView: 'list', cardComponent: 'entity', gridLayout: 'single-column' },
  },
  'inventory.subscription': {
    label: 'inventory.subscription',
    title: 'Suscripción',
    titlePlural: 'Suscripciones',
    icon: Repeat,
    iconName: 'Repeat',
    shortTemplate: 'SUB-{id}',
    listUrl: '/inventory/products/subscriptions',
    detailUrlPattern: '/inventory/products/{id}',
    partnerField: 'customer_name',
    viewPolicy: { availableViews: ['card'], defaultView: 'card', cardComponent: 'entity', gridLayout: 'single-column' },
  },
  'inventory.warehouse': {
    label: 'inventory.warehouse',
    title: 'Bodega',
    titlePlural: 'Bodegas',
    icon: Building2,
    iconName: 'Building2',
    shortTemplate: '{code}',
    listUrl: '/inventory/stock/warehouses',
    detailUrlPattern: '/inventory/warehouses/{id}',
    viewPolicy: { availableViews: ['list'], defaultView: 'list' },
  },
  'inventory.attribute': {
    label: 'inventory.attribute',
    title: 'Atributo',
    titlePlural: 'Atributos',
    icon: Tag,
    iconName: 'Tag',
    shortTemplate: '{name}',
    listUrl: '/inventory/stock/products/attributes',
    detailUrlPattern: '/inventory/stock/products/attributes',
    viewPolicy: { availableViews: ['list', 'card'], defaultView: 'list', cardComponent: 'entity' },
  },
  'inventory.stockreport': {
    label: 'inventory.stockreport',
    title: 'Reporte de Stock',
    titlePlural: 'Reportes de Stock',
    icon: BarChart3,
    iconName: 'BarChart3',
    shortTemplate: '{name}',
    listUrl: '/inventory/stock/report',
    detailUrlPattern: '/inventory/stock/report',
    viewPolicy: { availableViews: ['list', 'card'], defaultView: 'list', cardComponent: 'entity' },
  },
  'treasury.loaninstallment': {
    label: 'treasury.loaninstallment',
    title: 'Cuota de Crédito',
    titlePlural: 'Cuotas de Crédito',
    icon: Calendar,
    iconName: 'Calendar',
    shortTemplate: 'CUO-{id}',
    listUrl: '/treasury/loans',
    detailUrlPattern: '/treasury/loans?selected={loan}&installment={id}',
    partnerField: (data) => data.loan_display_id || '---',
    viewPolicy: { availableViews: ['list'], defaultView: 'list' },
  },
  'treasury.cardpurchasegroup': {
    label: 'treasury.cardpurchasegroup',
    title: 'Compra en Cuotas',
    titlePlural: 'Compras en Cuotas',
    icon: ShoppingCart,
    iconName: 'ShoppingCart',
    shortTemplate: '{group_display_id}',
    listUrl: '/treasury/bank-center',
    detailUrlPattern: '/treasury/bank-center',
    viewPolicy: { availableViews: ['list'], defaultView: 'list' },
  },
  'treasury.creditcardstatement': {
    label: 'treasury.creditcardstatement',
    title: 'Estado de Cuenta Tarjeta',
    titlePlural: 'Estados de Cuenta Tarjeta',
    icon: CreditCard,
    iconName: 'CreditCard',
    shortTemplate: 'EST-{id}',
    listUrl: '/treasury/bank-center',
    detailUrlPattern: '/treasury/bank-center?statement={id}',
    partnerField: (data) => data.card_account_name || '---',
    viewPolicy: { availableViews: ['card'], defaultView: 'card', cardComponent: 'entity', gridLayout: 'single-column' },
  },
  'treasury.treasurymovement': {
    label: 'treasury.treasurymovement',
    title: 'Movimiento de Tesorería',
    titlePlural: 'Movimientos de Tesorería',
    icon: ArrowRightLeft,
    iconName: 'ArrowRightLeft',
    shortTemplate: 'TRX-{id}',
    listUrl: '/treasury/operaciones/movements',
    detailUrlPattern: '/treasury/operaciones/movements?selected={id}',
    viewPolicy: { availableViews: ['card'], defaultView: 'card', cardComponent: 'entity', gridLayout: 'single-column' },
  },
  'accounting.fiscalyear': {
    label: 'accounting.fiscalyear',
    title: 'Ejercicio Contable',
    titlePlural: 'Ejercicios Contables',
    icon: Calendar,
    iconName: 'Calendar',
    shortTemplate: 'EJ-{year}',
    listUrl: '/accounting/closures',
    detailUrlPattern: '/accounting/closures/{id}',
    viewPolicy: { availableViews: ['card'], defaultView: 'card', cardComponent: 'custom' },
  },
  'accounting.account': {
    label: 'accounting.account',
    title: 'Cuenta Contable',
    titlePlural: 'Plan de Cuentas',
    icon: Book,
    iconName: 'Book',
    shortTemplate: '{code}',
    listUrl: '/accounting/ledger',
    detailUrlPattern: '/accounting/accounts/{id}/ledger',
  },
  'accounting.budget': {
    label: 'accounting.budget',
    title: 'Presupuesto',
    titlePlural: 'Presupuestos',
    icon: PieChart,
    iconName: 'PieChart',
    shortTemplate: 'BUD-{id}',
    listUrl: '/finance/budgets',
    detailUrlPattern: '/finance/budgets/{id}',
    viewPolicy: { availableViews: ['list'], defaultView: 'list' },
  },
  'accounting.journalentry': {
    label: 'accounting.journalentry',
    title: 'Asiento Contable',
    titlePlural: 'Libro Diario',
    icon: Hash,
    iconName: 'Hash',
    shortTemplate: 'AS-{number}',
    listUrl: '/accounting/entries',
    detailUrlPattern: '/accounting/entries/{id}',
    viewPolicy: { availableViews: ['list'], defaultView: 'list' },
  },
  'tax.taxperiod': {
    label: 'tax.taxperiod',
    title: 'Período Tributario',
    titlePlural: 'Períodos Tributarios',
    icon: Calendar,
    iconName: 'Calendar',
    shortTemplate: '{month_display}-{year}',
    listUrl: '/tax/declarations',
    detailUrlPattern: '/tax/periods/{id}',
    viewPolicy: { availableViews: ['card'], defaultView: 'card', cardComponent: 'custom', gridLayout: 'single-column' },
  },
  'contacts.contact': {
    label: 'contacts.contact',
    title: 'Contacto',
    titlePlural: 'Contactos',
    icon: Users,
    iconName: 'Users',
    shortTemplate: 'CON-{id}',
    listUrl: '/contacts',
    detailUrlPattern: '/contacts/{id}',
    viewPolicy: { availableViews: ['card'], defaultView: 'card', cardComponent: 'entity', gridLayout: 'single-column' },
  },
  'hr.employee': {
    label: 'hr.employee',
    title: 'Empleado',
    titlePlural: 'Empleados',
    icon: UserCheck,
    iconName: 'UserCheck',
    shortTemplate: 'EMP-{id}',
    listUrl: '/hr/employees',
    detailUrlPattern: '/hr/employees/{id}',
    viewPolicy: { availableViews: ['card'], defaultView: 'card', cardComponent: 'entity', gridLayout: 'single-column' },
  },
  'hr.absence': {
    label: 'hr.absence',
    title: 'Inasistencia',
    titlePlural: 'Inasistencias',
    icon: CalendarX2,
    iconName: 'CalendarX2',
    shortTemplate: 'AUS-{id}',
    listUrl: '/hr/absences',
    detailUrlPattern: '/hr/absences/{id}',
    partnerField: 'employee_name',
    viewPolicy: { availableViews: ['card'], defaultView: 'card', cardComponent: 'entity', gridLayout: 'single-column' },
  },
  'hr.payroll': {
    label: 'hr.payroll',
    title: 'Liquidación de Sueldo',
    titlePlural: 'Liquidaciones de Sueldo',
    icon: Receipt,
    iconName: 'Receipt',
    shortTemplate: 'LIQ-{id}',
    listUrl: '/hr/payrolls',
    detailUrlPattern: '/hr/payrolls/{id}',
    viewPolicy: { availableViews: ['list'], defaultView: 'list' },
  },
  'hr.salaryadvance': {
    label: 'hr.salaryadvance',
    title: 'Anticipo de Sueldo',
    titlePlural: 'Anticipos de Sueldo',
    icon: HandCoins,
    iconName: 'HandCoins',
    shortTemplate: 'ANT-{id}',
    listUrl: '/hr/advances',
    detailUrlPattern: '/hr/advances/{id}',
    viewPolicy: { availableViews: ['list', 'card'], defaultView: 'list', cardComponent: 'entity' },
  },
  'workflow.task': {
    label: 'workflow.task',
    title: 'Tarea',
    titlePlural: 'Tareas',
    icon: ClipboardCheck,
    iconName: 'ClipboardCheck',
    shortTemplate: 'TASK-{id}',
    listUrl: '/workflow/tasks',
    detailUrlPattern: '/workflow/tasks/{id}',
    viewPolicy: { availableViews: ['list'], defaultView: 'list' },
  },
  'finance.bankjournal': {
    label: 'finance.bankjournal',
    title: 'Diario Banco',
    titlePlural: 'Diarios de Banco',
    icon: Landmark,
    iconName: 'Landmark',
    shortTemplate: 'BJ-{id}',
    listUrl: '/finances/statements',
    detailUrlPattern: '/finances/statements?selected={id}',
    viewPolicy: { availableViews: ['list'], defaultView: 'list' },
  },
  'finance.payment': {
    label: 'finance.payment',
    title: 'Pago',
    titlePlural: 'Pagos',
    icon: Receipt,
    iconName: 'Receipt',
    shortTemplate: 'PAY-{id}',
    listUrl: '/finances',
    detailUrlPattern: '/finances?selected={id}',
    viewPolicy: { availableViews: ['list'], defaultView: 'list' },
  },
  'core.user': {
    label: 'core.user',
    title: 'Usuario',
    titlePlural: 'Usuarios',
    icon: User,
    iconName: 'User',
    shortTemplate: '{username}',
    listUrl: '/settings/users',
    detailUrlPattern: '/settings/users/{id}',
    viewPolicy: { availableViews: ['list', 'card'], defaultView: 'list', cardComponent: 'entity' },
  },
  'settings.group': {
    label: 'settings.group',
    title: 'Grupo',
    titlePlural: 'Grupos',
    icon: Users,
    iconName: 'Users',
    shortTemplate: '{name}',
    listUrl: '/settings/users',
    detailUrlPattern: '/settings/users/{id}',
    viewPolicy: { availableViews: ['list', 'card'], defaultView: 'list', cardComponent: 'entity' },
  },

  // ── Purchasing (missing entities) ──────────────────────────────────────
  'purchasing.purchasereceipt': {
    label: 'purchasing.purchasereceipt',
    title: 'Recepción de Compra',
    titlePlural: 'Recepciones de Compra',
    icon: PackageCheck,
    iconName: 'PackageCheck',
    shortTemplate: 'REC-{number}',
    listUrl: '/purchasing/orders',
    detailUrlPattern: '/purchasing/receipts/{id}',
    partnerField: 'supplier_name',
  },
  'purchasing.purchasereturn': {
    label: 'purchasing.purchasereturn',
    title: 'Devolución de Compra',
    titlePlural: 'Devoluciones de Compra',
    icon: Undo2,
    iconName: 'Undo2',
    shortTemplate: 'DEV-COM-{number}',
    listUrl: '/purchasing/orders',
    detailUrlPattern: '/purchasing/returns/{id}',
    partnerField: 'supplier_name',
  },

  // ── Tax ────────────────────────────────────────────────────────────────
  'tax.accountingperiod': {
    label: 'tax.accountingperiod',
    title: 'Período Contable',
    titlePlural: 'Períodos Contables',
    icon: Calendar,
    iconName: 'Calendar',
    shortTemplate: 'PER-{id}',
    listUrl: '/tax/declarations',
    detailUrlPattern: '/tax/periods/{id}',
  },
  'tax.f29declaration': {
    label: 'tax.f29declaration',
    title: 'Declaración F29',
    titlePlural: 'Declaraciones F29',
    icon: FileText,
    iconName: 'FileText',
    shortTemplate: 'F29-{id}',
    listUrl: '/tax/declarations',
    detailUrlPattern: '/tax/declarations/{id}',
  },

  // ── Contacts (partner entities) ────────────────────────────────────────
  'contacts.profitdistributionresolution': {
    label: 'contacts.profitdistributionresolution',
    title: 'Resolución de Distribución',
    titlePlural: 'Resoluciones de Distribución',
    icon: PieChart,
    iconName: 'PieChart',
    shortTemplate: 'RD-{id}',
    listUrl: '/finances/partners',
    detailUrlPattern: '/finances/partners/distributions',
  },

  // ── Treasury (missing entities) ────────────────────────────────────────
  'treasury.bank': {
    label: 'treasury.bank',
    title: 'Banco',
    titlePlural: 'Bancos',
    icon: Landmark,
    iconName: 'Landmark',
    shortTemplate: '{name}',
    listUrl: '/treasury/bank-center',
    detailUrlPattern: '/treasury/bank-center/{id}/overview',
    viewPolicy: { availableViews: ['card'], defaultView: 'card', cardComponent: 'entity', gridLayout: 'multi-column' },
  },
  'treasury.paymentmethod': {
    label: 'treasury.paymentmethod',
    title: 'Método de Pago',
    titlePlural: 'Métodos de Pago',
    icon: CreditCard,
    iconName: 'CreditCard',
    shortTemplate: '{name}',
    listUrl: '/treasury/operaciones/methods',
    detailUrlPattern: '/treasury/operaciones/methods?selected={id}',
    viewPolicy: { availableViews: ['card'], defaultView: 'card', cardComponent: 'entity', gridLayout: 'multi-column' },
  },
  'treasury.treasuryaccount': {
    label: 'treasury.treasuryaccount',
    title: 'Cuenta de Tesorería',
    titlePlural: 'Cuentas de Tesorería',
    icon: Landmark,
    iconName: 'Landmark',
    shortTemplate: '{code}',
    listUrl: '/treasury/bank-center',
    detailUrlPattern: '/treasury/bank-center/{id}',
    viewPolicy: { availableViews: ['card'], defaultView: 'card', cardComponent: 'entity' },
  },
  'treasury.bankstatement': {
    label: 'treasury.bankstatement',
    title: 'Cartola Bancaria',
    titlePlural: 'Cartolas Bancarias',
    icon: BookOpen,
    iconName: 'BookOpen',
    shortTemplate: 'CAR-{id}',
    listUrl: '/treasury/bank-center',
    detailUrlPattern: '/treasury/bank-center?statement={id}',
    viewPolicy: { availableViews: ['list', 'card'], defaultView: 'list', cardComponent: 'entity' },
  },
  'treasury.check': {
    label: 'treasury.check',
    title: 'Cheque',
    titlePlural: 'Cheques',
    icon: FileText,
    iconName: 'FileText',
    shortTemplate: 'CHQ-{number}',
    listUrl: '/treasury/operaciones/movements',
    detailUrlPattern: '/treasury/operaciones/movements?check={id}',
    viewPolicy: { availableViews: ['list'], defaultView: 'list' },
  },
  'treasury.bankloan': {
    label: 'treasury.bankloan',
    title: 'Crédito Bancario',
    titlePlural: 'Créditos Bancarios',
    icon: HandCoins,
    iconName: 'HandCoins',
    shortTemplate: 'CRE-{code}',
    listUrl: '/treasury/loans',
    detailUrlPattern: '/treasury/loans?selected={id}',
    viewPolicy: { availableViews: ['card'], defaultView: 'card', cardComponent: 'entity' },
  },
  'treasury.creditline': {
    label: 'treasury.creditline',
    title: 'Línea de Crédito',
    titlePlural: 'Líneas de Crédito',
    icon: ScrollText,
    iconName: 'ScrollText',
    shortTemplate: 'CL-{code}',
    listUrl: '/treasury/bank-center',
    detailUrlPattern: '/treasury/bank-center',
    viewPolicy: { availableViews: ['card'], defaultView: 'card', cardComponent: 'entity' },
  },
  'treasury.terminal': {
    label: 'treasury.terminal',
    title: 'Terminal',
    titlePlural: 'Terminales',
    icon: Smartphone,
    iconName: 'Smartphone',
    shortTemplate: '{name}',
    listUrl: '/treasury/bank-center',
    detailUrlPattern: '/treasury/bank-center?terminal={id}',
    viewPolicy: { availableViews: ['list'], defaultView: 'list' },
  },
  'treasury.terminalprovider': {
    label: 'treasury.terminalprovider',
    title: 'Proveedor de Pago',
    titlePlural: 'Proveedores de Pago',
    icon: Building2,
    iconName: 'Building2',
    shortTemplate: '{name}',
    listUrl: '/treasury/bank-center',
    detailUrlPattern: '/treasury/bank-center?provider={id}',
    viewPolicy: { availableViews: ['list'], defaultView: 'list' },
  },
  'treasury.terminaldevice': {
    label: 'treasury.terminaldevice',
    title: 'Dispositivo',
    titlePlural: 'Dispositivos',
    icon: Smartphone,
    iconName: 'Smartphone',
    shortTemplate: 'DEV-{id}',
    listUrl: '/treasury/bank-center',
    detailUrlPattern: '/treasury/bank-center?device={id}',
    viewPolicy: { availableViews: ['list'], defaultView: 'list' },
  },
  'treasury.terminalbatch': {
    label: 'treasury.terminalbatch',
    title: 'Lote de Terminal',
    titlePlural: 'Lotes de Terminal',
    icon: ClipboardCheck,
    iconName: 'ClipboardCheck',
    shortTemplate: 'LOT-{id}',
    listUrl: '/treasury/bank-center',
    detailUrlPattern: '/treasury/bank-center?batch={id}',
    viewPolicy: { availableViews: ['list'], defaultView: 'list' },
  },

  // ── HR (missing entities) ──────────────────────────────────────────────
  'hr.payrollconcept': {
    label: 'hr.payrollconcept',
    title: 'Concepto de Liquidación',
    titlePlural: 'Conceptos de Liquidación',
    icon: ClipboardList,
    iconName: 'ClipboardList',
    shortTemplate: 'CON-LIQ-{id}',
    listUrl: '/hr/payrolls',
    detailUrlPattern: '/hr/settings/concepts',
  },

  // ── Inventory (missing entities) ───────────────────────────────────────
  'inventory.customfieldtemplate': {
    label: 'inventory.customfieldtemplate',
    title: 'Campo Personalizado',
    titlePlural: 'Campos Personalizados',
    icon: Tag,
    iconName: 'Tag',
    shortTemplate: 'CF-{id}',
    listUrl: '/inventory/products',
    detailUrlPattern: '/inventory/products/custom-fields',
  },
  'inventory.category': {
    label: 'inventory.category',
    title: 'Categoría',
    titlePlural: 'Categorías',
    icon: LayoutGrid,
    iconName: 'LayoutGrid',
    shortTemplate: 'CAT-{id}',
    listUrl: '/inventory/products',
    detailUrlPattern: '/inventory/products?category={id}',
    viewPolicy: { availableViews: ['list'], defaultView: 'list' },
  },
  'inventory.uom': {
    label: 'inventory.uom',
    title: 'Unidad de Medida',
    titlePlural: 'Unidades de Medida',
    icon: Ruler,
    iconName: 'Ruler',
    shortTemplate: '{name}',
    listUrl: '/inventory/products/units',
    detailUrlPattern: '/inventory/products/units?selected={id}',
    viewPolicy: { availableViews: ['list'], defaultView: 'list' },
  },
  'inventory.pricingrule': {
    label: 'inventory.pricingrule',
    title: 'Regla de Precio',
    titlePlural: 'Reglas de Precio',
    icon: Percent,
    iconName: 'Percent',
    shortTemplate: 'REG-{id}',
    listUrl: '/inventory/products',
    detailUrlPattern: '/inventory/products?rule={id}',
    viewPolicy: { availableViews: ['list'], defaultView: 'list' },
  },

  // ── Contacts (partner entities) ────────────────────────────────────────
  'contacts.partnertransaction': {
    label: 'contacts.partnertransaction',
    title: 'Transacción de Socio',
    titlePlural: 'Transacciones de Socios',
    icon: ArrowRightLeft,
    iconName: 'ArrowRightLeft',
    shortTemplate: 'TRX-{id}',
    listUrl: '/finances/partners',
    detailUrlPattern: '/finances/partners?transaction={id}',
    viewPolicy: { availableViews: ['list'], defaultView: 'list' },
  },

  // ── POS ────────────────────────────────────────────────────────────────
  'pos.session': {
    label: 'pos.session',
    title: 'Sesión POS',
    titlePlural: 'Sesiones POS',
    icon: ShoppingCart,
    iconName: 'ShoppingCart',
    shortTemplate: 'POS-{id}',
    listUrl: '/pos/sessions',
    detailUrlPattern: '/pos/sessions?selected={id}',
    viewPolicy: { availableViews: ['card'], defaultView: 'card', cardComponent: 'entity' },
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

export function getEntityIconName(label: string): string {
  return ENTITY_REGISTRY[label]?.iconName ?? 'Package';
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
 * Detects the entity label (registry key) from a string (e.g. task type or title).
 * Each entry maps a canonical display prefix to its entity registry label.
 * Used for smart navigation and dynamic identity formatting.
 */
export function detectEntityLabel(text: string): string | null {
  const t = text.toUpperCase();
  
  if (t.includes('OT_') || t.includes('OT-')) return 'production.workorder';
  if (t.includes('OCS_') || t.includes('OCS-')) return 'purchasing.purchaseorder';
  if (t.includes('NV_') || t.includes('NV-')) return 'sales.saleorder';
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
  if (t.includes('CL_') || t.includes('CL-')) return 'treasury.creditline';
  if (t.includes('CUO_') || t.includes('CUO-')) return 'treasury.loaninstallment';
  if (t.includes('MOV_') || t.includes('MOV-')) return 'inventory.stockmove';
  if (t.includes('AS_') || t.includes('AS-')) return 'accounting.journalentry';
  if (t.includes('CAT_') || t.includes('CAT-')) return 'inventory.category';
  if (t.includes('REG_') || t.includes('REG-')) return 'inventory.pricingrule';
  if (t.includes('POS_') || t.includes('POS-')) return 'pos.session';
  if (t.includes('LOT_') || t.includes('LOT-')) return 'treasury.terminalbatch';
  
  return null;
}
