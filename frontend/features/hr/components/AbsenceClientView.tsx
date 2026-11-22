"use client"

import { EntityPanelTab, useGlobalModals } from "@/components/providers"
import React, { useMemo } from "react"

import { toast } from "sonner"
import { ToolbarCreateButton, UnifiedSearchBar, bindUnifiedSearch, useUnifiedSearch } from "@/components/shared"
import { Collection, useCollectionViewMode, useEntityCollection, type FieldId } from "@/components/entity-view"
import { AbsenceDrawer, useAbsences, deleteAbsence, absenceActions, type AbsenceActionsCtx, useEmployees } from "@/features/hr"
import { absenceUnifiedSearchDef } from "@/features/hr/unifiedSearchDef"
import type { Absence } from "@/types/hr"
import { useEntityPanelRoute } from "@/hooks/useEntityPanelRoute"
import { useDeepLinkEntity } from "@/hooks/useDeepLinkEntity"
import { absenceEntity, absenceViews } from "../entity-view/absence.entity"

interface AbsenceClientViewProps {
    initialAbsences?: Absence[]
}

/** Search group keys → entity field ids (grouping uses the formatted cell text). */
const ABSENCE_GROUPS: Record<string, FieldId<typeof absenceEntity.fields>> = { absence_type: "absenceTypeLabel" }

export function AbsenceClientView({ initialAbsences }: AbsenceClientViewProps) {
    const createAction = <ToolbarCreateButton label="Nueva Inasistencia" href="/hr/absences?modal=new" />
    const search = useUnifiedSearch(absenceUnifiedSearchDef)
    const { absences, isLoading: loading, isRefetching, isError, refetch: fetchAbsences } = useAbsences(search.filters, initialAbsences)
    const { filterFn } = search
    const rows = useMemo(() => filterFn(absences), [filterFn, absences])
    const groupBy = search.groupBy ? ABSENCE_GROUPS[search.groupBy] ?? null : null
    const { view, onViewChange } = useCollectionViewMode("hr.absence")
    // Rows are filtered here: a failed refetch with cached data must read "no results", not "error".
    const collection = useEntityCollection(
        absenceEntity,
        { rows, isLoading: loading, isRefetching, error: isError && absences.length === 0, refetch: fetchAbsences, isFiltered: search.isFiltered },
        // Groups span the whole list, not one page.
        { pagination: groupBy ? { mode: "none" } : { mode: "client", pageSize: 20 }, groupBy, defaultSort: absenceViews.table.defaultSort },
    )
    const { employees } = useEmployees()

    const panel = useEntityPanelRoute({ resolved: false })
    const { openEntity } = useGlobalModals()
    // ADR-0152: cada registro abre su propia pestaña; `?selected` solo es enlace profundo.
    useDeepLinkEntity("hr.absence")

    const absenceActionsCtx: AbsenceActionsCtx = {
        onEdit: (absence) => openEntity("hr.absence", absence.id, absence),
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

    return (
        <div className="flex-1 min-h-0 flex flex-col">

            <EntityPanelTab label="hr.absence" {...panel.tab}>
                {(open) => (
                    <AbsenceDrawer
                        open={open}
                        onOpenChange={(open) => { if (!open) panel.close() }}
                        absence={null}
                        employees={employees}
                        onSaved={() => { panel.close(); fetchAbsences() }}
                    />
                )}
            </EntityPanelTab>

            <Collection.Root
                collection={collection}
                view={view}
                onViewChange={onViewChange}
                actions={absenceActions.forCollection(absenceActionsCtx)}
            >
                <Collection.Toolbar action={createAction}>
                    <UnifiedSearchBar
                        config={absenceUnifiedSearchDef}
                        {...bindUnifiedSearch(search)}
                        placeholder="Buscar inasistencia..."
                    />
                </Collection.Toolbar>
                <Collection.View
                    table={absenceViews.table}
                    card={absenceViews.card}
                    emptyTitle="Aún no hay inasistencias"
                    emptyDescription="Las ausencias, permisos y licencias que registres aparecerán aquí."
                    emptyAction={createAction}
                    onResetFilters={search.clearAll}
                />
            </Collection.Root>
        </div>
    )
}
