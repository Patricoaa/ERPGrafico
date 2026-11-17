"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import { es } from "date-fns/locale"
import { Collection, formatNumber, useEntityCollection, useServerPage } from "@/components/entity-view"
import {
    Banner,
    LabeledSelect,
    Section,
    Skeleton,
    StatusBadge,
    UnifiedSearchBar,
    bindUnifiedSearch,
    useUnifiedSearch,
} from "@/components/shared"
import { useGlobalModalActions } from "@/components/providers/GlobalModalProvider"
import { Button } from "@/components/ui/button"
import { useServerDate } from "@/hooks/useServerDate"
import { fiscalMatchStatusValue, type FiscalMatchStatus } from "@/lib/fiscal-match"
import { FISCAL_MATCH_PAGE_SIZE } from "../api/fiscalMatchApi"
import { useFiscalMatchCounts, useFiscalMatches, useFiscalMatchSummary, usePendingIssue } from "../hooks/useFiscalMatches"
import { fiscalMatchEntity, fiscalMatchPurchaseViews, fiscalMatchViews } from "../entity-view/fiscalMatch.entity"
import {
    monthlySummaryEntity,
    monthlySummaryViews,
    pendingIssueDocumentEntity,
    pendingIssueDocumentViews,
} from "../entity-view/fiscalMatchSummary.entity"
import {
    FISCAL_MATCH_STATUSES,
    SETTLED_STATUSES,
    STATUS_ALL,
    STATUS_ATTENTION,
    fiscalMatchUnifiedSearchDef,
    selectedStatus,
    toFiscalMatchFilters,
} from "../unifiedSearchDef"
import type { UseUnifiedSearchReturn } from "@/types/unified-search"
import type { FiscalMatchCounts, FiscalMatchFilters } from "../types/fiscalMatch"

const GROUP_LABEL = "tax.fiscalmatch"
const DEFAULT_PAGE = { pageIndex: 0, pageSize: FISCAL_MATCH_PAGE_SIZE }
const FIRST_YEAR = 2017
const MONTH_NAMES = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
]
const MONTH_OPTIONS = MONTH_NAMES.map((label, i) => ({ label, value: String(i + 1) }))

function yearOptions(current: number) {
    return Array.from({ length: current - FIRST_YEAR + 1 }, (_, i) => {
        const year = String(current - i)
        return { label: year, value: year }
    })
}

/**
 * Cuadre por grupo (ADR-0141): cada fila une el documento ERP, sus pagos TUU y su registro RCV.
 * Sin meses ni recálculos: el motor corre solo cada 10 minutos. Los conteos son filtros rápidos.
 */
export function FiscalMatchClientView() {
    const { openEntity } = useGlobalModalActions()
    const search = useUnifiedSearch(fiscalMatchUnifiedSearchDef)
    const filters = useMemo(() => toFiscalMatchFilters(search.filters), [search.filters])
    // Los conteos ignoran el estado: sin él en la clave, cambiar de estado no los vuelve a pedir.
    const countFilters = useMemo<FiscalMatchFilters>(() => ({ ...filters, status: undefined }), [filters])
    const counts = useFiscalMatchCounts(countFilters)

    const [pageState, setPageState] = useServerPage([filters], DEFAULT_PAGE)
    const { page, groups, isLoading, isRefetching, isError, refetch } = useFiscalMatches(filters, pageState.pageIndex + 1)
    const collection = useEntityCollection(
        fiscalMatchEntity,
        { rows: groups, rowCount: page?.count, isLoading, isRefetching, error: isError, refetch, isFiltered: search.isFiltered },
        { pagination: { mode: "server", state: pageState, onChange: setPageState } },
    )
    const views = filters.direction === "purchase" ? fiscalMatchPurchaseViews : fiscalMatchViews
    const attention = selectedStatus(search.filters) === STATUS_ATTENTION

    return (
        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
            <div className="space-y-8 pt-4 pb-6">
                {counts.counts && !counts.counts.start_date && <StartDateBanner />}
                <div className="space-y-3">
                    <StatusQuickFilters
                        counts={counts.counts}
                        isLoading={counts.isLoading}
                        isError={counts.isError}
                        onRetry={() => void counts.refetch()}
                        search={search}
                    />
                    <Collection.Root collection={collection} label="Cuadre" onOpen={(group) => openEntity(GROUP_LABEL, group.id)}>
                        <Collection.Toolbar>
                            <UnifiedSearchBar
                                config={fiscalMatchUnifiedSearchDef}
                                {...bindUnifiedSearch(search)}
                                placeholder="Buscar por folio, RUT o monto..."
                            />
                        </Collection.Toolbar>
                        <Collection.View
                            table={views.table}
                            card={views.card}
                            emptyTitle={attention ? "Nada necesita atención" : "Sin grupos de cuadre"}
                            emptyDescription={attention ? "Todos los documentos están cuadrados o excluidos." : undefined}
                            onResetFilters={search.clearAll}
                        />
                    </Collection.Root>
                </div>
                <PendingIssueSection />
                <MonthlySummarySection />
            </div>
        </div>
    )
}

