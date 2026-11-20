/** Tabs que aún cargan del endpoint monolítico `insights` (se van migrando uno a uno a su propio bloque). */
export const LEGACY_TAB_IDS = [
    "overview", "sales", "purchases", "price", "cost", "kardex", "production", "customers", "suppliers",
] as const

export type LegacyTabId = (typeof LEGACY_TAB_IDS)[number]

export function isLegacyTab(id: string): id is LegacyTabId {
    return (LEGACY_TAB_IDS as readonly string[]).includes(id)
}
