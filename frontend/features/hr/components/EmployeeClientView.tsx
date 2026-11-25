"use client"

import { EntityPanelTab, useGlobalModals } from "@/components/providers"
import { useDeepLinkEntity } from "@/hooks/useDeepLinkEntity"
import { useCreatePanelRoute } from "@/hooks/useCreatePanelRoute"
import React, { lazy, Suspense, useState } from "react"
import { DatePicker, LabeledContainer, LoadingFallback, ToolbarCreateButton } from "@/components/shared"
import { Collection, useCollectionQuery, useCollectionViewMode, useEntityCollection } from "@/components/entity-view"
import { EmployeeDrawer, useEmployees } from "@/features/hr"
import { parseDateOnly, toDateOnlyISO } from "@/lib/utils"
import { useEmployeeMutations } from "../hooks/useEmployeeMutations"
import { employeeActions, type EmployeeActionsCtx } from "@/features/hr/employeeActions"
import type { Employee } from "@/types/hr"
import { employeeEntity, employeeViews } from "../entity-view/employee.entity"

const ActionConfirmModal = lazy(() => import("@/components/shared/ActionConfirmModal").then(m => ({ default: m.ActionConfirmModal })))

interface EmployeeClientViewProps {
    initialEmployees?: Employee[]
}


export function EmployeeClientView({ initialEmployees }: EmployeeClientViewProps) {
    const createAction = <ToolbarCreateButton label="Nuevo Empleado" href="/hr/employees?modal=new" />
    const query = useCollectionQuery(employeeEntity, { sorting: "client" })
    const { search, groupBy } = query
    const { employees, isLoading: loading, isRefetching, refetch: fetchEmployees, error } = useEmployees(query.params, initialEmployees)
    const { view, onViewChange } = useCollectionViewMode("hr.employee")
    const collection = useEntityCollection(
        employeeEntity,
        { rows: employees, isLoading: loading, isRefetching, error, refetch: fetchEmployees, isFiltered: search.isFiltered },
        // Groups span the whole list, not one page.
        { pagination: groupBy ? { mode: "none" } : { mode: "client", pageSize: 20 }, groupBy, sorting: query.sorting },
    )
    const panel = useCreatePanelRoute({ resolved: false })
    const { openEntity } = useGlobalModals()
    // ADR-0152: cada empleado abre su propia pestaña; `?selected` solo es enlace profundo.
    useDeepLinkEntity("hr.employee")

    const { archiveEmployee } = useEmployeeMutations()
    const [archiveTarget, setArchiveTarget] = useState<Employee | null>(null)

    const [endDate, setEndDate] = useState("")
    const isArchiving = archiveTarget?.is_active === true

    const askArchive = (employee: Employee) => {
        setEndDate(toDateOnlyISO(new Date()))
        setArchiveTarget(employee)
    }

    const confirmArchive = async () => {
        if (!archiveTarget) return
        try {
            await archiveEmployee({
                id: archiveTarget.id,
                is_active: !archiveTarget.is_active,
                ...(archiveTarget.is_active ? { end_date: endDate } : {}),
            })
        } catch {
            // El error lo reporta el hook
        } finally {
            setArchiveTarget(null)
        }
    }

    const actionsCtx: EmployeeActionsCtx = {
        onEdit: (id) => openEntity("hr.employee", id),
        onArchive: askArchive,
    }

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <Collection.Root
                collection={collection}
                query={query}
                view={view}
                onViewChange={onViewChange}
                actions={employeeActions.forCollection(actionsCtx)}
            >
                <Collection.Toolbar action={createAction} />
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
            <Suspense fallback={<LoadingFallback />}>
                <ActionConfirmModal
                    open={archiveTarget !== null}
                    onOpenChange={(open: boolean) => { if (!open) setArchiveTarget(null) }}
                    title={archiveTarget?.is_active ? "Archivar Empleado" : "Restaurar Empleado"}
                    variant={archiveTarget?.is_active ? "warning" : "default"}
                    onConfirm={confirmArchive}
                    confirmText={isArchiving ? "Archivar" : "Restaurar"}
                    disabled={isArchiving && !endDate}
                    description={
                        isArchiving ? (
                            <div className="space-y-4">
                                <p>
                                    ¿Archivar la ficha de <strong>{archiveTarget?.contact_detail?.name}</strong>?
                                    Dejará de recibir liquidaciones automáticas y de aparecer al crear anticipos o inasistencias.
                                    Su historial se conserva y puede restaurarla más adelante.
                                </p>
                                <LabeledContainer label="Fecha de egreso" required>
                                    <DatePicker
                                        date={endDate ? parseDateOnly(endDate) : undefined}
                                        onDateChange={(d) => setEndDate(d ? toDateOnlyISO(d) : "")}
                                        className="w-full border-none bg-transparent hover:bg-transparent shadow-none"
                                    />
                                </LabeledContainer>
                            </div>
                        ) : (
                            <p>
                                ¿Restaurar la ficha de <strong>{archiveTarget?.contact_detail?.name}</strong>?
                                Se limpiará su fecha de egreso{archiveTarget?.end_date ? ` (${archiveTarget.end_date})` : ""}.
                            </p>
                        )
                    }
                />
            </Suspense>
        </div>
    )
}
