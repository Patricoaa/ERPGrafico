"use client"

import { useMemo } from "react"
import { Collection, useCollectionQuery, useEntityCollection } from "@/components/entity-view"
import { SkeletonShell } from "@/components/shared"
import { useGlobalModals } from "@/components/providers/GlobalModalProvider"
import {
    posSessionActivityEntity,
    posSessionActivityViews,
    toActivityRow,
} from "../../entity-view/posSessionDetail.entity"
import { usePOSSessionActivity } from "../../hooks/usePOSSessionDetail"

interface ActivityTabProps {
    sessionId: number
}

/**
 * Trazabilidad de la sesión: qué pasó, cuándo y quién intervino. Solo lectura, más reciente
 * primero; una corrección se registra como un evento nuevo, nunca borra el rastro. La tabla
 * ocupa el alto disponible y pagina.
 */
export function ActivityTab({ sessionId }: ActivityTabProps) {
    const { data, isLoading } = usePOSSessionActivity(sessionId)
    const { openEntity } = useGlobalModals()

    const rows = useMemo(() => (data ?? []).map((e) => ({ ...toActivityRow(e), reference_display: e.reference?.display_id ?? "" })), [data])
    const filterOptions = useMemo(
        () => ({ actor: Array.from(new Set(rows.map((r) => r.actor))).map((name) => ({ label: name, value: name })) }),
        [rows],
    )
    // Filtered in the browser over the loaded events, with its own URL keys (`activity_…`).
    const query = useCollectionQuery(posSessionActivityEntity, { sorting: "client", filterOptions, urlPrefix: "activity_" })
    const { search, groupBy } = query
    const filtered = useMemo(() => search.filterFn(rows), [search, rows])
    const collection = useEntityCollection(
        posSessionActivityEntity,
        { rows: filtered, isLoading, isFiltered: search.isFiltered },
        // Groups span every event, not one page.
        { pagination: groupBy ? { mode: "none" } : { mode: "client", pageSize: 12 }, groupBy, sorting: query.sorting },
    )

    return (
        <SkeletonShell isLoading={isLoading} ariaLabel="Cargando actividad de la sesión" className="flex flex-1 min-h-0 flex-col">
            <div className="flex flex-1 min-h-0 flex-col gap-2">
                <Collection.Root
                    collection={collection}
                    query={query}
                    label="Actividad de la sesión"
                    onOpen={(event) => { if (event.reference) openEntity(event.reference.label, event.reference.id) }}
                >
                    <Collection.Toolbar />
                    <Collection.View
                        table={posSessionActivityViews.table}
                        emptyTitle="Sin eventos"
                        emptyDescription="No hay eventos que coincidan con los filtros."
                        onResetFilters={search.clearAll}
                    />
                </Collection.Root>
            </div>
        </SkeletonShell>
    )
}
