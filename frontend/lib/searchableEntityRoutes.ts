/**
 * searchableEntityRoutes — T-88 (F8 / ADR-0020) + T-99 (F9)
 *
 * Mapa centralizado: `app.model` → `list_url` (URL de la lista donde vive el modal).
 * Usado por todos los [id]/page.tsx que emiten redirect server-side a `?selected=<id>`.
 *
 * Fuente de verdad: si cambia un slug, cambiar aquí y los redirects se actualizan solos.
 *
 * Contrato: docs/20-contracts/list-modal-edit-pattern.md §7
 * ADR: docs/10-architecture/adr/0020-modal-on-list-edit-ux.md
 *
 * ─── EXCEPCIONES (no usan redirect ?selected) ─────────────────────────────
 * Las siguientes rutas [id] son vistas standalone y NO están en este mapa:
 *   - /accounting/accounts/[id]/ledger  → Libro Mayor por cuenta (vista de datos)
 *   - /treasury/reconciliation/[id]     → Vista de reconciliación (UI propia)
 *   - /treasury/reconciliation/[id]/workbench → Mesa de Conciliación (UI compleja)
 *   - /finances/budgets/[id]            → BudgetDetailView (UI propia preexistente)
 *   - /hr/payrolls/[id]                 → PayrollDetailView (UI propia preexistente)
 *   - /billing/invoices/[id]            → Router client-side que split por is_sale_document
 *
 * ─── ENTIDADES ELIMINADAS DEL REGISTRY (F9) ──────────────────────────────
 *   - core.attachment  (T-101): sin viewset ni /files/page.tsx
 *   - tax.accountingperiod (T-100): modelo interno, colisiona con TaxPeriod
 *   - workflow.task (T-102): TaskInbox es sidebar global, no tiene página propia
 * ──────────────────────────────────────────────────────────────────────────
 */

export const searchableEntityRoutes: Record<string, string> = {
    // Sales
    'sales.saleorder':     '/sales/orders',
    'sales.saledelivery':  '/sales/orders/deliveries',
    'sales.salereturn':    '/sales/returns',

    // Purchasing
    'purchasing.purchaseorder': '/purchasing/orders',
    // purchased return/receipt: drawers desde /purchasing/orders (ADR-0022 DRAWER_ENTITIES)

    // Billing (split entries — each resolves to its own list)
    'billing.invoice_sales':     '/billing/sales',
    'billing.invoice_purchases': '/billing/purchases',

    // Contacts
    'contacts.contact': '/contacts',
    // partnertransaction / profitdistributionresolution: tabs (ADR-0022 DRAWER_ENTITIES)

    // Accounting
    // account: vive en /accounting/ledger (AccountsClientView montada ahí) — T-99
    'accounting.account':      '/accounting/ledger',
    'accounting.journalentry': '/accounting/entries',
    'accounting.fiscalyear':   '/accounting/closures',

    // Finance
    // budget: vive en /finances/budgets (vista standalone preexistente)
    // El [id]/page.tsx de budgets NO hace redirect al modal; es una página completa.

    // Inventory
    // categories/warehouses/stock-moves viven en tabs dentro de otras páginas — T-99
    'inventory.product':             '/inventory/products',
    'inventory.productcategory':     '/inventory/products/categories',
    'inventory.warehouse':           '/inventory/operations/warehouses',
    'inventory.stockmove':           '/inventory/reports/movements',
    'inventory.inventorydocument':   '/inventory/operations/documents',
    'inventory.subscription':        '/inventory/products/subscriptions',

    // Treasury
    'treasury.treasurymovement': '/treasury/operaciones/movements',
    'treasury.treasuryaccount':  '/treasury/operaciones/accounts',
    'treasury.paymentmethod':     '/treasury/operaciones/methods',
    'treasury.check':            '/treasury/operaciones/checks',
    // possession: vive en /sales/sessions (POSSessionsView) — T-99
    'treasury.possession':       '/sales/sessions',
    // bankstatement: la lista vive en /treasury/reconciliation; el detalle
    // re-navega al workbench — T-99
    'treasury.bankstatement':    '/treasury/reconciliation',
    // loans/cards/credit lines: tabs del hub /treasury/bank-center (ADR-0022 DRAWER_ENTITIES)

    // HR
    'hr.employee':       '/hr/employees',
    'hr.absence':        '/hr/absences',
    'hr.salaryadvance':  '/hr/advances',
    // payrollconcept: tab en /hr/settings/concepts (ADR-0022 DRAWER_ENTITIES)

    // Production
    'production.workorder': '/production/orders',
    'production.bom':       '/production/boms',

    // Tax
    // f29declaration: vive en /accounting/tax (TaxDeclarationsView) — T-99
    'tax.f29declaration': '/accounting/tax',
    'tax.taxperiod':      '/tax/periods',

    // Core
    'core.user': '/settings/users',

    // Removed from registry (F9):
    //   'core.attachment'       — T-101: sin endpoint ni página
    //   'tax.accountingperiod'  — T-100: modelo interno, colisiona con TaxPeriod
    //   'workflow.task'         — T-102: Sidebar global, sin ruta propia
} as const

export type SearchableEntityKey = keyof typeof searchableEntityRoutes
