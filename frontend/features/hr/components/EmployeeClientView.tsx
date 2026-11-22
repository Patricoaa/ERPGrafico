"use client"

import { EntityPanelTab, useGlobalModals } from "@/components/providers"
import { useDeepLinkEntity } from "@/hooks/useDeepLinkEntity"
import { useCreatePanelRoute } from "@/hooks/useCreatePanelRoute"
import React from "react"
import { ToolbarCreateButton, UnifiedSearchBar, bindUnifiedSearch, useUnifiedSearch } from "@/components/shared"
import { Collection, useCollectionViewMode, useEntityCollection, type FieldId } from "@/components/entity-view"
import { EmployeeDrawer, useEmployees } from "@/features/hr"
import { employeeActions, type EmployeeActionsCtx } from "@/features/hr/employeeActions"
import type { Employee } from "@/types/hr"
import { employeeUnifiedSearchDef } from "../unifiedSearchDef"
import { employeeEntity, employeeViews } from "../entity-view/employee.entity"

interface EmployeeClientViewProps {
    initialEmployees?: Employee[]
}

/** Search group keys → entity field ids (grouping uses the formatted cell text). */
const EMPLOYEE_GROUPS: Record<string, FieldId<typeof employeeEntity.fields>> = { status: "status", contract_type: "contractType", department: "department" }

export function EmployeeClientView({ initialEmployees }: EmployeeClientViewProps) {
    const createAction = <ToolbarCreateButton label="Nuevo Empleado" href="/hr/employees?modal=new" />
    const search = useUnifiedSearch(employeeUnifiedSearchDef)
    const { employees, isLoading: loading, isRefetching, refetch: fetchEmployees, error } = useEmployees(search.filters, initialEmployees)
    const groupBy = search.groupBy ? EMPLOYEE_GROUPS[search.groupBy] ?? null : null
    const { view, onViewChange } = useCollectionViewMode("hr.employee")
    const collection = useEntityCollection(
        employeeEntity,
        { rows: employees, isLoading: loading, isRefetching, error, refetch: fetchEmployees, isFiltered: search.isFiltered },
        // Groups span the whole list, not one page.
        { pagination: groupBy ? { mode: "none" } : { mode: "client", pageSize: 20 }, groupBy },
    )
    const panel = useCreatePanelRoute({ resolved: false })
    const { openEntity } = useGlobalModals()
    // ADR-0152: cada empleado abre su propia pestaña; `?selected` solo es enlace profundo.
    useDeepLinkEntity("hr.employee")

    const actionsCtx: EmployeeActionsCtx = {
        onEdit: (id) => openEntity("hr.employee", id),
    }

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <Collection.Root
                collection={collection}
                view={view}
                onViewChange={onViewChange}
                actions={employeeActions.forCollection(actionsCtx)}
            >
                <Collection.Toolbar action={createAction}>
                    <UnifiedSearchBar
                        config={employeeUnifiedSearchDef}
                        {...bindUnifiedSearch(search)}
                        placeholder="Buscar por nombre o RUT..."
                    />
                </Collection.Toolbar>
                <Collection.View
                    table={employeeViews.table}
                    card={employeeViews.card}
                    emptyTitle="Aún no hay empleados"
                    emptyDescription="Registra a tu personal para gestionar nóminas, anticipos e inasistencias."
                    emptyAction={createAction}
                    onResetFilters={search.clearAll}
                />
            </Collection.Root>
            <EntityPanelTab label="hr.employee" {...panel.tab}>
                {(open) => (
                    <EmployeeDrawer
                        open={open}
                        onOpenChange={(open) => { if (!open) panel.close() }}
                        employee={null}
                        onSaved={() => {
                            panel.close()
                            fetchEmployees()
                        }}
                    />
                )}
            </EntityPanelTab>
        </div>
    )
}
