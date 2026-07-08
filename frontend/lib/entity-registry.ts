import { 
  ReceiptText, Truck, Undo2, FileText,
  Wrench, Package, ArrowLeftRight, ArrowRightLeft, Landmark, BookOpen, 
  Hash, Users, User, UserCheck, Book, ShoppingCart, Receipt,
  List, LayoutDashboard, LayoutGrid, Kanban, CalendarDays, ClipboardCheck,
  Building2, Smartphone, CreditCard, Calendar, CalendarX2, Repeat,
  Tag, Percent, Ruler, PieChart, HandCoins, ClipboardList, PackageCheck,
  BarChart3, Scale, Monitor,
  ScrollText, RefreshCw,
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
  /** Optional — when present, used as fallback if API config is unavailable. */
  shortTemplate?: string;
  listUrl: string;
  detailUrlPattern: string;
  /** True if the entity title is feminine (e.g. "la cuenta", "la nota") — affects prefix: "Nueva" vs "Nuevo" */
  feminine?: boolean;
    /** Default drawer subtitle / description for this entity */
    description?: string;
    /** Template string for dynamic subtitle (e.g. "{code} · {name}"). Rendered with entity data. */
    subtitleTemplate?: string;
    /** Template string appended to subtitle after " · " separator. Supports {field:date} format. */
    subtitleSuffixTemplate?: string;
    /** Whether the entity drawer shows a print button in the header */
    printable?: boolean;
  /** Field to use for the main partner name in cards/headers */
  partnerField?: string | ((data: Record<string, unknown>) => string);
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
    feminine: true,
    description: 'Documento de venta a cliente',
    subtitleTemplate: '{customer_name}',
    subtitleSuffixTemplate: '{date:date} · {channel_display}',
    printable: true,
    shortTemplate: 'NV-{number}',
    listUrl: '/sales/orders',
    detailUrlPattern: '/sales/orders/{id}',
    partnerField: (data): string => {
      const customerName = data.customer_name
      if (customerName && typeof customerName === 'object') {
        return String((customerName as Record<string, unknown>).name ?? '')
      }
      return String(customerName ?? data.partner_name ?? '---')
    },
    workflowType: 'order',
    viewPolicy: { availableViews: ['list', 'card'], defaultView: 'card', cardComponent: 'domain', gridLayout: 'single-column' },
  },
  'sales.saledelivery': {
    label: 'sales.saledelivery',
    title: 'Guía de Despacho',
    titlePlural: 'Guías de Despacho',
    icon: Truck,
    iconName: 'Truck',
    feminine: true,
    description: 'Registro de despacho de mercadería',
    subtitleTemplate: '{partner_name}',
    subtitleSuffixTemplate: 'Despacho · {date:date}',
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
    feminine: true,
    description: 'Anulación total o parcial de una venta',
    subtitleTemplate: '{partner_name}',
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
    feminine: true,
    description: 'Solicitud de compra a proveedor',
    subtitleTemplate: '{supplier_name}',
    subtitleSuffixTemplate: '{date:date} · {status_display}',
    printable: true,
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
    feminine: true,
    description: 'Documento tributario electrónico',
    subtitleTemplate: '{partner_name}',
    subtitleSuffixTemplate: '{dte_type_display} · {date:date}',
    printable: true,
    shortTemplate: 'FAC-{number}',
    listUrl: '/billing/sales',
    detailUrlPattern: '/billing/invoices/{id}',
    partnerField: (data) => String(data.partner_name ?? data.customer_name ?? data.supplier_name ?? '---'),
    workflowType: 'invoice',
    viewPolicy: { availableViews: ['list', 'card'], defaultView: 'card', cardComponent: 'domain', gridLayout: 'single-column' },
  },
  'production.workorder': {
    label: 'production.workorder',
    title: 'Orden de Trabajo',
    titlePlural: 'Ordenes de Trabajo',
    icon: Wrench,
    iconName: 'Wrench',
    feminine: true,
    description: 'Instrucción de fabricación o servicio',
    subtitleTemplate: 'OT-{number}',
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
    feminine: true,
    description: 'Lista de materiales y componentes',
    subtitleTemplate: 'BOM-{id}',
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
    description: 'Entrada o salida de existencias',
    subtitleTemplate: '{product_name}',
    subtitleSuffixTemplate: '{move_type} · {date:date}',
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
    description: 'Bien o servicio comercializable',
    subtitleTemplate: '{code} · {name}',
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
    feminine: true,
    description: 'Contrato recurrente de producto o servicio',
    subtitleTemplate: '{customer_name}',
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
    feminine: true,
    description: 'Ubicación física de almacenaje',
    subtitleTemplate: '{code} · {name}',
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
    description: 'Propiedad variable de un producto',
    subtitleTemplate: '{name}',
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
    description: 'Informe de existencias actuales',
    subtitleTemplate: '{name}',
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
    feminine: true,
    description: 'Pago periódico de un crédito',
    subtitleTemplate: 'CUO-{id}',
    shortTemplate: 'CUO-{id}',
    listUrl: '/treasury/loans',
    detailUrlPattern: '/treasury/loans?selected={loan}&installment={id}',
    partnerField: (data) => String(data.loan_display_id ?? '---'),
    viewPolicy: { availableViews: ['list'], defaultView: 'list' },
  },
  'treasury.cardpurchasegroup': {
    label: 'treasury.cardpurchasegroup',
    title: 'Compra en Cuotas',
    titlePlural: 'Compras en Cuotas',
    icon: ShoppingCart,
    iconName: 'ShoppingCart',
    feminine: true,
    description: 'Compra fraccionada en cuotas',
    subtitleTemplate: '{group_display_id}',
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
    description: 'Resumen de movimientos de tarjeta',
    subtitleTemplate: 'EST-{id} · {card_account_name}',
    shortTemplate: 'EST-{id}',
    listUrl: '/treasury/bank-center',
    detailUrlPattern: '/treasury/bank-center?statement={id}',
    partnerField: (data) => String(data.card_account_name ?? '---'),
    viewPolicy: { availableViews: ['card'], defaultView: 'card', cardComponent: 'entity', gridLayout: 'single-column' },
  },
  'treasury.treasurymovement': {
    label: 'treasury.treasurymovement',
    title: 'Movimiento de Tesorería',
    titlePlural: 'Movimientos de Tesorería',
    icon: ArrowRightLeft,
    iconName: 'ArrowRightLeft',
    description: 'Transacción de fondos',
    subtitleTemplate: '{movement_type_display}',
    subtitleSuffixTemplate: '{date:date}',
    shortTemplate: 'TES-{id}',
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
    description: 'Período contable anual',
    subtitleTemplate: 'EJ-{year}',
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
    feminine: true,
    description: 'Código contable del plan de cuentas',
    subtitleTemplate: '{code} · {name}',
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
    description: 'Proyección financiera',
    subtitleTemplate: '{name}',
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
    description: 'Registro contable de movimientos',
    subtitleTemplate: 'AS-{number}',
    shortTemplate: 'AS-{number}',
    listUrl: '/accounting/entries',
    detailUrlPattern: '/accounting/entries/{id}',
    viewPolicy: { availableViews: ['card'], defaultView: 'card', cardComponent: 'entity', gridLayout: 'single-column' },
  },
  'tax.taxperiod': {
    label: 'tax.taxperiod',
    title: 'Período Tributario',
    titlePlural: 'Períodos Tributarios',
    icon: Calendar,
    iconName: 'Calendar',
    description: 'Período impositivo mensual',
    subtitleTemplate: '{month_display}-{year}',
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
    description: 'Persona o entidad del registro de partners',
    subtitleTemplate: '{name}',
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
    description: 'Trabajador registrado en RRHH',
    subtitleTemplate: '{name}',
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
    feminine: true,
    description: 'Ausencia o permiso del empleado',
    subtitleTemplate: '{employee_name}',
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
    feminine: true,
    description: 'Cálculo mensual de remuneraciones',
    subtitleTemplate: 'LIQ-{id}',
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
    description: 'Adelanto de sueldo al empleado',
    subtitleTemplate: 'ANT-{id}',
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
    feminine: true,
    description: 'Actividad pendiente de un flujo de trabajo',
    subtitleTemplate: '{name}',
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
    description: 'Bitácora de transacciones bancarias',
    subtitleTemplate: '{name}',
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
    description: 'Transferencia o desembolso de fondos',
    subtitleTemplate: 'PAY-{id}',
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
    description: 'Cuenta de acceso al sistema',
    subtitleTemplate: '{username}',
    shortTemplate: '{username}',
    listUrl: '/settings/users',
    detailUrlPattern: '/settings/users/{id}',
    viewPolicy: { availableViews: ['list', 'card'], defaultView: 'list', cardComponent: 'entity' },
  },
  'core.backgroundjob': {
    label: 'core.backgroundjob',
    title: 'Proceso en Segundo Plano',
    titlePlural: 'Procesos en Segundo Plano',
    icon: RefreshCw,
    iconName: 'RefreshCw',
    description: 'Historial de tareas y procesos asíncronos',
    subtitleTemplate: '{title}',
    shortTemplate: 'JOB-{id}',
    listUrl: '/settings/jobs',
    detailUrlPattern: '/settings/jobs',
    viewPolicy: { availableViews: ['list', 'card'], defaultView: 'card', cardComponent: 'entity', gridLayout: 'multi-column' },
  },
  'settings.group': {
    label: 'settings.group',
    title: 'Grupo',
    titlePlural: 'Grupos',
    icon: Users,
    iconName: 'Users',
    description: 'Conjunto de usuarios con permisos comunes',
    subtitleTemplate: '{name}',
    shortTemplate: '{name}',
    listUrl: '/settings/users',
    detailUrlPattern: '/settings/users/{id}',
    viewPolicy: { availableViews: ['list', 'card'], defaultView: 'list', cardComponent: 'entity' },
  },
  'settings.partner': {
    label: 'settings.partner',
    title: 'Socio',
    titlePlural: 'Socios',
    icon: UserCheck,
    iconName: 'UserCheck',
    description: 'Socio colaborador con participación en resultados',
    subtitleTemplate: '{name}',
    shortTemplate: '{name}',
    listUrl: '/settings/partners',
    detailUrlPattern: '/settings/partners?selected={id}',
    viewPolicy: { availableViews: ['list'], defaultView: 'list' },
  },

  // ── Purchasing (missing entities) ──────────────────────────────────────
  'purchasing.purchasereceipt': {
    label: 'purchasing.purchasereceipt',
    title: 'Recepción de Compra',
    titlePlural: 'Recepciones de Compra',
    icon: PackageCheck,
    iconName: 'PackageCheck',
    feminine: true,
    description: 'Ingreso de mercadería comprada',
    subtitleTemplate: '{supplier_name}',
    shortTemplate: 'REC-{number}',
    listUrl: '/purchasing/receipts',
    detailUrlPattern: '/purchasing/receipts/{id}',
    partnerField: 'supplier_name',
  },
  'purchasing.purchasereturn': {
    label: 'purchasing.purchasereturn',
    title: 'Devolución de Compra',
    titlePlural: 'Devoluciones de Compra',
    icon: Undo2,
    iconName: 'Undo2',
    feminine: true,
    description: 'Devolución de mercadería al proveedor',
    subtitleTemplate: '{supplier_name}',
    shortTemplate: 'DEV-{number}',
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
    description: 'Período contable mensual',
    subtitleTemplate: '{name}',
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
    feminine: true,
    description: 'Declaración mensual de IVA',
    subtitleTemplate: 'F29-{id}',
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
    feminine: true,
    description: 'Distribución de utilidades entre socios',
    subtitleTemplate: 'RD-{id}',
    subtitleSuffixTemplate: 'Ejercicio {fiscal_year} · {resolution_date:date}',
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
    description: 'Institución financiera registrada',
    subtitleTemplate: '{name}',
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
    description: 'Forma de pago configurada',
    subtitleTemplate: '{name}',
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
    feminine: true,
    description: 'Cuenta bancaria o de efectivo',
    subtitleTemplate: '{code} · {name}',
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
    feminine: true,
    description: 'Extracto bancario importado',
    subtitleTemplate: '{treasury_account_name}',
    shortTemplate: 'CAR-{id}',
    listUrl: '/treasury/bank-center',
    detailUrlPattern: '/treasury/bank-center?statement={id}',
    viewPolicy: { availableViews: ['card'], defaultView: 'card', cardComponent: 'custom' },
  },
  'treasury.check': {
    label: 'treasury.check',
    title: 'Cheque',
    titlePlural: 'Cheques',
    icon: FileText,
    iconName: 'FileText',
    description: 'Documento de pago diferido',
    subtitleTemplate: '{bank_name}',
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
    description: 'Préstamo otorgado por una entidad financiera',
    subtitleTemplate: '{status_display} · {currency}',
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
    feminine: true,
    description: 'Límite de financiamiento disponible',
    subtitleTemplate: '{name}',
    shortTemplate: 'CL-{code}',
    listUrl: '/treasury/bank-center',
    detailUrlPattern: '/treasury/bank-center',
    viewPolicy: { availableViews: ['card'], defaultView: 'card', cardComponent: 'entity' },
  },
  'treasury.cardpendingcharge': {
    label: 'treasury.cardpendingcharge',
    title: 'Cargo No Facturado',
    titlePlural: 'Cargos No Facturados',
    icon: CreditCard,
    iconName: 'CreditCard',
    description: 'Cargo pendiente de facturación en tarjeta',
    subtitleTemplate: 'CHG-{id}',
    shortTemplate: 'CHG-{id}',
    listUrl: '/treasury/card-statements',
    detailUrlPattern: '/treasury/card-statements',
  },
  'treasury.terminal': {
    label: 'treasury.terminal',
    title: 'Terminal',
    titlePlural: 'Terminales',
    icon: Smartphone,
    iconName: 'Smartphone',
    description: 'Equipo POS o punto de venta',
    subtitleTemplate: '{name}',
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
    description: 'Empresa de servicios de pago',
    subtitleTemplate: '{name}',
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
    description: 'Hardware de cobro asignado',
    subtitleTemplate: '{name}',
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
    description: 'Lote de liquidación de transacciones',
    subtitleTemplate: 'LOT-{id}',
    subtitleSuffixTemplate: '{provider_name}',
    shortTemplate: 'LOT-{id}',
    listUrl: '/treasury/bank-center',
    detailUrlPattern: '/treasury/bank-center?batch={id}',
    viewPolicy: { availableViews: ['list'], defaultView: 'list' },
  },
  'treasury.transfer': {
    label: 'treasury.transfer',
    title: 'Traspaso',
    titlePlural: 'Traspasos',
    icon: ArrowLeftRight,
    iconName: 'ArrowLeftRight',
    description: 'Movimiento de fondos entre cuentas',
    subtitleTemplate: 'TRF-{id}',
    shortTemplate: 'TRF-{id}',
    listUrl: '/treasury/transfers',
    detailUrlPattern: '/treasury/transfers?selected={id}',
    viewPolicy: { availableViews: ['list'], defaultView: 'list' },
  },

  // ── HR (missing entities) ──────────────────────────────────────────────
  'hr.payrollconcept': {
    label: 'hr.payrollconcept',
    title: 'Concepto de Liquidación',
    titlePlural: 'Conceptos de Liquidación',
    icon: ClipboardList,
    iconName: 'ClipboardList',
    description: 'Ítem configurable de liquidación',
    subtitleTemplate: '{name}',
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
    description: 'Campo adicional definido por el usuario',
    subtitleTemplate: '{name}',
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
    feminine: true,
    description: 'Agrupación de productos',
    subtitleTemplate: '{name}',
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
    feminine: true,
    description: 'Unidad de medida para productos',
    subtitleTemplate: '{name}',
    shortTemplate: '{name}',
    listUrl: '/inventory/products/units',
    detailUrlPattern: '/inventory/products/units?selected={id}',
    viewPolicy: { availableViews: ['list'], defaultView: 'list' },
  },
  'inventory.uomcategory': {
    label: 'inventory.uomcategory',
    title: 'Categoría de Medida',
    titlePlural: 'Categorías de Medida',
    icon: Scale,
    iconName: 'Scale',
    feminine: true,
    description: 'Agrupación de unidades de medida',
    subtitleTemplate: '{name}',
    shortTemplate: '{name}',
    listUrl: '/inventory/products/units',
    detailUrlPattern: '/inventory/products/units',
  },
  'inventory.pricingrule': {
    label: 'inventory.pricingrule',
    title: 'Regla de Precio',
    titlePlural: 'Reglas de Precio',
    icon: Percent,
    iconName: 'Percent',
    feminine: true,
    description: 'Regla de cálculo de precio',
    subtitleTemplate: '{name}',
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
    feminine: true,
    description: 'Movimiento de capital de socio',
    subtitleTemplate: 'PT-{id}',
    shortTemplate: 'PT-{id}',
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
    feminine: true,
    description: 'Jornada de caja registradora',
    subtitleTemplate: 'POS-{id}',
    shortTemplate: 'POS-{id}',
    listUrl: '/pos/sessions',
    detailUrlPattern: '/pos/sessions?selected={id}',
    viewPolicy: { availableViews: ['card'], defaultView: 'card', cardComponent: 'entity' },
  },
  'pos.terminal': {
    label: 'pos.terminal',
    title: 'Caja POS',
    titlePlural: 'Cajas POS',
    icon: Monitor,
    iconName: 'Monitor',
    feminine: true,
    description: 'Punto de venta configurable',
    subtitleTemplate: '{name}',
    shortTemplate: 'POS-{name}',
    listUrl: '/pos/sessions',
    detailUrlPattern: '/pos/sessions',
  },
};

