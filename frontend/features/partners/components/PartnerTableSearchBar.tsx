"use client"

import { UnifiedSearchBar, bindUnifiedSearch } from "@/components/shared"
import type { PartnerTableSearch } from "../hooks"

/** Barra de búsqueda unificada de una tabla de la ficha del socio. */
export function PartnerTableSearchBar<T>({ table, placeholder }: { table: PartnerTableSearch<T>; placeholder: string }) {
    return <UnifiedSearchBar config={table.config} {...bindUnifiedSearch(table.search)} placeholder={placeholder} />
}
