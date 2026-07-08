/**
 * Hierarchical query-key factories para el dominio treasury.
 *
 * Sub-entidades cubiertas:
 *   - Terminal              (TERMINALS_KEYS)
 *   - TerminalBatch         (BATCHES_KEYS)
 *   - TreasuryMovement      (MOVEMENTS_KEYS)
 *   - TreasuryAccount       (TREASURY_ACCOUNTS_KEYS)
 *   - PaymentReference      (PAYMENT_REFERENCES_KEYS)
 *   - MonthlyInvoice        (MONTHLY_INVOICES_KEYS)
 *   - Bank                  (BANKS_KEYS — master data, sin detalle/edit)
 *   - PaymentMethod         (PAYMENT_METHODS_KEYS — master data)
 *
 * Patrón uniforme: invalidar `<KEYS>.all` cubre lista + detalle + sub-recursos.
 */

export const TERMINALS_KEYS = {
    all: ['terminals'] as const,
    lists: () => [...TERMINALS_KEYS.all, 'list'] as const,
    details: () => [...TERMINALS_KEYS.all, 'detail'] as const,
    detail: (id: number) => [...TERMINALS_KEYS.details(), id] as const,
}

export const BATCHES_KEYS = {
    all: ['terminal-batches'] as const,
    list: () => [...BATCHES_KEYS.all, 'list'] as const,
    detail: (id: number) => [...BATCHES_KEYS.all, 'detail', id] as const,
}

export const MOVEMENTS_KEYS = {
    all: ['treasury', 'movements'] as const,
    lists: () => [...MOVEMENTS_KEYS.all, 'list'] as const,
    details: () => [...MOVEMENTS_KEYS.all, 'detail'] as const,
    detail: (id: number) => [...MOVEMENTS_KEYS.details(), id] as const,
}

export const TREASURY_ACCOUNTS_KEYS = {
    all: ['treasury-accounts'] as const,
    lists: () => [...TREASURY_ACCOUNTS_KEYS.all, 'list'] as const,
    details: () => [...TREASURY_ACCOUNTS_KEYS.all, 'detail'] as const,
    detail: (id: number) => [...TREASURY_ACCOUNTS_KEYS.details(), id] as const,
}

export const PAYMENT_REFERENCES_KEYS = {
    all: ['payment-references'] as const,
    list: () => [...PAYMENT_REFERENCES_KEYS.all, 'list'] as const,
}

export const MONTHLY_INVOICES_KEYS = {
    all: ['monthly-invoices'] as const,
    list: () => [...MONTHLY_INVOICES_KEYS.all, 'list'] as const,
}

export const BANKS_KEYS = {
    all: ['banks'] as const,
    list: () => [...BANKS_KEYS.all, 'list'] as const,
}

export const PAYMENT_METHODS_KEYS = {
    all: ['paymentMethods'] as const,
    list: () => [...PAYMENT_METHODS_KEYS.all, 'list'] as const,
}

export const TERMINAL_PROVIDERS_KEYS = {
    all: ['terminal-providers'] as const,
    lists: () => [...TERMINAL_PROVIDERS_KEYS.all, 'list'] as const,
    details: () => [...TERMINAL_PROVIDERS_KEYS.all, 'detail'] as const,
    detail: (id: number) => [...TERMINAL_PROVIDERS_KEYS.details(), id] as const,
}

export const TERMINAL_DEVICES_KEYS = {
    all: ['terminal-devices'] as const,
    lists: () => [...TERMINAL_DEVICES_KEYS.all, 'list'] as const,
    details: () => [...TERMINAL_DEVICES_KEYS.all, 'detail'] as const,
    detail: (id: number) => [...TERMINAL_DEVICES_KEYS.details(), id] as const,
}

export const PAYMENTS_KEYS = {
    all: ['payments'] as const,
    lists: () => [...PAYMENTS_KEYS.all, 'list'] as const,
    detail: (id: number) => [...PAYMENTS_KEYS.all, 'detail', id] as const,
}

export const BANK_STATEMENTS_KEYS = {
    all: ['bank-statements'] as const,
    lists: () => [...BANK_STATEMENTS_KEYS.all, 'list'] as const,
    detail: (id: number) => [...BANK_STATEMENTS_KEYS.all, 'detail', id] as const,
}

export const CREDIT_LINES_KEYS = {
    all: ['credit-lines'] as const,
    lists: () => [...CREDIT_LINES_KEYS.all, 'list'] as const,
    details: () => [...CREDIT_LINES_KEYS.all, 'detail'] as const,
    detail: (id: number) => [...CREDIT_LINES_KEYS.details(), id] as const,
}

// ─── Legacy flat constants (deprecated — kept for backward compat) ────────────

/** @deprecated Use MOVEMENTS_KEYS.* */
export const TREASURY_MOVEMENTS_QUERY_KEY = MOVEMENTS_KEYS.all
/** @deprecated Use BANKS_KEYS.* */
export const BANKS_QUERY_KEY = BANKS_KEYS.all
/** @deprecated Use PAYMENT_METHODS_KEYS.* */
export const PAYMENT_METHODS_QUERY_KEY = PAYMENT_METHODS_KEYS.all
/** @deprecated Use TERMINALS_KEYS.* */
export const TERMINALS_QUERY_KEY = TERMINALS_KEYS.all
/** @deprecated Use TREASURY_ACCOUNTS_KEYS.* */
export const ACCOUNTS_QUERY_KEY = TREASURY_ACCOUNTS_KEYS.all
