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
 *   - /hr/payrolls/[id]                 → PayrollDetailContent (UI propia preexistente)
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
    'sales.saledelivery':  '/sales/deliveries',
    'sales.salereturn':    '/sales/returns',

    // Purchasing
    'purchasing.purchaseorder': '/purchasing/orders',

    // Billing (split entries — each resolves to its own list)
    'billing.invoice_sales':     '/billing/sales',
    'billing.invoice_purchases': '/billing/purchases',

    // Contacts
    'contacts.contact': '/contacts',

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
    'inventory.product':         '/inventory/products',
    'inventory.productcategory': '/inventory/products?tab=categories',
    'inventory.warehouse':       '/inventory/stock?tab=warehouses',
    'inventory.stockmove':       '/inventory/stock?tab=movements',

    // Treasury
    'treasury.treasurymovement': '/treasury/movements',
    'treasury.treasuryaccount':  '/treasury/accounts',
    // possession: vive en /sales/sessions (POSSessionsView) — T-99
    'treasury.possession':       '/sales/sessions',
    // bankstatement: vive en /treasury/reconciliation tab=statements — T-99
    'treasury.bankstatement':    '/treasury/reconciliation?tab=statements',

    // HR
    'hr.employee': '/hr/employees',

    // Production
    'production.workorder': '/production/orders',

    // Tax
    // f29declaration: vive en /accounting/tax (TaxDeclarationsView) — T-99
    'tax.f29declaration': '/accounting/tax',

    // Core
    'core.user': '/settings/users',

    // Removed from registry (F9):
    //   'core.attachment'       — T-101: sin endpoint ni página
    //   'tax.accountingperiod'  — T-100: modelo interno, colisiona con TaxPeriod
    //   'workflow.task'         — T-102: Sidebar global, sin ruta propia
} as const

export type SearchableEntityKey = keyof typeof searchableEntityRoutes
