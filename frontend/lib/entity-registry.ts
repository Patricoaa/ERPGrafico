import type { ReactNode } from 'react';
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
  availableViews: ('list' | 'card' | 'grid' | 'kanban' | 'timeline' | 'analytics')[];
  /** Default view when no ?view= param is present */
  defaultView: 'list' | 'card' | 'grid' | 'kanban';
  /** Card component strategy: 'entity' = EntityCard, 'custom' = domain-specific */
  cardComponent?: 'entity' | 'custom';
  /** Grid layout for card/grid views */
  gridLayout?: 'single-column' | 'multi-column';
  /**
   * Unified card variant — controls layout zones, field placement, and root styling.
   * - 'highlights': dashboard/summary — header only, detail/metric fields hidden
   * - 'summary': management, dense — header + metrics, detail hidden
   * - 'full': management, complete — header + detail + metrics (DEFAULT)
   */
  cardVariant?: 'highlights' | 'summary' | 'full' | 'workflow';
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

    /** Whether the entity drawer shows a print button in the header */
    printable?: boolean;
  /** Field to use for the main partner name in cards/headers */
  partnerField?: string | ((data: Record<string, unknown>) => string);
  /** Workflow status calculation strategy */
  workflowType?: 'order' | 'invoice' | 'note';
  /** Declarative view mode policy */
  viewPolicy?: ViewPolicy;
  /** Card rendering configuration for workflow entities */
  cardConfig?: {
    /** Dynamic icon className — static string or function(data) */
    iconClassName?: string | ((data: Record<string, unknown>) => string | undefined)
    /** Label for the date column ("Entrega" / "Recepción") */
    dateLabel?: string | ((data: Record<string, unknown>) => string)
    /** Static icon override (when the entity variant needs a different icon than ENTITY_REGISTRY) */
    icon?: string
    /** Workflow body configuration for variant 'workflow' */
    workflow?: {
      /** Key or resolver for line items array */
      linesKey?: string | ((data: Record<string, unknown>) => Array<Record<string, unknown>>)
      /** Key or resolver for the total value */
      totalKey?: string | ((data: Record<string, unknown>) => number)
      /** Key or resolver for pending amount */
      pendingKey?: string | ((data: Record<string, unknown>) => number | undefined)
      /** Key or resolver for delivery/receipt date */
      deliveryDateKey?: string | ((data: Record<string, unknown>) => string | undefined)
      /** Label for delivery date ("Entrega") */
      dateLabel?: string
    }
  }

  // ── Legacy subtitle fallbacks (used by renderEntitySubtitleItems / getSubtitleFieldKeys) ──
  // These are fallback mechanisms when Fields.ts meta is unavailable.
  // Prefer configuring subtitle via createEntityFields() meta param instead.

  /** @deprecated Use createEntityFields meta.subtitle.field instead */
  subtitleField?: string
  /** @deprecated Use createEntityFields meta.subtitle.renderer instead */
  subtitleRenderer?: (data: Record<string, unknown>) => SubtitleItem[]
  /** @deprecated Explicit keys excluded from card zones when subtitleRenderer is used */
  subtitleKeys?: string[]
  /** @deprecated Use createEntityFields meta.subtitle.template instead */
  subtitleTemplate?: string
  /** @deprecated Use createEntityFields meta.subtitle.suffixTemplate instead */
  subtitleSuffixTemplate?: string
}