function StartDateBanner() {
    return (
        <Banner
            tone="warning"
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

interface QuickFiltersProps {
    counts: FiscalMatchCounts | undefined
    isLoading: boolean
    isError: boolean
    onRetry: () => void
    search: UseUnifiedSearchReturn
}

/** Conteos por estado como filtros rápidos; «Necesita atención» (sin parámetro) es el filtro por defecto. */
function StatusQuickFilters({ counts, isLoading, isError, onRetry, search }: QuickFiltersProps) {
    if (!counts) {
        if (isError) {
            return (
                <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                    <span>No se pudieron cargar los conteos del cuadre</span>
                    <Button type="button" variant="outline" size="sm" onClick={onRetry}>Reintentar</Button>
                </div>
            )
        }
        return isLoading ? <Skeleton className="h-8 w-full max-w-xl" aria-label="Cargando conteos del cuadre" /> : null
    }

    const selected = selectedStatus(search.filters)
    const byStatus = counts.by_status
    const total = FISCAL_MATCH_STATUSES.reduce((sum, s) => sum + (byStatus[s] ?? 0), 0)
    const attention = FISCAL_MATCH_STATUSES.reduce((sum, s) => (SETTLED_STATUSES.includes(s) ? sum : sum + (byStatus[s] ?? 0)), 0)
    // Los estados sin grupos se omiten, salvo el elegido (si no, el filtro activo no se vería).
    const visible = FISCAL_MATCH_STATUSES.filter((s) => (byStatus[s] ?? 0) > 0 || s === selected)

    const pick = (status: FiscalMatchStatus | typeof STATUS_ALL) => void search.applyFilter("status", status)

    return (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <div role="group" aria-label="Filtros rápidos por estado" className="flex flex-wrap items-center gap-1">
                <QuickFilter
                    pressed={selected === STATUS_ATTENTION}
                    onClick={() => void search.removeFilter("status")}
                    badge={{ status: "attention", label: "Necesita atención", intent: attention > 0 ? "warning" : "neutral" }}
                    count={attention}
                />
                {visible.map((status) => (
                    <QuickFilter
                        key={status}
                        pressed={selected === status}
                        onClick={() => pick(status)}
                        badge={fiscalMatchStatusValue(status)}
                        count={byStatus[status] ?? 0}
                    />
                ))}
                <QuickFilter
                    pressed={selected === STATUS_ALL}
                    onClick={() => pick(STATUS_ALL)}
                    badge={{ status: "all", label: "Todos", intent: "neutral" }}
                    count={total}
                />
            </div>
            <span className="text-xs text-muted-foreground">{lastRunText(counts.last_run_at)}</span>
        </div>
    )
}

interface QuickFilterProps {
    pressed: boolean
    onClick: () => void
    badge: ReturnType<typeof fiscalMatchStatusValue>
    count: number
}

function QuickFilter({ pressed, onClick, badge, count }: QuickFilterProps) {
    return (
        <Button type="button" variant={pressed ? "secondary" : "ghost"} size="sm" aria-pressed={pressed} onClick={onClick} className="gap-1.5">
            <StatusBadge status={badge.status} label={badge.label} intent={badge.intent} size="sm" />
            <span className="font-mono tabular-nums">{formatNumber(count)}</span>
        </Button>
    )
}

function pendingIssueDescription(count: number): string {
    if (count === 0) return "Los borradores sin folio se emiten solos al conocerse su número fiscal."
    const noun = count === 1 ? "1 borrador espera" : `${count} borradores esperan`
    return `${noun} su número fiscal.`
}

/** Borradores 39/41/48 sin folio y por qué aún no se emiten (ADR-0140); la fila abre su grupo. */
function PendingIssueSection() {
    const { openEntity } = useGlobalModalActions()
    const { pendingIssue, isLoading, isRefetching, isError, refetch } = usePendingIssue()
    const items = pendingIssue?.items
    const count = pendingIssue?.count ?? 0
    const collection = useEntityCollection(
        pendingIssueDocumentEntity,
        { rows: items, isLoading, isRefetching, error: isError, refetch },
        { pagination: { mode: "none" } },
    )
    return (
        <Section.Scope>
            <Section.Header title="Boletas pendientes de folio" description={pendingIssueDescription(count)} />
            {items && count > items.length && (
                <Banner tone="info" className="mb-3">{`Se muestran los primeros ${items.length} de ${count}.`}</Banner>
            )}
            <Collection.Root collection={collection} label="Boletas pendientes de folio" onOpen={(doc) => openEntity(GROUP_LABEL, doc.group)}>
                <Collection.View
                    table={pendingIssueDocumentViews.table}
                    card={pendingIssueDocumentViews.card}
                    emptyTitle="No hay boletas pendientes de folio"
                />
            </Collection.Root>
        </Section.Scope>
    )
}

/** Resumen mensual 39/41/48 (alimenta el F29), con su propio mes; por defecto el mes del servidor. */
function MonthlySummarySection() {
    const server = useServerDate()
    const today = new Date()
    const [picked, setPicked] = useState<{ year?: number; month?: number }>({})
    const year = picked.year ?? server.year ?? today.getFullYear()
    const month = picked.month ?? server.month ?? today.getMonth() + 1
    const { summary, isLoading, isRefetching, isError, refetch } = useFiscalMatchSummary(year, month)
    const collection = useEntityCollection(
        monthlySummaryEntity,
        { rows: summary, isLoading, isRefetching, error: isError, refetch },
        { pagination: { mode: "none" } },
    )
    const noRcvImport = !!summary && summary.length > 0 && summary.every((s) => s.rcv_total === null)

    return (
        <Section.Scope>
            <Section.Header
                title="Resumen mensual de boletas y comprobantes"
                description="ERP frente a las ventas TUU y el RCV de ventas del SII. El 48 esperado suma los pagos con tarjeta de facturas."
                actions={
                    <div className="flex flex-wrap gap-3">
                        <LabeledSelect
                            label="Año"
                            options={yearOptions(Math.max(server.year ?? today.getFullYear(), year))}
                            value={String(year)}
                            onChange={(v) => setPicked((p) => ({ ...p, year: Number(v) }))}
                            containerClassName="w-28"
                        />
                        <LabeledSelect
                            label="Mes"
                            options={MONTH_OPTIONS}
                            value={String(month)}
                            onChange={(v) => setPicked((p) => ({ ...p, month: Number(v) }))}
                            containerClassName="w-40"
                        />
                    </div>
                }
            />
            {noRcvImport && <Banner tone="info" className="mb-3">No hay importación RCV de ventas para este mes.</Banner>}
            <Collection.Root collection={collection} label="Resumen mensual de boletas y comprobantes">
                <Collection.View table={monthlySummaryViews.table} emptyTitle="Sin resumen para el mes" />
            </Collection.Root>
        </Section.Scope>
    )
}

export default FiscalMatchClientView
