/**
 * Centralized staleTime configuration for TanStack Query hooks.
 * 
 * Every feature hook should reference these values instead of hardcoding
 * millisecond constants. This ensures consistent cache lifetimes across
 * the application and makes tuning easier.
 */
export const staleTime = {
    /** Fast-changing data: server date, real-time status */
    volatile: 30 * 1000, // 30 seconds

    /** Standard list data: orders, invoices, products */
    standard: 2 * 60 * 1000, // 2 minutes

    /** Moderately stable: users, permissions, workflow config */
    stable: 5 * 60 * 1000, // 5 minutes

    /** Slow-changing data: accounts, company settings, tax periods */
    slow: 10 * 60 * 1000, // 10 minutes

    /** Reference data that almost never changes: VAT rates, payment methods */
    reference: 15 * 60 * 1000, // 15 minutes

    /** Effectively static — only refreshes on explicit invalidation */
    static: Infinity,
} as const

export type StaleTimeKey = keyof typeof staleTime