import { getDtePrefix, getDteLabel, getEntityConfig } from './api/entity-prefixes';
export { getDtePrefix, getDteLabel };

function formatTemplateDate(value: string): string {
  const dateStr = value.split('T')[0];
  const matches = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (matches) {
    const [, year, month, day] = matches;
    return `${day}/${month}/${year}`;
  }
  const date = new Date(value);
  if (isNaN(date.getTime())) return value;
  return date.toLocaleDateString('es-CL', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function templateFromData(template: string, data: Record<string, unknown>): string {
  return template.replace(/{([^}]+)}/g, (_match, key: string) => {
    const [path, format] = key.split(':');
    let value: unknown = data;

    for (const part of path.split('.')) {
      if (value !== null && typeof value === 'object') {
        value = (value as Record<string, unknown>)[part];
      } else {
        value = undefined;
      }
    }

    if (value === undefined || value === null) return '';

    if (format === 'date') {
      return formatTemplateDate(String(value));
    }

    if (format && format.startsWith('0') && format.endsWith('d')) {
      const length = parseInt(format.slice(1, -1), 10);
      return String(value).padStart(length, '0');
    }

    return String(value);
  });
}

/**
 * Renders a template string using the provided data.
 * Supports dot notation (e.g. {customer.name}) and simple padding (e.g. {id:06d}).
 *
 * Template resolution order:
 *   1. API config (from UniversalRegistry via /api/core/entity-config/)
 *   2. ENTITY_REGISTRY shortTemplate (fallback for frontend-only entities)
 *   3. data.id as last resort
 */
export function formatEntityDisplay(label: string, data: Record<string, unknown>): string {
  // 1. Try API-served template first
  const config = getEntityConfig(label);
  let template = config?.shortTemplate;

  // 2. Fallback to ENTITY_REGISTRY
  if (!template) {
    const entity = ENTITY_REGISTRY[label];
    template = entity?.shortTemplate;
  }

  // 3. Fallback to data.id
  if (!template) return String(data.id ?? '');

  // Domain-specific override for Billing Invoices (Dynamic Prefixes)
  const dteType = data.dte_type
  if (label === 'billing.invoice' && dteType) {
    const prefix = getDtePrefix(String(dteType));
    template = `${prefix}-{number}`;
  }

  // Strip legacy embedded prefix from data.number (e.g. "FACV-1002" → "1002")
  const cleanData = { ...data }
  if (label === 'billing.invoice' && dteType) {
    const rawNumber = String(data.number ?? '')
    const knownPrefixes = ['FACV', 'FACC', 'FAC-EX', 'BOL', 'BE', 'NC', 'ND', 'GUI', 'CPE', 'FACT', 'DOC']
    const allVariants = knownPrefixes.flatMap(p => [p, p.replace(/-/g, '')])

    const matchedPrefix = allVariants.find(p =>
      rawNumber.toUpperCase().startsWith(p.toUpperCase()) && rawNumber.length > p.length
    )

    if (matchedPrefix) {
      cleanData.number = rawNumber.slice(matchedPrefix.length).replace(/^[-]+/, '')
    }
  }

  return templateFromData(template, cleanData);
}

export function getEntityMetadata(label: string): EntityMetadata | undefined {
  return ENTITY_REGISTRY[label];
}

/**
 * Renders subtitleTemplate from entity metadata, or falls back to description / empty string.
 *
 * Template resolution order:
 *   1. API config subtitleTemplate (from UniversalRegistry)
 *   2. ENTITY_REGISTRY subtitleTemplate
 *   3. entity.description
 */
export function renderEntitySubtitle(label: string, data?: Record<string, unknown> | null): string | undefined {
  // 1. Try API-served template first
  const config = getEntityConfig(label);
  let subtitleTemplate = config?.subtitleTemplate;

  // 2. Fallback to ENTITY_REGISTRY
  if (!subtitleTemplate) {
    const entity = ENTITY_REGISTRY[label];
    subtitleTemplate = entity?.subtitleTemplate;
  }

  if (data && subtitleTemplate) {
    return templateFromData(subtitleTemplate, data);
  }

  const entity = ENTITY_REGISTRY[label];
  return entity?.description;
}

/**
 * Renders subtitleSuffixTemplate from entity metadata.
 * Returns undefined if no template or no data.
 */
export function renderEntitySubtitleSuffix(label: string, data?: Record<string, unknown> | null): string | undefined {
  const config = getEntityConfig(label);
  let template = config?.subtitleSuffixTemplate;
  if (!template) {
    const entity = ENTITY_REGISTRY[label];
    template = entity?.subtitleSuffixTemplate;
  }
  if (data && template) {
    return templateFromData(template, data);
  }
  return undefined;
}

export function getEntityIcon(label: string) {
  return ENTITY_REGISTRY[label]?.icon || Package;
}

export function getEntityIconName(label: string): string {
  return ENTITY_REGISTRY[label]?.iconName ?? 'Package';
}

export function getPartnerName(label: string, data: Record<string, unknown>): string {
  const entity = ENTITY_REGISTRY[label];
  if (!entity?.partnerField) return String(data.partner_name ?? data.name ?? '---');
  
  if (typeof entity.partnerField === 'function') {
    return entity.partnerField(data);
  }
  
  return String(data[entity.partnerField] ?? '---');
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




