"use client"

import React, { useState, useEffect } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { AbsenceDrawer } from "@/features/hr"
import type { Absence, Employee } from "@/types/hr"
import { type ColumnDef } from "@tanstack/react-table"
import { DataTableView, DataTableColumnHeader, DataCell, EntityCard, ToolbarCreateButton, UnifiedSearchBar, useUnifiedSearch, createDateColumn } from '@/components/shared'
import { useAbsences, deleteAbsence, getEmployees, absenceActions, type AbsenceActionsCtx } from "@/features/hr"
import { absenceUnifiedSearchDef } from "@/features/hr/unifiedSearchDef"
import { useSelectedEntity } from "@/hooks/useSelectedEntity"
import { useEntityRouteActions } from "@/hooks/useEntityRouteActions"

interface AbsenceClientViewProps {
    initialAbsences?: Absence[]
}

export function AbsenceClientView({ initialAbsences }: AbsenceClientViewProps) {
    const createAction = <ToolbarCreateButton label="Nueva Inasistencia" href="/hr/absences?modal=new" />
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const search = useUnifiedSearch(absenceUnifiedSearchDef)
    const { absences, isLoading: loading, isRefetching, refetch: fetchAbsences } = useAbsences(search.filters, initialAbsences)
    const filteredAbsences = search.filterFn(absences)
    const [employees, setEmployees] = useState<Employee[]>([])

    const isNewModalOpen = searchParams.get("modal") === "new"
    const { entity: selectedFromUrl, clearSelection } = useSelectedEntity<Absence>({ endpoint: '/hr/absences' })
    const { openSelected } = useEntityRouteActions()
    const dialogOpen = isNewModalOpen || !!selectedFromUrl

    const handleClose = () => {
        clearSelection()
        if (isNewModalOpen) {
            const params = new URLSearchParams(searchParams.toString())
            params.delete("modal")
            router.replace(`${pathname}?${params.toString()}`, { scroll: false })
        }
    }

    useEffect(() => {
        getEmployees().then(setEmployees).catch(() => { })
    }, [])

    const absenceActionsCtx: AbsenceActionsCtx = {
        onEdit: (absence) => openSelected(absence.id),
        onDelete: async (id) => {
            if (!confirm("¿Eliminar esta inasistencia?")) return
            try {
                await deleteAbsence(id)
                toast.success("Inasistencia eliminada")
                fetchAbsences()
            } catch {
                toast.error("Error al eliminar inasistencia")
            }
        },
    }

    const columns: ColumnDef<Absence>[] = [
        {
            accessorKey: "employee_name",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Empleado" className="justify-center" />,
            cell: ({ row }) => <div className="flex justify-center w-full"><DataCell.Text className="font-bold">{row.getValue("employee_name")}</DataCell.Text></div>,
        },
        {
            accessorKey: "absence_type_display",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Tipo" className="justify-center" />,
            cell: ({ row }) =>
                <DataCell.Status status={row.original.absence_type} label={row.original.absence_type_display} />,
        },
        createDateColumn<Absence>("start_date", "Inicio"),
        createDateColumn<Absence>("end_date", "Fin"),
        {
            accessorKey: "days",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Días" className="justify-center" />,
            cell: ({ row }) => <div className="flex justify-center w-full"><DataCell.Text className="font-mono">{row.getValue("days")}</DataCell.Text></div>,
        },
        absenceActions.column(absenceActionsCtx),
    ]

    return (
        <div className="h-full flex flex-col">

            <AbsenceDrawer
                open={dialogOpen}
                onOpenChange={(open) => { if (!open) handleClose() }}
                absence={selectedFromUrl}
                employees={employees}
                onSaved={() => { handleClose(); fetchAbsences() }}
            />

            <div className="flex-1 min-h-0">
                <DataTableView
                    entityLabel="hr.absence"
                    columns={columns}
                    data={filteredAbsences}
                    isLoading={loading}
                    isRefetching={isRefetching}
                    variant="embedded"
                    unifiedSearch={<UnifiedSearchBar
                        config={absenceUnifiedSearchDef}
                        chips={search.chips}
                        isFiltered={search.isFiltered}
                        inputValue={search.inputValue}
                        onInputChange={search.setInputValue}
                        onApply={search.applyFilter}
                        onRemove={search.removeFilter}
                        onClearAll={search.clearAll}
                        groupBy={search.groupBy}
                        onGroupBySelect={search.setGroupBy}
                        paramValues={search.paramValues}
                        placeholder="Buscar inasistencia..."
                    />}
                    unifiedSearchConfig={absenceUnifiedSearchDef}
                    currentGroupBy={search.groupBy}
                    showReset={search.isFiltered}
                    onReset={search.clearAll}
                    defaultPageSize={20}
                    onRowClick={(row: Absence) => openSelected(row.id)}
                    createAction={createAction}
                    isFiltered={search.isFiltered}
                    emptyState={{
                        context: "users",
                        title: "Aún no hay inasistencias",
                        description: "Las ausencias, permisos y licencias que registres aparecerán aquí.",
                    }}
                    renderCard={(absence: Absence) => (
                        <EntityCard key={absence.id} onClick={() => openSelected(absence.id)}>
                            <EntityCard.Header
                                title={absence.employee_name}
                                subtitle={absence.absence_type_display}
                            />
                            <EntityCard.Body actions={absenceActions.render(absence, absenceActionsCtx)}>
                                <EntityCard.Field label="Inicio" value={absence.start_date} />
                                <EntityCard.Field label="Fin" value={absence.end_date} />
                                <EntityCard.Field label="Días" value={String(absence.days)} />
                            </EntityCard.Body>
                        </EntityCard>
                    )}
                />
            </div>
        </div>
    )
}