export const ENTITY_REGISTRY: Record<string, EntityMetadata> = {
  'sales.saleorder': {
    label: 'sales.saleorder',
    title: 'Orden de Venta',
    titlePlural: 'Ordenes de Venta',
    icon: ReceiptText,
    iconName: 'ReceiptText',
    feminine: true,
    description: 'Documento de venta a cliente',
    printable: true,
    shortTemplate: 'OV-{number}',
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
    viewPolicy: { availableViews: ['list', 'card', 'analytics'], defaultView: 'card', cardComponent: 'entity', gridLayout: 'single-column', cardVariant: 'workflow' },
    cardConfig: {
      dateLabel: 'Entrega',
      workflow: {
        linesKey: 'lines',
        totalKey: (d) => parseFloat(String(d.total || 0)),
        pendingKey: (d) => { const t = parseFloat(String(d.total || 0)); const p = parseFloat(String(d.pending_amount || 0)); return t > 0 && p > 0 ? p : undefined },
        deliveryDateKey: 'delivery_date',
        dateLabel: 'Entrega',
      },
    },
  },
  'sales.saledelivery': {
    label: 'sales.saledelivery',
    title: 'Guía de Despacho',
    titlePlural: 'Guías de Despacho',
    icon: Truck,
    iconName: 'Truck',
    feminine: true,
    description: 'Registro de despacho de mercadería',
    shortTemplate: 'DES-{number}',
    listUrl: '/sales/deliveries',
    detailUrlPattern: '/sales/deliveries/{id}',
    partnerField: 'partner_name',
    viewPolicy: { availableViews: ['list', 'card'], defaultView: 'list', cardComponent: 'entity', cardVariant: 'full' },
  },
  'sales.salereturn': {
    label: 'sales.salereturn',
    title: 'Devolución',
    titlePlural: 'Devoluciones',
    icon: Undo2,
    iconName: 'Undo2',
    feminine: true,
    description: 'Anulación total o parcial de una venta',
    shortTemplate: 'DEV-{number}',
    listUrl: '/sales/returns',
    detailUrlPattern: '/sales/returns/{id}',
    partnerField: 'partner_name',
    viewPolicy: { availableViews: ['list', 'card'], defaultView: 'list', cardComponent: 'entity', cardVariant: 'full' },
  },
  'purchasing.purchaseorder': {
    label: 'purchasing.purchaseorder',
    title: 'Orden de Compra',
    titlePlural: 'Ordenes de Compra',
    icon: ShoppingCart,
    iconName: 'ShoppingCart',
    feminine: true,
    description: 'Solicitud de compra a proveedor',
    printable: true,
    shortTemplate: 'OCS-{number}',
    listUrl: '/purchasing/orders',
    detailUrlPattern: '/purchasing/orders/{id}',
    partnerField: 'supplier_name',
    workflowType: 'order',
    viewPolicy: { availableViews: ['list', 'card', 'analytics'], defaultView: 'card', cardComponent: 'entity', gridLayout: 'single-column', cardVariant: 'workflow' },
    cardConfig: {
      iconClassName: 'text-info bg-info/10',
      dateLabel: 'Recepción',
      workflow: {
        linesKey: 'lines',
        totalKey: (d) => parseFloat(String(d.total || d.effective_total || d.balance || 0)),
        pendingKey: (d) => { const t = parseFloat(String(d.total || d.effective_total || d.balance || 0)); const p = parseFloat(String(d.pending_amount || 0)); return t > 0 && p > 0 ? p : undefined },
        deliveryDateKey: (d) => String(d.delivery_date || d.receipt_date || ''),
        dateLabel: 'Recepción',
      },
    },
  },
  'billing.invoice': {
    label: 'billing.invoice',
    title: 'Factura/DTE',
    titlePlural: 'Facturas/DTEs',
    icon: FileText,
    iconName: 'FileText',
    feminine: true,
    description: 'Documento tributario electrónico',
    printable: true,
    shortTemplate: 'FAC-{number}',
    listUrl: '/billing/sales',
    detailUrlPattern: '/billing/invoices/{id}',
    partnerField: (data) => String(data.partner_name ?? data.customer_name ?? data.supplier_name ?? '---'),
    workflowType: 'invoice',
    viewPolicy: { availableViews: ['list', 'card'], defaultView: 'card', cardComponent: 'entity', gridLayout: 'single-column', cardVariant: 'workflow' },
    cardConfig: {
      iconClassName: (data) => ['NOTA_CREDITO', 'NOTA_DEBITO'].includes(String(data.dte_type ?? ''))
        ? 'text-warning bg-warning/10'
        : undefined,
      dateLabel: 'Entrega',
      workflow: {
        linesKey: 'lines',
        totalKey: (d) => parseFloat(String(d.total || 0)),
        pendingKey: (d) => { const t = parseFloat(String(d.total || 0)); const p = parseFloat(String(d.pending_amount || 0)); return t > 0 && p > 0 ? p : undefined },
        deliveryDateKey: 'delivery_date',
        dateLabel: 'Entrega',
      },
    },
  },
  'production.workorder': {
    label: 'production.workorder',
    title: 'Orden de Trabajo',
    titlePlural: 'Ordenes de Trabajo',
    icon: Wrench,
    iconName: 'Wrench',
    feminine: true,
    description: 'Instrucción de fabricación o servicio',
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
    shortTemplate: 'BOM-{id}',
    listUrl: '/production/boms',
    detailUrlPattern: '/production/boms/{id}',
    viewPolicy: { availableViews: ['list', 'card'], defaultView: 'card', cardComponent: 'entity', cardVariant: 'full' },
  },
  'inventory.stockmove': {
    label: 'inventory.stockmove',
    title: 'Movimiento de Stock',
    titlePlural: 'Kardex',
    icon: ArrowLeftRight,
    iconName: 'ArrowLeftRight',
    description: 'Entrada o salida de existencias',
    shortTemplate: 'MOV-{id}',
    listUrl: '/inventory/stock/movements',
    detailUrlPattern: '/inventory/stock-moves/{id}',
    viewPolicy: { availableViews: ['list', 'card', 'analytics'], defaultView: 'list', cardComponent: 'entity', gridLayout: 'single-column', cardVariant: 'full' },
  },
  'inventory.inventorydocument': {
    label: 'inventory.inventorydocument',
    title: 'Documento de Inventario',
    titlePlural: 'Documentos de Inventario',
    icon: FileText,
    iconName: 'FileText',
    feminine: true,
    description: 'Recepción, entrega o transferencia de mercadería',
    shortTemplate: 'DOC-{id}',
    listUrl: '/inventory/operations/documents',
    detailUrlPattern: '/inventory/operations/documents/{id}',
    printable: true,
    viewPolicy: { availableViews: ['list', 'card'], defaultView: 'card', cardComponent: 'entity', cardVariant: 'full' },
  },
  'inventory.product': {
    label: 'inventory.product',
    title: 'Producto',
    titlePlural: 'Productos',
    icon: Package,
    iconName: 'Package',
    description: 'Bien o servicio comercializable',

    shortTemplate: 'PRD-{id}',
    listUrl: '/inventory/products',
    detailUrlPattern: '/inventory/products/{id}',
    viewPolicy: { availableViews: ['list', 'card'], defaultView: 'card', cardComponent: 'entity', gridLayout: 'single-column', cardVariant: 'full' },
  },
  'inventory.subscription': {
    label: 'inventory.subscription',
    title: 'Suscripción',
    titlePlural: 'Suscripciones',
    icon: Repeat,
    iconName: 'Repeat',
    feminine: true,
    description: 'Contrato recurrente de producto o servicio',
    shortTemplate: 'SUB-{id}',
    listUrl: '/inventory/products/subscriptions',
    detailUrlPattern: '/inventory/products/{id}',
    partnerField: 'customer_name',
    viewPolicy: { availableViews: ['list', 'card'], defaultView: 'card', cardComponent: 'entity', gridLayout: 'single-column', cardVariant: 'full' },
  },
  'inventory.warehouse': {
    label: 'inventory.warehouse',
    title: 'Bodega',
    titlePlural: 'Bodegas',
    icon: Building2,
    iconName: 'Building2',
    feminine: true,
    description: 'Ubicación física de almacenaje',
    shortTemplate: '{code}',
    listUrl: '/inventory/stock/warehouses',
    detailUrlPattern: '/inventory/warehouses/{id}',
    viewPolicy: { availableViews: ['list', 'card'], defaultView: 'card', cardComponent: 'entity', cardVariant: 'highlights' },
  },
  'inventory.attribute': {
    label: 'inventory.attribute',
    title: 'Atributo',
    titlePlural: 'Atributos',
    icon: Tag,
    iconName: 'Tag',
    description: 'Propiedad variable de un producto',
    shortTemplate: '{name}',
    listUrl: '/inventory/stock/products/attributes',
    detailUrlPattern: '/inventory/stock/products/attributes',
    viewPolicy: { availableViews: ['list', 'card'], defaultView: 'list', cardComponent: 'entity', cardVariant: 'full' },
  },
  'inventory.stockreport': {
    label: 'inventory.stockreport',
    title: 'Reporte de Stock',
    titlePlural: 'Reportes de Stock',
    icon: BarChart3,
    iconName: 'BarChart3',
    description: 'Informe de existencias actuales',
    shortTemplate: '{name}',
    listUrl: '/inventory/stock/report',
    detailUrlPattern: '/inventory/stock/report',
    viewPolicy: { availableViews: ['list', 'card'], defaultView: 'list', cardComponent: 'entity', cardVariant: 'full' },
  },
  'treasury.loaninstallment': {
    label: 'treasury.loaninstallment',
    title: 'Cuota de Crédito',
    titlePlural: 'Cuotas de Crédito',
    icon: Calendar,
    iconName: 'Calendar',
    feminine: true,
    description: 'Pago periódico de un crédito',
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
    shortTemplate: 'EST-{id}',
    listUrl: '/treasury/bank-center',
    detailUrlPattern: '/treasury/bank-center?statement={id}',
    partnerField: (data) => String(data.card_account_name ?? '---'),
    viewPolicy: { availableViews: ['list', 'card', 'analytics'], defaultView: 'card', cardComponent: 'entity', gridLayout: 'single-column', cardVariant: 'full' },
  },
  'treasury.unbilled-charge': {
    label: 'treasury.unbilled-charge',
    title: 'Cargo No Facturado',
    titlePlural: 'Cargos No Facturados',
    icon: Receipt,
    iconName: 'Receipt',
    description: 'Cargo pendiente de facturación en tarjeta',
    shortTemplate: 'CNF-{id}',
    listUrl: '/treasury/bank-center',
    detailUrlPattern: '/treasury/bank-center?charge={id}',
    viewPolicy: { availableViews: ['list', 'card', 'analytics'], defaultView: 'list', cardComponent: 'entity', cardVariant: 'full' },
  },
  'treasury.treasurymovement': {
    label: 'treasury.treasurymovement',
    title: 'Movimiento de Tesorería',
    titlePlural: 'Movimientos de Tesorería',
    icon: ArrowRightLeft,
    iconName: 'ArrowRightLeft',
    description: 'Transacción de fondos',
    shortTemplate: 'TES-{id}',
    listUrl: '/treasury/operaciones/movements',
    detailUrlPattern: '/treasury/operaciones/movements?selected={id}',
    viewPolicy: { availableViews: ['list', 'card', 'analytics'], defaultView: 'card', cardComponent: 'entity', gridLayout: 'single-column', cardVariant: 'full' },
  },
  'accounting.fiscalyear': {
    label: 'accounting.fiscalyear',
    title: 'Ejercicio Contable',
    titlePlural: 'Ejercicios Contables',
    icon: Calendar,
    iconName: 'Calendar',
    description: 'Período contable anual',
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
    iconName: 'Book',
    feminine: true,
    description: 'Código contable del plan de cuentas',
    shortTemplate: '{code}',
    listUrl: '/accounting/ledger',
    detailUrlPattern: '/accounting/accounts/{id}/ledger',
    viewPolicy: { availableViews: ['list', 'card'], defaultView: 'list', cardComponent: 'entity', cardVariant: 'full' },
  },
  'accounting.budget': {
    label: 'accounting.budget',
    title: 'Presupuesto',
    titlePlural: 'Presupuestos',
    icon: PieChart,
    iconName: 'PieChart',
    description: 'Proyección financiera',
    shortTemplate: 'BUD-{id}',
    listUrl: '/finance/budgets',
    detailUrlPattern: '/finance/budgets/{id}',
    viewPolicy: { availableViews: ['list', 'card'], defaultView: 'list', cardComponent: 'entity', cardVariant: 'highlights' },
  },
  'accounting.journalentry': {
    label: 'accounting.journalentry',
    title: 'Asiento Contable',
    titlePlural: 'Libro Diario',
    icon: Hash,
    iconName: 'Hash',
    description: 'Registro contable de movimientos',
    shortTemplate: 'AS-{number}',
    listUrl: '/accounting/entries',
    detailUrlPattern: '/accounting/entries/{id}',
    viewPolicy: { availableViews: ['list', 'card'], defaultView: 'card', cardComponent: 'entity', gridLayout: 'single-column', cardVariant: 'highlights' },
  },
  'tax.taxperiod': {
    label: 'tax.taxperiod',
    title: 'Período Tributario',
    titlePlural: 'Períodos Tributarios',
    icon: Calendar,
    iconName: 'Calendar',
    description: 'Período impositivo mensual',
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
    iconName: 'Users',
    description: 'Persona o entidad del registro de partners',
    shortTemplate: 'CON-{id}',
    listUrl: '/contacts',
    detailUrlPattern: '/contacts/{id}',
    viewPolicy: { availableViews: ['list', 'card'], defaultView: 'card', cardComponent: 'entity', gridLayout: 'single-column', cardVariant: 'highlights' },
  },
  'hr.employee': {
    label: 'hr.employee',
    title: 'Empleado',
    titlePlural: 'Empleados',
    icon: UserCheck,
    iconName: 'UserCheck',
    description: 'Trabajador registrado en RRHH',
    shortTemplate: 'EMP-{id}',
    listUrl: '/hr/employees',
    detailUrlPattern: '/hr/employees/{id}',
    viewPolicy: { availableViews: ['list', 'card'], defaultView: 'card', cardComponent: 'entity', gridLayout: 'single-column', cardVariant: 'full' },
  },
  'hr.absence': {
    label: 'hr.absence',
    title: 'Inasistencia',
    titlePlural: 'Inasistencias',
    icon: CalendarX2,
    iconName: 'CalendarX2',
    feminine: true,
    description: 'Ausencia o permiso del empleado',
    shortTemplate: 'AUS-{id}',
    listUrl: '/hr/absences',
    detailUrlPattern: '/hr/absences/{id}',
    partnerField: 'employee_name',
    viewPolicy: { availableViews: ['list', 'card'], defaultView: 'card', cardComponent: 'entity', gridLayout: 'single-column', cardVariant: 'highlights' },
  },
  'hr.payroll': {
    label: 'hr.payroll',
    title: 'Liquidación de Sueldo',
    titlePlural: 'Liquidaciones de Sueldo',
    icon: Receipt,
    iconName: 'Receipt',
    feminine: true,
    description: 'Cálculo mensual de remuneraciones',
    shortTemplate: 'LIQ-{id}',
    listUrl: '/hr/payrolls',
    detailUrlPattern: '/hr/payrolls/{id}',
    viewPolicy: { availableViews: ['list', 'card', 'analytics'], defaultView: 'list', cardComponent: 'entity', cardVariant: 'full' },
  },
  'hr.salaryadvance': {
    label: 'hr.salaryadvance',
    title: 'Anticipo de Sueldo',
    titlePlural: 'Anticipos de Sueldo',
    icon: HandCoins,
    iconName: 'HandCoins',
    description: 'Adelanto de sueldo al empleado',
    shortTemplate: 'ANT-{id}',
    listUrl: '/hr/advances',
    detailUrlPattern: '/hr/advances/{id}',
    viewPolicy: { availableViews: ['list', 'card'], defaultView: 'list', cardComponent: 'entity', cardVariant: 'highlights' },
  },
  'workflow.task': {
    label: 'workflow.task',
    title: 'Tarea',
    titlePlural: 'Tareas',
    icon: ClipboardCheck,
    iconName: 'ClipboardCheck',
    feminine: true,
    description: 'Actividad pendiente de un flujo de trabajo',
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
    shortTemplate: '{username}',
    listUrl: '/settings/users',
    detailUrlPattern: '/settings/users/{id}',
    viewPolicy: { availableViews: ['list', 'card'], defaultView: 'list', cardComponent: 'entity', cardVariant: 'full' },
  },
  'core.backgroundjob': {
    label: 'core.backgroundjob',
    title: 'Proceso en Segundo Plano',
    titlePlural: 'Procesos en Segundo Plano',
    icon: RefreshCw,
    iconName: 'RefreshCw',
    description: 'Historial de tareas y procesos asíncronos',
    shortTemplate: 'JOB-{id}',
    listUrl: '/settings/jobs',
    detailUrlPattern: '/settings/jobs',
    viewPolicy: { availableViews: ['list', 'card'], defaultView: 'card', cardComponent: 'entity', gridLayout: 'multi-column', cardVariant: 'full' },
  },
  'settings.group': {
    label: 'settings.group',
    title: 'Grupo',
    titlePlural: 'Grupos',
    icon: Users,
    iconName: 'Users',
    description: 'Conjunto de usuarios con permisos comunes',
    shortTemplate: '{name}',
    listUrl: '/settings/users',
    detailUrlPattern: '/settings/users/{id}',
    viewPolicy: { availableViews: ['list', 'card'], defaultView: 'list', cardComponent: 'entity', cardVariant: 'highlights' },
  },
  'settings.partner': {
    label: 'settings.partner',
    title: 'Socio',
    titlePlural: 'Socios',
    icon: UserCheck,
    iconName: 'UserCheck',
    description: 'Socio colaborador con participación en resultados',
    shortTemplate: '{name}',
    listUrl: '/settings/partners',
    detailUrlPattern: '/settings/partners?selected={id}',
    viewPolicy: { availableViews: ['list', 'card', 'analytics'], defaultView: 'list', cardComponent: 'entity', cardVariant: 'highlights' },
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
    shortTemplate: 'REC-{number}',
    listUrl: '/purchasing/receipts',
    detailUrlPattern: '/purchasing/receipts/{id}',
    partnerField: 'supplier_name',
    viewPolicy: { availableViews: ['list', 'card'], defaultView: 'list', cardComponent: 'entity', cardVariant: 'full' },
  },
  'purchasing.purchasereturn': {
    label: 'purchasing.purchasereturn',
    title: 'Devolución de Compra',
    titlePlural: 'Devoluciones de Compra',
    icon: Undo2,
    iconName: 'Undo2',
    feminine: true,
    description: 'Devolución de mercadería al proveedor',
    shortTemplate: 'DEV-{number}',
    listUrl: '/purchasing/orders',
    detailUrlPattern: '/purchasing/returns/{id}',
    partnerField: 'supplier_name',
    viewPolicy: { availableViews: ['list', 'card'], defaultView: 'list', cardComponent: 'entity', cardVariant: 'full' },
  },

  // ── Tax ────────────────────────────────────────────────────────────────
  'tax.accountingperiod': {
    label: 'tax.accountingperiod',
    title: 'Período Contable',
    titlePlural: 'Períodos Contables',
    icon: Calendar,
    iconName: 'Calendar',
    description: 'Período contable mensual',
    shortTemplate: 'PER-{id}',
    listUrl: '/tax/declarations',
    detailUrlPattern: '/tax/periods/{id}',
    viewPolicy: { availableViews: ['list', 'card'], defaultView: 'list', cardComponent: 'entity', cardVariant: 'full' },
  },
  'tax.f29declaration': {
    label: 'tax.f29declaration',
    title: 'Declaración F29',
    titlePlural: 'Declaraciones F29',
    icon: FileText,
    iconName: 'FileText',
    feminine: true,
    description: 'Declaración mensual de IVA',
    shortTemplate: 'F29-{id}',
    listUrl: '/tax/declarations',
    detailUrlPattern: '/tax/declarations/{id}',
    viewPolicy: { availableViews: ['list', 'card'], defaultView: 'list', cardComponent: 'entity', cardVariant: 'full' },
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
    shortTemplate: 'RD-{id}',
    listUrl: '/finances/partners',
    detailUrlPattern: '/finances/partners/distributions',
    viewPolicy: { availableViews: ['list', 'card'], defaultView: 'list', cardComponent: 'entity', cardVariant: 'full' },
  },

  // ── Treasury (missing entities) ────────────────────────────────────────
  'treasury.bank': {
    label: 'treasury.bank',
    title: 'Banco',
    titlePlural: 'Bancos',
    icon: Landmark,
    iconName: 'Landmark',
    description: 'Institución financiera registrada',

    shortTemplate: '{name}',
    listUrl: '/treasury/bank-center',
    detailUrlPattern: '/treasury/bank-center/{id}/overview',
    viewPolicy: { availableViews: ['list', 'card'], defaultView: 'card', cardComponent: 'entity', gridLayout: 'multi-column', cardVariant: 'full' },
  },
  'treasury.paymentmethod': {
    label: 'treasury.paymentmethod',
    title: 'Método de Pago',
    titlePlural: 'Métodos de Pago',
    icon: CreditCard,
    iconName: 'CreditCard',
    description: 'Forma de pago configurada',
    shortTemplate: '{name}',
    listUrl: '/treasury/operaciones/methods',
    detailUrlPattern: '/treasury/operaciones/methods?selected={id}',
    viewPolicy: { availableViews: ['list', 'card'], defaultView: 'card', cardComponent: 'entity', gridLayout: 'multi-column', cardVariant: 'full' },
  },
  'treasury.treasuryaccount': {
    label: 'treasury.treasuryaccount',
    title: 'Cuenta de Tesorería',
    titlePlural: 'Cuentas de Tesorería',
    icon: Landmark,
    iconName: 'Landmark',
    feminine: true,
    description: 'Cuenta bancaria o de efectivo',

    shortTemplate: '{code}',
    listUrl: '/treasury/bank-center',
    detailUrlPattern: '/treasury/bank-center/{id}',
    viewPolicy: { availableViews: ['list', 'card'], defaultView: 'card', cardComponent: 'entity', cardVariant: 'full' },
  },
  'treasury.bankstatement': {
    label: 'treasury.bankstatement',
    title: 'Cartola Bancaria',
    titlePlural: 'Cartolas Bancarias',
    icon: BookOpen,
    iconName: 'BookOpen',
    feminine: true,
    description: 'Extracto bancario importado',
    shortTemplate: 'CAR-{id}',
    listUrl: '/treasury/bank-center',
    detailUrlPattern: '/treasury/bank-center?statement={id}',
    viewPolicy: { availableViews: ['list', 'card'], defaultView: 'card', cardComponent: 'custom' },
  },
  'treasury.check': {
    label: 'treasury.check',
    title: 'Cheque',
    titlePlural: 'Cheques',
    icon: FileText,
    iconName: 'FileText',
    description: 'Documento de pago diferido',
    shortTemplate: 'CHQ-{number}',
    listUrl: '/treasury/operaciones/movements',
    detailUrlPattern: '/treasury/operaciones/movements?check={id}',
    viewPolicy: { availableViews: ['list', 'card'], defaultView: 'list', cardComponent: 'entity', cardVariant: 'full' },
  },
  'treasury.bankloan': {
    label: 'treasury.bankloan',
    title: 'Crédito Bancario',
    titlePlural: 'Créditos Bancarios',
    icon: HandCoins,
    iconName: 'HandCoins',
    description: 'Préstamo otorgado por una entidad financiera',
    shortTemplate: 'CRE-{code}',
    listUrl: '/treasury/loans',
    detailUrlPattern: '/treasury/loans?selected={id}',
    viewPolicy: { availableViews: ['list', 'card'], defaultView: 'card', cardComponent: 'entity', cardVariant: 'summary' },
  },
  'treasury.creditline': {
    label: 'treasury.creditline',
    title: 'Línea de Crédito',
    titlePlural: 'Líneas de Crédito',
    icon: ScrollText,
    iconName: 'ScrollText',
    feminine: true,
    description: 'Límite de financiamiento disponible',
    shortTemplate: 'CL-{code}',
    listUrl: '/treasury/bank-center',
    detailUrlPattern: '/treasury/bank-center',
    viewPolicy: { availableViews: ['list', 'card'], defaultView: 'card', cardComponent: 'entity', cardVariant: 'full' },
  },
  'treasury.cardpendingcharge': {
    label: 'treasury.cardpendingcharge',
    title: 'Cargo No Facturado',
    titlePlural: 'Cargos No Facturados',
    icon: CreditCard,
    iconName: 'CreditCard',
    description: 'Cargo pendiente de facturación en tarjeta',
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
    shortTemplate: '{name}',
    listUrl: '/treasury/bank-center',
    detailUrlPattern: '/treasury/bank-center?terminal={id}',
    viewPolicy: { availableViews: ['list', 'card'], defaultView: 'list', cardComponent: 'entity', cardVariant: 'full' },
  },
  'treasury.terminalprovider': {
    label: 'treasury.terminalprovider',
    title: 'Proveedor de Pago',
    titlePlural: 'Proveedores de Pago',
    icon: Building2,
    iconName: 'Building2',
    description: 'Empresa de servicios de pago',
    shortTemplate: '{name}',
    listUrl: '/treasury/bank-center',
    detailUrlPattern: '/treasury/bank-center?provider={id}',
    viewPolicy: { availableViews: ['list', 'card'], defaultView: 'list', cardComponent: 'entity', cardVariant: 'full' },
  },
  'treasury.terminaldevice': {
    label: 'treasury.terminaldevice',
    title: 'Dispositivo',
    titlePlural: 'Dispositivos',
    icon: Smartphone,
    iconName: 'Smartphone',
    description: 'Hardware de cobro asignado',
    shortTemplate: 'DEV-{id}',
    listUrl: '/treasury/bank-center',
    detailUrlPattern: '/treasury/bank-center?device={id}',
    viewPolicy: { availableViews: ['list', 'card'], defaultView: 'list', cardComponent: 'entity', cardVariant: 'full' },
  },
  'treasury.terminalbatch': {
    label: 'treasury.terminalbatch',
    title: 'Lote de Terminal',
    titlePlural: 'Lotes de Terminal',
    icon: ClipboardCheck,
    iconName: 'ClipboardCheck',
    description: 'Lote de liquidación de transacciones',
    shortTemplate: 'LOT-{id}',
    listUrl: '/treasury/bank-center',
    detailUrlPattern: '/treasury/bank-center?batch={id}',
    viewPolicy: { availableViews: ['list', 'card'], defaultView: 'list', cardComponent: 'entity', cardVariant: 'full' },
  },
  'treasury.transfer': {
    label: 'treasury.transfer',
    title: 'Traspaso',
    titlePlural: 'Traspasos',
    icon: ArrowLeftRight,
    iconName: 'ArrowLeftRight',
    description: 'Movimiento de fondos entre cuentas',
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
    shortTemplate: 'CON-LIQ-{id}',
    listUrl: '/hr/payrolls',
    detailUrlPattern: '/hr/settings/concepts',
    viewPolicy: { availableViews: ['list', 'card'], defaultView: 'list', cardComponent: 'entity', cardVariant: 'full' },
  },

  // ── Inventory (missing entities) ───────────────────────────────────────
  'inventory.customfieldtemplate': {
    label: 'inventory.customfieldtemplate',
    title: 'Campo Personalizado',
    titlePlural: 'Campos Personalizados',
    icon: Tag,
    iconName: 'Tag',
    description: 'Campo adicional definido por el usuario',
    shortTemplate: 'CF-{id}',
    listUrl: '/inventory/products',
    detailUrlPattern: '/inventory/products/custom-fields',
    viewPolicy: { availableViews: ['list', 'card'], defaultView: 'list', cardComponent: 'entity', cardVariant: 'full' },
  },
  'inventory.category': {
    label: 'inventory.category',
    title: 'Categoría',
    titlePlural: 'Categorías',
    icon: LayoutGrid,
    iconName: 'LayoutGrid',
    feminine: true,
    description: 'Agrupación de productos',
    shortTemplate: 'CAT-{id}',
    listUrl: '/inventory/products',
    detailUrlPattern: '/inventory/products?category={id}',
    viewPolicy: { availableViews: ['list', 'card'], defaultView: 'list', cardComponent: 'entity', cardVariant: 'highlights' },
  },
  'inventory.uom': {
    label: 'inventory.uom',
    title: 'Unidad de Medida',
    titlePlural: 'Unidades de Medida',
    icon: Ruler,
    iconName: 'Ruler',
    feminine: true,
    description: 'Unidad de medida para productos',
    shortTemplate: '{name}',
    listUrl: '/inventory/products/units',
    detailUrlPattern: '/inventory/products/units?selected={id}',
    viewPolicy: { availableViews: ['list', 'card'], defaultView: 'list', cardComponent: 'entity', cardVariant: 'highlights' },
  },
  'inventory.uomcategory': {
    label: 'inventory.uomcategory',
    title: 'Categoría de Medida',
    titlePlural: 'Categorías de Medida',
    icon: Scale,
    iconName: 'Scale',
    feminine: true,
    description: 'Agrupación de unidades de medida',
    shortTemplate: '{name}',
    listUrl: '/inventory/products/units',
    detailUrlPattern: '/inventory/products/units',
    viewPolicy: { availableViews: ['list', 'card'], defaultView: 'list', cardComponent: 'entity', cardVariant: 'highlights' },
  },
  'inventory.pricingrule': {
    label: 'inventory.pricingrule',
    title: 'Regla de Precio',
    titlePlural: 'Reglas de Precio',
    icon: Percent,
    iconName: 'Percent',
    feminine: true,
    description: 'Regla de cálculo de precio',
    shortTemplate: 'REG-{id}',
    listUrl: '/inventory/products',
    detailUrlPattern: '/inventory/products?rule={id}',
    viewPolicy: { availableViews: ['list', 'card'], defaultView: 'list', cardComponent: 'entity', cardVariant: 'highlights' },
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
    shortTemplate: 'POS-{id}',
    listUrl: '/pos/sessions',
    detailUrlPattern: '/pos/sessions?selected={id}',
    viewPolicy: { availableViews: ['list', 'card'], defaultView: 'card', cardComponent: 'entity', cardVariant: 'full' },
  },
  'pos.terminal': {
    label: 'pos.terminal',
    title: 'Caja POS',
    titlePlural: 'Cajas POS',
    icon: Monitor,
    iconName: 'Monitor',
    feminine: true,
    description: 'Punto de venta configurable',
    shortTemplate: 'POS-{name}',
    listUrl: '/pos/sessions',
    detailUrlPattern: '/pos/sessions',
    viewPolicy: { availableViews: ['list', 'card'], defaultView: 'list', cardComponent: 'entity', cardVariant: 'full' },
  },

  // ── Missing entity labels (subtitle centralization) ──────────────────────
  'settings.user': {
    label: 'settings.user',
    title: 'Usuario',
    titlePlural: 'Usuarios',
    icon: User,
    iconName: 'User',
    description: 'Usuario del sistema',
    shortTemplate: '{username}',
    listUrl: '/settings/users',
    detailUrlPattern: '/settings/users',
  },
  'billing.purchaseinvoice': {
    label: 'billing.purchaseinvoice',
    title: 'Factura de Compra',
    titlePlural: 'Facturas de Compra',
    icon: Receipt,
    iconName: 'Receipt',
    feminine: true,
    description: 'Factura emitida por un proveedor',
    shortTemplate: 'FC-{id}',
    listUrl: '/billing/purchase-invoices',
    detailUrlPattern: '/billing/purchase-invoices/{id}',
  },
  'treasury.cashmovement': {
    label: 'treasury.cashmovement',
    title: 'Movimiento de Caja',
    titlePlural: 'Movimientos de Caja',
    icon: HandCoins,
    iconName: 'HandCoins',
    description: 'Entrada o salida de efectivo',
    shortTemplate: 'MC-{id}',
    listUrl: '/treasury/operaciones/movements',
    detailUrlPattern: '/treasury/operaciones/movements',
  },
  'sales.posterminal': {
    label: 'sales.posterminal',
    title: 'Caja POS',
    titlePlural: 'Cajas POS',
    icon: Monitor,
    iconName: 'Monitor',
    feminine: true,
    description: 'Punto de venta configurable',
    shortTemplate: 'POS-{name}',
    listUrl: '/pos/sessions',
    detailUrlPattern: '/pos/sessions',
  },
  'treasury.bankmovement': {
    label: 'treasury.bankmovement',
    title: 'Movimiento Bancario',
    titlePlural: 'Movimientos Bancarios',
    icon: ArrowLeftRight,
    iconName: 'ArrowLeftRight',
    description: 'Transacción bancaria registrada',
    shortTemplate: 'MB-{id}',
    listUrl: '/treasury/operaciones/movements',
    detailUrlPattern: '/treasury/operaciones/movements',
  },
  'inventory.inventorycount': {
    label: 'inventory.inventorycount',
    title: 'Conteo de Inventario',
    titlePlural: 'Conteos de Inventario',
    icon: ClipboardCheck,
    iconName: 'ClipboardCheck',
    description: 'Conteo físico de existencias',
    shortTemplate: 'CI-{id}',
    listUrl: '/inventory/stock/count',
    detailUrlPattern: '/inventory/stock/count/{id}',
  },
  'treasury.unbilledcharge': {
    label: 'treasury.unbilledcharge',
    title: 'Cargo No Facturado',
    titlePlural: 'Cargos No Facturados',
    icon: CreditCard,
    iconName: 'CreditCard',
    description: 'Cargo pendiente de facturación en tarjeta',
    shortTemplate: 'CHG-{id}',
    listUrl: '/treasury/card-statements',
    detailUrlPattern: '/treasury/card-statements',
  },
  'treasury.cardstatement': {
    label: 'treasury.cardstatement',
    title: 'Estado de Cuenta Tarjeta',
    titlePlural: 'Estados de Cuenta Tarjeta',
    icon: CreditCard,
    iconName: 'CreditCard',
    feminine: true,
    description: 'Resumen de movimientos de tarjeta',
    shortTemplate: 'ECT-{id}',
    listUrl: '/treasury/card-statements',
    detailUrlPattern: '/treasury/card-statements/{id}',
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

/**
 * Structured subtitle item — used by AutoEntityCard subtitle rendering
 * and by useDrawerIdentity for drawer subtitles (same source of truth).
 */
export type SubtitleItem =
  | { kind: 'text'; content: ReactNode }
  | { kind: 'date'; value: string | Date }
  | { kind: 'currency'; value: number; currency?: string }
  | { kind: 'status'; label: string; status: string }
  | { kind: 'chip'; content: string; intent?: string }
  | { kind: 'separator' }

/**
 * Builds a structured SubtitleItem[] from subtitleField, subtitleRenderer, or subtitleTemplate + subtitleSuffixTemplate.
 * Used by AutoEntityCard and useDrawerIdentity — single source of truth for card subtitles.
 */
export function renderEntitySubtitleItems(
  label: string,
  data?: Record<string, unknown> | null
): SubtitleItem[] {
  if (!data) {
    const desc = ENTITY_REGISTRY[label]?.description;
    return desc ? [{ kind: 'text', content: desc }] : [];
  }

  const config = getEntityConfig(label);
  const entity = ENTITY_REGISTRY[label];

  // Priority 1: subtitleRenderer function (for complex JSX/computed subtitles)
  if (entity?.subtitleRenderer) {
    return entity.subtitleRenderer(data);
  }

  // Priority 2: subtitleField — simple single-field subtitle
  if (entity?.subtitleField) {
    const value = data[entity.subtitleField];
    if (value != null) {
      const items: SubtitleItem[] = [{ kind: 'text', content: String(value) }];
      // Add suffix template if present
      const suffixTemplate = config?.subtitleSuffixTemplate ?? entity?.subtitleSuffixTemplate;
      if (suffixTemplate) {
        const suffixItems = parseTemplateToItems(suffixTemplate, data);
        if (suffixItems.length > 0) {
          items.push({ kind: 'separator' });
          items.push(...suffixItems);
        }
      }
      return items;
    }
  }

  // Priority 3: subtitleTemplate (legacy mechanism)
  const mainTemplate = config?.subtitleTemplate ?? entity?.subtitleTemplate;
  const suffixTemplate = config?.subtitleSuffixTemplate ?? entity?.subtitleSuffixTemplate;

  const items: SubtitleItem[] = [];

  if (mainTemplate) {
    items.push(...parseTemplateToItems(mainTemplate, data));
  }

  if (suffixTemplate) {
    const suffixItems = parseTemplateToItems(suffixTemplate, data);
    if (suffixItems.length > 0) {
      if (items.length > 0) {
        items.push({ kind: 'separator' });
      }
      items.push(...suffixItems);
    }
  }

  if (items.length === 0) {
    const desc = entity?.description;
    if (desc) items.push({ kind: 'text', content: desc });
  }

  return items;
}

function resolvePath(path: string, data: Record<string, unknown>): unknown {
  let value: unknown = data;
  for (const part of path.split('.')) {
    if (value !== null && typeof value === 'object') {
      value = (value as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return value;
}

function parseTemplateToItems(template: string, data: Record<string, unknown>): SubtitleItem[] {
  const items: SubtitleItem[] = [];
  const trimmed = template.trim();
  if (!trimmed) return items;
  // Support: {field}, {?field} (conditional), {f1|f2|'default'} (fallback), {field:date}, {field:currency}
  const regex = /\{(\??)([^}]+)\}/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let hasPlaceholder = false;
  while ((match = regex.exec(trimmed)) !== null) {
    hasPlaceholder = true;
    const isConditional = match[1] === '?';
    const inner = match[2];
    const [rawPath, format] = inner.split(':');
    // Fallback chain: split by '|', try each in order, skip quoted literals
    const alternatives = rawPath.split('|');
    let resolved: unknown = undefined;
    for (const alt of alternatives) {
      const a = alt.trim();
      if (a.startsWith("'") && a.endsWith("'")) {
        if (resolved == null || resolved === undefined) resolved = a.slice(1, -1);
      } else {
        const v = resolvePath(a, data);
        if (v != null) { resolved = v; break; }
      }
    }
    if (resolved == null || resolved === undefined) {
      // Conditional placeholder: also suppress the preceding literal
      if (isConditional && items.length > 0 && items[items.length - 1].kind === 'text') {
        items.pop();
      }
      lastIndex = regex.lastIndex;
      continue;
    }
    // Push literal text before this placeholder (skip if conditional and no value)
    if (match.index > lastIndex && !(isConditional && (resolved == null || resolved === undefined))) {
      items.push({ kind: 'text', content: trimmed.slice(lastIndex, match.index) });
    }
    if (format === 'date') {
      items.push({ kind: 'date', value: String(resolved) });
    } else if (format === 'currency') {
      items.push({ kind: 'currency', value: Number(resolved) });
    } else {
      items.push({ kind: 'text', content: String(resolved) });
    }
    lastIndex = regex.lastIndex;
  }
  if (!hasPlaceholder) {
    // Pure literal text (no placeholders at all)
    items.push({ kind: 'text', content: trimmed });
  } else if (lastIndex < trimmed.length) {
    // Trailing literal text after last placeholder
    items.push({ kind: 'text', content: trimmed.slice(lastIndex) });
  }
  return items;
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
  analytics:{ label: 'Análisis',  icon: BarChart3 },
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
 * Extracts field keys referenced by subtitleField, subtitleKeys, subtitleTemplate + subtitleSuffixTemplate.
 * Used by AutoEntityCard to exclude subtitle fields from other layout zones,
 * preventing duplicate rendering (e.g. customer_name in subtitle AND body).
 *
 * Checks API config first (getEntityConfig), then falls back to ENTITY_REGISTRY.
 */
export function getSubtitleFieldKeys(label: string): Set<string> {
  const config = getEntityConfig(label)
  const entity = ENTITY_REGISTRY[label]

  // Priority 1: explicit subtitleField (new mechanism)
  if (entity?.subtitleField) {
    const keys = new Set<string>([entity.subtitleField])
    // Also include subtitleKeys if present (for subtitleRenderer cases)
    if (entity.subtitleKeys) {
      for (const k of entity.subtitleKeys) keys.add(k)
    }
    return keys
  }

  // Priority 2: explicit subtitleKeys (required when subtitleRenderer is used)
  if (entity?.subtitleKeys) {
    return new Set(entity.subtitleKeys)
  }

  // Priority 3: subtitleRenderer without subtitleKeys — can't extract keys, return empty
  if (entity?.subtitleRenderer) {
    return new Set<string>()
  }

  // Priority 4: parse keys from template strings
  const mainTemplate = config?.subtitleTemplate ?? entity?.subtitleTemplate
  const suffixTemplate = config?.subtitleSuffixTemplate ?? entity?.subtitleSuffixTemplate

  const keys = new Set<string>()
  for (const tpl of [mainTemplate, suffixTemplate]) {
    if (!tpl) continue
    const regex = /\{(\??)([^}]+)\}/g
    let match: RegExpExecArray | null
    while ((match = regex.exec(tpl)) !== null) {
      const inner = match[2]
      const [rawPath] = inner.split(':')
      // Fallback chains: split by '|', skip quoted literals, take top-level key
      const alternatives = rawPath.split('|')
      for (const alt of alternatives) {
        const a = alt.trim()
        if (a.startsWith("'") && a.endsWith("'")) continue // skip literal fallbacks
        keys.add(a.split('.')[0])
      }
    }
  }
  return keys
}




