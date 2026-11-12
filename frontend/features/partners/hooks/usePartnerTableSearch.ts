"use client"

import { useCallback, useMemo } from "react"
import { useUnifiedSearch, type UseUnifiedSearchReturn } from "@/components/shared"
import type { MultiSelectOption, UnifiedSearchConfig } from "@/types/unified-search"

interface PartnerTableSearchOptions<T> {
    /** Prefijo de los parámetros de URL: cada tabla de la ficha usa el suyo para no chocar con la lista ni entre sí. */
    prefix: string
    textOf: (row: T) => string
    select?: { label: string; options: MultiSelectOption[]; valueOf: (row: T) => string }
}

export interface PartnerTableSearch<T> {
    config: UnifiedSearchConfig
    search: UseUnifiedSearchReturn
    /** Aplica texto y filtro a las filas (filtrado en cliente: las tablas de la ficha son acotadas). */
    apply: (rows: T[]) => T[]
}

/** Búsqueda unificada de una tabla de la ficha del socio: texto libre y un filtro de selección opcional. */
export function usePartnerTableSearch<T>({ prefix, textOf, select }: PartnerTableSearchOptions<T>): PartnerTableSearch<T> {
    const textParam = `${prefix}_q`
    const selectParam = `${prefix}_sel`
    const selectLabel = select?.label
    const selectOptions = select?.options
    const config = useMemo<UnifiedSearchConfig>(() => ({
        searchFields: [{ key: textParam, label: "Texto", serverParam: textParam }],
        filters: selectOptions
            ? [{ type: "single", key: selectParam, label: selectLabel ?? "Filtro", serverParam: selectParam, options: selectOptions }]
            : [],
    }), [textParam, selectParam, selectLabel, selectOptions])
    const search = useUnifiedSearch(config)
    const { filters } = search
    const valueOf = select?.valueOf

    const apply = useCallback((rows: T[]) => {
        const text = filters[textParam]?.toLowerCase()
        const selected = filters[selectParam]
        return rows.filter(row =>
            (!text || textOf(row).toLowerCase().includes(text)) &&
            (!selected || !valueOf || valueOf(row) === selected),
        )
    }, [filters, textParam, selectParam, textOf, valueOf])

    return { config, search, apply }
}
