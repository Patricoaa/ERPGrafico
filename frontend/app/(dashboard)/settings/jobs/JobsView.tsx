"use client"

import { useMemo } from "react"
import { RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    UnifiedSearchBar,
    useUnifiedSearch,
    StaleDataBanner,
} from "@/components/shared"
import { useBackgroundJobs, type BackgroundJob, jobUnifiedSearchDef, backgroundJobEntity, backgroundJobViews, type BackgroundJobRow } from "@/features/settings"
import { Collection, useEntityCollection } from "@/components/entity-view"

export default function JobsView() {
    const { jobs, isLoading, isError, refetch } = useBackgroundJobs()

    const search = useUnifiedSearch(jobUnifiedSearchDef)

    const filteredJobs = useMemo(() => {
        let result = search.filterFn(jobs) as BackgroundJob[]
        if (search.filters.status) {
            result = result.filter(j => j.status === search.filters.status)
        }
        if (search.filters.job_type) {
            result = result.filter(j => j.job_type === search.filters.job_type)
        }
        return result
    }, [jobs, search])

    const collection = useEntityCollection(
        backgroundJobEntity,
        { rows: filteredJobs as BackgroundJobRow[], isLoading },
        { pagination: { mode: "none" } }
    )

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            {isError && <StaleDataBanner onRetry={() => refetch()} className="mx-4 mt-2" />}
            <Collection.Root collection={collection} label="Tareas en segundo plano">
                <Collection.Toolbar
                    views={["table", "card"]}
                    action={
                        <Button variant="outline" size="sm" onClick={() => refetch()}>
                            <RefreshCw className="w-4 h-4 mr-1" />
                            Actualizar
                        </Button>
                    }
                >
                    <UnifiedSearchBar
                        config={jobUnifiedSearchDef}
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
                        placeholder="Buscar por título, tipo o error..."
                    />
                </Collection.Toolbar>
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
