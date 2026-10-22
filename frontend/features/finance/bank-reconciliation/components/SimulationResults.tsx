"use client"

import { SkeletonShell, StaleDataBanner } from '@/components/shared'
import { Collection, useEntityCollection } from "@/components/entity-view"
import { simulationMatchEntity, simulationMatchViews, type SimulationMatchRow } from "../entity-view/simulationMatch.entity"
import { useSimulationQuery } from "../hooks/useReconciliationQueries"

export function SimulationResults({ rule }: { rule: Record<string, unknown> }) {
    const { data: results, isLoading, isError } = useSimulationQuery(rule)
    const collection = useEntityCollection(
        simulationMatchEntity,
        { rows: (results ?? []) as SimulationMatchRow[] },
        { pagination: { mode: "none" } }
    )

    if (isLoading) return <SkeletonShell isLoading ariaLabel="Cargando..." />

    return (
        <>
            {isError && <StaleDataBanner className="mx-4 mt-2" />}
            <Collection.Root collection={collection} label="Resultados de simulación">
                <Collection.View
                    table={simulationMatchViews.table}
                    emptyTitle="Sin coincidencias"
                    emptyDescription="Ninguna línea reciente coincide con esta configuración."
                />
            </Collection.Root>
        </>
    )
}
