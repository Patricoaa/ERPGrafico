"use client"

import React from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { ToolbarCreateButton, UnifiedSearchBar, bindUnifiedSearch, useUnifiedSearch } from "@/components/shared"
import { Collection, useCollectionViewMode, useEntityCollection, type FieldId } from "@/components/entity-view"
import { EmployeeDrawer, useEmployees } from "@/features/hr"
import { employeeActions, type EmployeeActionsCtx } from "@/features/hr/employeeActions"
import type { Employee } from "@/types/hr"
import { useSelectedEntity } from "@/hooks/useSelectedEntity"
import { employeeUnifiedSearchDef } from "../unifiedSearchDef"
import { employeeEntity, employeeViews } from "../entity-view/employee.entity"

interface EmployeeClientViewProps {
    initialEmployees?: Employee[]
}

/** Search group keys → entity field ids (grouping uses the formatted cell text). */
const EMPLOYEE_GROUPS: Record<string, FieldId<typeof employeeEntity.fields>> = { status: "status", contract_type: "contractType", department: "department" }

export function EmployeeClientView({ initialEmployees }: EmployeeClientViewProps) {
    const createAction = <ToolbarCreateButton label="Nuevo Empleado" href="/hr/employees?modal=new" />
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
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
    const { entity: selectedFromUrl, clearSelection } = useSelectedEntity<Employee>({
        endpoint: '/hr/employees'
    })

    const isNewModalOpen = searchParams.get("modal") === "new"
    const activeEmployee = selectedFromUrl ?? null
    const dialogOpen = isNewModalOpen || !!activeEmployee

    const setDialogOpen = (open: boolean) => {
        if (!open) {
            clearSelection()
            if (isNewModalOpen) {
                const params = new URLSearchParams(searchParams.toString())
                params.delete("modal")
                router.push(`?${params.toString()}`, { scroll: false })
            }
        }
    }

    const actionsCtx: EmployeeActionsCtx = {
        onEdit: (id) => {
            const params = new URLSearchParams(searchParams.toString())
            params.set('selected', String(id))
            router.push(`${pathname}?${params.toString()}`, { scroll: false })
        },
    }

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <Collection.Root
                collection={collection}
                view={view}
                onViewChange={onViewChange}
                onOpen={(emp) => actionsCtx.onEdit(emp.id)}
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
            <EmployeeDrawer
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                employee={activeEmployee}
                onSaved={() => {
                    setDialogOpen(false)
                    fetchEmployees()
                }}
            />
        </div>
    )
}
