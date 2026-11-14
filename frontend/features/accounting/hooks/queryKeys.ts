export const ACCOUNTING_PERIODS_QUERY_KEY = ['accounting-periods'] as const
/** Estado del checklist de cierre de un período (cuelga de la clave de períodos: se invalida con ella). */
export const accountingPeriodStatusQueryKey = (periodId: number) => [...ACCOUNTING_PERIODS_QUERY_KEY, periodId, 'status'] as const
export const JOURNAL_ENTRIES_QUERY_KEY = ['journal-entries'] as const
export const ACCOUNTS_QUERY_KEY = ['accounts'] as const
export const ACCOUNTS_MAPPINGS_QUERY_KEY = ['accounts', 'mappings'] as const
export const LEDGER_QUERY_KEY = ['ledger'] as const // Was string before, let's keep it as array or match it
export const ACCOUNT_KEYS = {
    all: ['accounting_accounts'] as const,
    search: (search: string, isLeaf: boolean) => [...ACCOUNT_KEYS.all, 'search', { search, isLeaf }] as const,
    detail: (id: string | number) => [...ACCOUNT_KEYS.all, 'detail', id] as const,
}
export const FISCAL_YEARS_QUERY_KEY = ['fiscal-years'] as const

/** Registro de Compras y Ventas (SII). `RCV_KEYS.all` cubre documentos, importaciones y configuración. */
export const RCV_KEYS = {
    all: ['accounting-rcv'] as const,
    documents: () => [...RCV_KEYS.all, 'documents'] as const,
    document: (id: number) => [...RCV_KEYS.documents(), id] as const,
    imports: () => [...RCV_KEYS.all, 'imports'] as const,
    import: (id: number) => [...RCV_KEYS.imports(), id] as const,
    settings: () => [...RCV_KEYS.all, 'settings'] as const,
    apiKeys: () => [...RCV_KEYS.all, 'api-keys'] as const,
}
