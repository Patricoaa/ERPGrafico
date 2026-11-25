"use client"

import { useCallback, useEffect, useMemo } from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { formatDistanceToNow } from "date-fns"
import { es } from "date-fns/locale"
import { Collection, useCollectionQuery, useEntityCollection, useServerPage } from "@/components/entity-view"
import { Banner, Skeleton } from "@/components/shared"
import { EntityPanelTab } from "@/components/providers"
import { Button } from "@/components/ui/button"
import { useCreatePanelRoute } from "@/hooks/useCreatePanelRoute"
import { FISCAL_MATCH_PAGE_SIZE } from "../api/fiscalMatchApi"
import { useFiscalMatchCounts, useFiscalMatches } from "../hooks/useFiscalMatches"
import { fiscalMatchEntity, fiscalMatchViews } from "../entity-view/fiscalMatch.entity"
import {
    FISCAL_MATCH_STATUS_OPTIONS,
    STATUS_ATTENTION,
    fiscalMatchStatusOptions,
    selectedStatus,
    toFiscalMatchFilters,
    withDefaultFilters,
} from "../fiscalMatchFilters"
import { FiscalMatchDrawer } from "./FiscalMatchDrawer"

const GROUP_LABEL = "tax.fiscalmatch"
const DEFAULT_PAGE = { pageIndex: 0, pageSize: FISCAL_MATCH_PAGE_SIZE }

/**
 * Cuadre por grupo (ADR-0141): cada fila une el documento ERP, sus pagos TUU y su registro RCV.
 * Sin meses ni recálculos: el motor corre solo cada 10 minutos. Todos los filtros (dirección,
 * estado con conteos, tipo y fecha) viven en la barra de comandos (ADR-0158) y la tabla usa todo el alto.
 */
export function FiscalMatchClientView() {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    // `?selected={id}` abre la ficha del grupo (enlaces directos, `detailUrlPattern` del registro).
    const panel = useCreatePanelRoute({ create: false })
    // Los filtros por defecto viven en la URL: así se ven como chips y «Limpiar» vuelve a
    // ellos de forma visible. Solo escribe si faltan (tras escribir, ya no faltan: sin bucle).
    const query = searchParams.toString()
    useEffect(() => {
        const next = withDefaultFilters(query)
        if (next !== null) router.replace(`${pathname}?${next}`, { scroll: false })
    }, [query, pathname, router])
    const openGroup = useCallback((id: number) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set("selected", String(id))
        router.push(`${pathname}?${params.toString()}`, { scroll: false })
    }, [router, pathname, searchParams])
    // La ficha siguió a otro grupo (el abierto se unió y se borró): `selected` apunta al nuevo.
    const followGroup = useCallback((id: number) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set("selected", String(id))
        router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    }, [router, pathname, searchParams])
    // Los conteos se calculan desde la URL (no desde `search`) para alimentar las opciones
    // dinámicas del unified search sin circular dependencias. Ignoran el estado del filtro.
    const rawParams = useMemo(() => Object.fromEntries(searchParams.entries()), [searchParams])
    const countFilters = useMemo(() => {
        const fromUrl = toFiscalMatchFilters(rawParams)
        delete fromUrl.status
        return fromUrl
    }, [rawParams])
    const counts = useFiscalMatchCounts(countFilters)
    const statusOptions = useMemo(
        () => ({ status: counts.counts ? fiscalMatchStatusOptions(counts.counts) : FISCAL_MATCH_STATUS_OPTIONS }),
        [counts.counts],
    )
    const collectionQuery = useCollectionQuery(fiscalMatchEntity, { filterOptions: statusOptions })
    const { search } = collectionQuery
    const filters = useMemo(() => toFiscalMatchFilters(collectionQuery.params), [collectionQuery.params])

    const [pageState, setPageState] = useServerPage([filters], DEFAULT_PAGE)
    const { page, groups, isLoading, isRefetching, isError, refetch } = useFiscalMatches(filters, pageState.pageIndex + 1)
    const collection = useEntityCollection(
        fiscalMatchEntity,
        { rows: groups, rowCount: page?.count, isLoading, isRefetching, error: isError, refetch, isFiltered: search.isFiltered },
        { pagination: { mode: "server", state: pageState, onChange: setPageState } },
    )
    const attention = selectedStatus(collectionQuery.params) === STATUS_ATTENTION

    return (
        <>
            {/* Sin scroll propio: `Collection.View` gestiona el desplazamiento de las filas. */}
            <div className="flex flex-1 min-h-0 flex-col">
                {counts.counts && !counts.counts.start_date && <StartDateBanner />}
                <Collection.Root
                    collection={collection}
                    query={collectionQuery}
                    label="Cuadre"
                    selection="panel"
                    selectedId={panel.selectedId}
                    onOpen={(group) => openGroup(group.id)}
                >
                    <Collection.Toolbar />
                    <Collection.View
                        table={fiscalMatchViews.table}
                        card={fiscalMatchViews.card}
                        emptyTitle={attention ? "Nada necesita atención" : "Sin grupos de cuadre"}
                        emptyDescription={attention ? "Todos los documentos están cuadrados o excluidos." : undefined}
                        onResetFilters={search.clearAll}
                    />
                </Collection.Root>
                <CuadreInfo counts={counts} />
            </div>
            <EntityPanelTab label={GROUP_LABEL} {...panel.tab}>
                {(open) => (
                    <FiscalMatchDrawer id={panel.selectedId} open={open} onOpenChange={(o) => { if (!o) panel.close() }} onGroupChange={followGroup} />
                )}
            </EntityPanelTab>
        </>
    )
}

function StartDateBanner() {
    return (
        <Banner
            tone="warning"
            className="shrink-0"
            title="Configure la fecha de inicio del cuadre"
            actions={
                <Button asChild variant="outline">
                    <Link href="/accounting/settings/rcv">Ir a la configuración</Link>
                </Button>
            }
        >
            Sin fecha de inicio el cuadre no evalúa documentos del ERP, ventas TUU ni registros del SII.
        </Banner>
    )
}

function lastRunText(lastRunAt: string | null): string {
    if (!lastRunAt) return "Aún no hay revisiones"
    return `Última revisión: ${formatDistanceToNow(new Date(lastRunAt), { addSuffix: true, locale: es })}`
}

/** Estado del motor y de los conteos, debajo de la tabla. Los conteos ya están en el buscador. */
function CuadreInfo({ counts }: { counts: ReturnType<typeof useFiscalMatchCounts> }) {
    if (!counts.counts) {
        if (counts.isError) {
            return (
                <div className="flex shrink-0 flex-wrap items-center gap-3 text-sm text-muted-foreground">
                    <span>No se pudieron cargar los conteos del cuadre</span>
                    <Button type="button" variant="outline" size="sm" onClick={() => void counts.refetch()}>Reintentar</Button>
                </div>
            )
        }
        return counts.isLoading ? <Skeleton className="h-4 w-48 shrink-0" aria-label="Cargando conteos del cuadre" /> : null
    }
    return <p className="shrink-0 text-xs text-muted-foreground p-1">{lastRunText(counts.counts.last_run_at)}</p>
}

export default FiscalMatchClientView
