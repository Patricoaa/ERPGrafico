"use client";

import { useMemo } from "react";
import { useAuditLogs, type GlobalAuditLog, auditLogEntity, auditLogViews, type AuditLog } from "@/features/settings";
import { Collection, useCollectionQuery, useEntityCollection } from "@/components/entity-view";

interface AuditPageClientProps {
    initialLogs?: GlobalAuditLog[]
}

export default function AuditPageClient({ initialLogs }: AuditPageClientProps) {
    const { logs, loading } = useAuditLogs(initialLogs);

    const entityLabelOptions = useMemo(() =>
        Array.from(new Set(logs.map(l => l.entity_label).filter(Boolean)))
            .sort()
            .map(val => ({ label: val as string, value: val as string })),
        [logs]
    )

    const filterOptions = useMemo(() => ({ entity_label: entityLabelOptions }), [entityLabelOptions])
    const query = useCollectionQuery(auditLogEntity, { filterOptions, sorting: "client" })
    const { search, groupBy } = query
    // Filtra en el navegador: categoría, entidad y origen por clave de la fila (varios valores a la vez).
    const { filterFn } = search
    const filteredLogs = useMemo(() => filterFn(logs as GlobalAuditLog[]), [filterFn, logs])

    const collection = useEntityCollection(
        auditLogEntity,
        { rows: filteredLogs as AuditLog[], isLoading: loading, isFiltered: search.isFiltered },
        { pagination: groupBy ? { mode: "none" } : { mode: "client", pageSize: 25 }, groupBy }
    )

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <Collection.Root collection={collection} query={query} label="Registro de auditoría">
                <Collection.Toolbar views={["table"]} />
                <Collection.View
                    table={auditLogViews.table}
                    emptyTitle="Sin registros de auditoría"
                    emptyDescription="No hay eventos que coincidan con los filtros seleccionados."
                    onResetFilters={search.isFiltered ? search.clearAll : undefined}
                />
            </Collection.Root>
        </div>
    );
}
