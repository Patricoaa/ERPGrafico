"use client"

import React from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { AbsenceDrawer } from "@/features/hr"
import type {Absence} from "@/types/hr"
import { type ColumnDef } from "@tanstack/react-table"
import { DataTableView, AutoEntityCard, ToolbarCreateButton, UnifiedSearchBar, useUnifiedSearch } from '@/components/shared'
import { useAbsences, deleteAbsence, absenceActions, type AbsenceActionsCtx, useEmployees } from "@/features/hr"
import { absenceUnifiedSearchDef } from "@/features/hr/unifiedSearchDef"
import { useSelectedEntity } from "@/hooks/useSelectedEntity"
import { useEntityRouteActions } from "@/hooks/useEntityRouteActions"
import { absenceFields } from '../absenceFields'

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
    const { employees } = useEmployees()

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
        ...absenceFields.toColumns(),
        absenceActions.auto(absenceActionsCtx),
    ]

    return (
        <div className="flex-1 min-h-0 flex flex-col">

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
                        <AutoEntityCard
                            key={absence.id}
                            data={absence}
                            fields={absenceFields}
                            entityLabel="hr.absence"
                            actions={absenceActions.render(absence, absenceActionsCtx)}
                            defaultAction={absenceActions.defaultAction(absenceActionsCtx)?.(absence) ?? (() => openSelected(absence.id))}

                        />
                    )}
                />
            </div>
        </div>
    )
}
