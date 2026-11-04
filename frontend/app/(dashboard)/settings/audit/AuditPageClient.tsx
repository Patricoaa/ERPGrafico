"use client";

import { useMemo } from "react";
import { UnifiedSearchBar, useUnifiedSearch } from '@/components/shared';
import type { UnifiedSearchConfig } from '@/components/shared';
import { useAuditLogs, type GlobalAuditLog, auditLogEntity, auditLogViews, type AuditLog } from "@/features/settings";
import { Collection, useEntityCollection } from "@/components/entity-view";

interface AuditPageClientProps {
    initialLogs?: GlobalAuditLog[]
}

export default function AuditPageClient({ initialLogs }: AuditPageClientProps) {
    const { logs, loading } = useAuditLogs(initialLogs);

    const entityLabelOptions = useMemo(() =>
        Array.from(new Set(logs.map(l => l.entity_label).filter(Boolean)))
            .map(val => ({ label: val as string, value: val as string })),
        [logs]
    )

    const actionTypeOptions = useMemo(() =>
        Array.from(new Set(logs.map(l => {
            if (l.source === 'action_log') return l.action_type || 'Unknown';
            if (l.history_type === '+') return 'Creación';
            if (l.history_type === '~') return 'Edición';
            if (l.history_type === '-') return 'Eliminación';
            return 'Cambio';
        }))).filter(Boolean).map(val => ({
            label: (val === 'LOGIN' ? 'Inicio de Sesión' :
                val === 'LOGOUT' ? 'Cierre de Sesión' :
                val === 'SETTINGS_CHANGE' ? 'Configuración' :
                val === 'SECURITY' ? 'Seguridad' :
                val === 'EXPORT' ? 'Exportación' :
                val === 'PRINT' ? 'Impresión' : val) as string,
            value: val as string
        })),
        [logs]
    )

    const auditSearchConfig: UnifiedSearchConfig = useMemo(() => ({
        filters: [
            { key: 'source', label: 'Origen', type: 'multi', serverParam: 'source', options: [{ label: "Sistema", value: "action_log" }, { label: "Datos", value: "history" }] },
            { key: 'entity_label', label: 'Entidad', type: 'multi', serverParam: 'entity_label', options: entityLabelOptions },
            { key: 'action_type_label', label: 'Acción', type: 'multi', serverParam: 'action_type_label', options: actionTypeOptions },
        ],
        searchFields: [],
        groupBy: [
            { key: 'source', label: 'Origen', field: 'source' },
            { key: 'entity_label', label: 'Entidad', field: 'entity_label' },
        ],
    }), [actionTypeOptions, entityLabelOptions])

    const auditSearch = useUnifiedSearch(auditSearchConfig)

    const filteredLogs = useMemo(() => {
        let result = logs as GlobalAuditLog[]
        const { source, entity_label, action_type_label } = auditSearch.paramValues
        if (source) result = result.filter(l => l.source === source)
        if (entity_label) result = result.filter(l => (l.entity_label ?? '') === entity_label)
        if (action_type_label) {
            result = result.filter(l => {
                const computed = l.source === 'action_log'
                    ? (l.action_type || 'Unknown')
                    : l.history_type === '+' ? 'Creación'
                    : l.history_type === '~' ? 'Edición'
                    : l.history_type === '-' ? 'Eliminación'
                    : 'Cambio'
                return computed === action_type_label
            })
        }
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
