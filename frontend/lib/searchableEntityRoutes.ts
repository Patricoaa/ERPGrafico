/**
 * searchableEntityRoutes — T-88 (F8 / ADR-0020)
 *
 * Mapa centralizado: `app.model` → `list_url` (URL de la lista donde vive el modal).
 * Usado por todos los [id]/page.tsx que emiten redirect server-side a `?selected=<id>`.
 *
 * Fuente de verdad: si cambia un slug, cambiar aquí y los 29 redirects se actualizan solos.
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
    'accounting.account':     '/accounting/accounts',
    'accounting.journalentry': '/accounting/entries',
    'accounting.fiscalyear':   '/accounting/closures',

    // Inventory
    'inventory.product':         '/inventory/products',
    'inventory.productcategory': '/inventory/categories',
    'inventory.warehouse':       '/inventory/warehouses',
    'inventory.stockmove':       '/inventory/stock-moves',

    // Treasury
    'treasury.treasurymovement': '/treasury/movements',
    'treasury.treasuryaccount':  '/treasury/accounts',
    'treasury.possession':       '/treasury/sessions',
    'treasury.bankstatement':    '/treasury/statements',

    // HR
    'hr.employee': '/hr/employees',

    // Production
    'production.workorder': '/production/orders',

    // Tax
    'tax.f29declaration':    '/tax/f29',
    'tax.accountingperiod':  '/tax/periods',

    // Workflow
    'workflow.task': '/workflow/tasks',

    // Core
    'core.user':       '/settings/users',
    'core.attachment': '/files',
} as const

export type SearchableEntityKey = keyof typeof searchableEntityRoutes
