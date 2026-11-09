"use client";

import { useMemo } from "react";
import { UnifiedSearchBar, useUnifiedSearch } from '@/components/shared';
import type { UnifiedSearchConfig } from '@/components/shared';
import { useAuditLogs, type GlobalAuditLog, auditLogEntity, auditLogViews, type AuditLog } from "@/features/settings";
import { Collection, useEntityCollection } from "@/components/entity-view";

interface AuditPageClientProps {
    initialLogs?: GlobalAuditLog[]
}

const CATEGORY_OPTIONS = [
    { label: "Negocio", value: "business" },
    { label: "Seguridad", value: "security" },
    { label: "Técnico", value: "technical" },
    { label: "Config", value: "config" },
]

export default function AuditPageClient({ initialLogs }: AuditPageClientProps) {
    const { logs, loading } = useAuditLogs(initialLogs);

    const entityLabelOptions = useMemo(() =>
        Array.from(new Set(logs.map(l => l.entity_label).filter(Boolean)))
            .sort()
            .map(val => ({ label: val as string, value: val as string })),
        [logs]
    )

    const auditSearchConfig: UnifiedSearchConfig = useMemo(() => ({
        filters: [
            {
                key: 'category',
                label: 'Categoría',
                type: 'multi',
                serverParam: 'category',
                options: CATEGORY_OPTIONS,
            },
            {
                key: 'entity_label',
                label: 'Entidad',
                type: 'multi',
                serverParam: 'entity_label',
                options: entityLabelOptions,
            },
            {
                key: 'source',
                label: 'Origen',
                type: 'multi',
                serverParam: 'source',
                options: [
                    { label: "Sistema", value: "action_log" },
                    { label: "Datos", value: "history" },
                ],
            },
        ],
        searchFields: [],
        groupBy: [
            { key: 'category', label: 'Categoría', field: 'category' },
            { key: 'entity_label', label: 'Entidad', field: 'entity_label' },
        ],
    }), [entityLabelOptions])

    const auditSearch = useUnifiedSearch(auditSearchConfig)

    const filteredLogs = useMemo(() => {
        let result = logs as GlobalAuditLog[]
        const { category, entity_label, source } = auditSearch.paramValues
        if (category) result = result.filter(l => l.category === category)
        if (entity_label) result = result.filter(l => (l.entity_label ?? '') === entity_label)
        if (source) result = result.filter(l => l.source === source)
        return result
    }, [logs, auditSearch.paramValues])

    const collection = useEntityCollection(
        auditLogEntity,
        { rows: filteredLogs as AuditLog[], isLoading: loading },
        { pagination: { mode: "client", pageSize: 25 } }
    )

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <Collection.Root collection={collection} label="Registro de auditoría">
                <Collection.Toolbar views={["table"]}>
                    <UnifiedSearchBar
                        config={auditSearchConfig}
                        chips={auditSearch.chips}
                        isFiltered={auditSearch.isFiltered}
                        inputValue={auditSearch.inputValue}
                        onInputChange={auditSearch.setInputValue}
                        onApply={auditSearch.applyFilter}
                        onRemove={auditSearch.removeFilter}
                        onClearAll={auditSearch.clearAll}
                        groupBy={auditSearch.groupBy}
                        onGroupBySelect={auditSearch.setGroupBy}
                        paramValues={auditSearch.paramValues}
                    />
                </Collection.Toolbar>
                <Collection.View
                    table={auditLogViews.table}
                    emptyTitle="Sin registros de auditoría"
                    emptyDescription="No hay eventos que coincidan con los filtros seleccionados."
                    onResetFilters={auditSearch.isFiltered ? auditSearch.clearAll : undefined}
                />
            </Collection.Root>
        </div>
    );
}
