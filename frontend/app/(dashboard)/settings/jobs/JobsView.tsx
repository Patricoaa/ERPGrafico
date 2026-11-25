"use client"

import { useMemo } from "react"
import { RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { StaleDataBanner } from "@/components/shared"
import { useBackgroundJobs, backgroundJobEntity, backgroundJobViews, type BackgroundJobRow } from "@/features/settings"
import { Collection, useCollectionQuery, useEntityCollection } from "@/components/entity-view"

export default function JobsView() {
    const { jobs, isLoading, isError, refetch } = useBackgroundJobs()

    const query = useCollectionQuery(backgroundJobEntity, { sorting: "client" })
    const { search, groupBy } = query
    // Filtra en el navegador: texto libre sobre todas las columnas, estado y tipo por clave de la fila.
    const { filterFn } = search
    const filteredJobs = useMemo(() => filterFn(jobs), [filterFn, jobs])

    const collection = useEntityCollection(
        backgroundJobEntity,
        { rows: filteredJobs as BackgroundJobRow[], isLoading, isFiltered: search.isFiltered },
        { pagination: { mode: "none" }, groupBy }
    )

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            {isError && <StaleDataBanner onRetry={() => refetch()} className="mx-4 mt-2" />}
            <Collection.Root collection={collection} query={query} label="Tareas en segundo plano">
                <Collection.Toolbar
                    views={["table", "card"]}
                    action={
                        <Button variant="outline" size="sm" onClick={() => refetch()}>
                            <RefreshCw className="w-4 h-4 mr-1" />
                            Actualizar
                        </Button>
                    }
                />
                <Collection.View
                    table={backgroundJobViews.table}
                    card={backgroundJobViews.card}
                    emptyTitle="No se encontraron procesos"
                    emptyDescription="No hay registros que coincidan con los criterios de búsqueda o filtros seleccionados."
                    emptyAction={
                        <Button variant="outline" size="sm" onClick={() => refetch()}>
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Actualizar
                        </Button>
                    }
                    onResetFilters={search.isFiltered ? search.clearAll : undefined}
                />
            </Collection.Root>
        </div>
    )
}
