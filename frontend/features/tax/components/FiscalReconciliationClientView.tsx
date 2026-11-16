"use client"

import { useState, type ReactNode } from "react"
import Link from "next/link"
import { Banner, EmptyState, FadeIn, LabeledSelect, Section, SkeletonShell, StatusBadge } from "@/components/shared"
import { Collection, useEntityCollection } from "@/components/entity-view"
import { Can } from "@/components/auth"
import { useGlobalModalActions } from "@/components/providers/GlobalModalProvider"
import { Button } from "@/components/ui/button"
import { matchStatusValue, type MatchStatus } from "@/lib/fiscal-match"
import { useFiscalReconciliation, useRunReconciliation } from "../hooks/useFiscalReconciliation"
import {
    onlyErpDocumentEntity,
    onlyErpDocumentViews,
    reconciliationSummaryEntity,
    reconciliationSummaryViews,
} from "../entity-view/fiscalReconciliation.entity"
import type { DocumentMatchCounts, FiscalReconciliationReport, MatchCounts, ReconciliationSource } from "../types/reconciliation"

const RUN_PERMISSION = "tax.change_taxperiod"
const FIRST_YEAR = 2017
const MONTH_NAMES = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
]
const MONTH_OPTIONS = MONTH_NAMES.map((label, i) => ({ label, value: String(i + 1) }))

/** Orden fijo de los conteos; `""` (no evaluado) se omite. */
const STATUS_ORDER: Exclude<MatchStatus, "">[] = [
    "MATCHED", "AMOUNT_DIFF", "TYPE_DIFF", "AMBIGUOUS", "PENDING_ERP", "ONLY_EXTERNAL", "ONLY_ERP", "EXCLUDED",
]

type Direction = "purchase" | "sale"
const DIRECTIONS: { key: Direction; title: string; noun: string; href: string }[] = [
    { key: "purchase", title: "Compras", noun: "compras", href: "/accounting/rcv/purchases" },
    { key: "sale", title: "Ventas", noun: "ventas", href: "/accounting/rcv/sales" },
]

function yearOptions(current: number) {
    return Array.from({ length: current - FIRST_YEAR + 1 }, (_, i) => {
        const year = String(current - i)
        return { label: year, value: year }
    })
}

/** `null` = no se puede saber (p. ej. `ONLY_ERP` sin importación RCV); se muestra «—». */
function countEntries(counts: MatchCounts | DocumentMatchCounts) {
    return STATUS_ORDER.flatMap((status) => {
        const count = counts[status]
        return count === undefined ? [] : [{ status, count }]
    })
}

function isEmptyReport(report: FiscalReconciliationReport): boolean {
    const total = (counts: MatchCounts | DocumentMatchCounts) => STATUS_ORDER.reduce((sum, s) => sum + (counts[s] ?? 0), 0)
    const summaries = report.summaries.every((s) => s.erp_count === 0 && s.tuu_count === 0 && !s.rcv_count)
    return summaries
        && report.only_erp.length === 0
        && total(report.documents.purchase) === 0
        && total(report.documents.sale) === 0
        && total(report.terminal) === 0
}

/**
 * Cuadre fiscal del período: ERP frente a TUU (boletas y comprobantes) y frente al RCV del SII
 * (facturas y notas). Solo lectura salvo los recálculos, que nunca tocan documentos del ERP (ADR-0138).
 */
export function FiscalReconciliationClientView() {
    const today = new Date()
    const [year, setYear] = useState(today.getFullYear())
    const [month, setMonth] = useState(today.getMonth() + 1)
    const { report, isLoading, isError, refetch } = useFiscalReconciliation(year, month)
    const run = useRunReconciliation()

    const recalc = (source: ReconciliationSource) => {
        void run.mutateAsync({ source, year, month }).catch(() => undefined)
    }

    let body: ReactNode
    if (isError && !report) {
        body = (
            <Banner
                tone="destructive"
                title="No se pudo cargar el cuadre fiscal"
                actions={<Button type="button" variant="outline" onClick={() => void refetch()}>Reintentar</Button>}
            >
                Revisa tu conexión e intenta nuevamente.
            </Banner>
        )
    } else {
        body = (
            <SkeletonShell isLoading={isLoading || !report} ariaLabel="Cargando cuadre fiscal">
                {report && <ReconciliationBody report={report} year={year} month={month} />}
            </SkeletonShell>
        )
    }

    return (
        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
            <FadeIn className="max-w-6xl mx-auto">
                <div className="space-y-6 mt-6 pb-6">
                    <div className="flex flex-wrap items-end justify-between gap-3">
                        <div className="flex flex-wrap gap-3">
                            <LabeledSelect
                                label="Año"
                                options={yearOptions(today.getFullYear())}
                                value={String(year)}
                                onChange={(v) => setYear(Number(v))}
                                containerClassName="w-32"
                            />
                            <LabeledSelect
                                label="Mes"
                                options={MONTH_OPTIONS}
                                value={String(month)}
                                onChange={(v) => setMonth(Number(v))}
                                containerClassName="w-44"
                            />
                        </div>
                        <Can permission={RUN_PERMISSION}>
                            <div className="flex gap-2">
                                <Button type="button" variant="outline" disabled={run.isPending} onClick={() => recalc("rcv")}>
                                    Recalcular RCV
                                </Button>
                                <Button type="button" variant="outline" disabled={run.isPending} onClick={() => recalc("terminal")}>
                                    Recalcular TUU
                                </Button>
                            </div>
                        </Can>
                    </div>
                    {body}
                </div>
            </FadeIn>
        </div>
    )
}

function ReconciliationBody({ report, year, month }: { report: FiscalReconciliationReport; year: number; month: number }) {
    const startBanner = !report.start_date && (
        <Banner
            tone="warning"
            title="Configure la fecha de inicio del cuadre"
            actions={
                <Button asChild variant="outline">
                    <Link href="/accounting/settings/rcv">Ir a la configuración</Link>
                </Button>
            }
        >
            Sin fecha de inicio no se buscan documentos del ERP que falten en el SII o en TUU.
        </Banner>
    )

    if (isEmptyReport(report)) {
        return (
            <div className="space-y-6">
                {startBanner}
                <EmptyState
                    context="generic"
                    title="Sin documentos en el período"
                    description="No hay documentos del ERP, ventas TUU ni registros del SII para este mes."
                />
            </div>
        )
    }

    return (
        <div className="space-y-8">
            {startBanner}
            <SummariesSection report={report} />
            <DocumentsSection report={report} year={year} month={month} />
            <OnlyErpSection report={report} />
        </div>
    )
}

function StatusCountRow({ status, count, noun, href }: { status: Exclude<MatchStatus, "">; count: number | null; noun: string; href?: string }) {
    const badge = matchStatusValue(status)
    return (
        <Section.Row
            title={<StatusBadge status={badge.status} label={badge.label} intent={badge.intent} size="sm" />}
            value={
                count === null ? (
                    "—"
                ) : href && count > 0 ? (
                    <Link href={href} className="font-medium text-primary hover:underline" aria-label={`${count} ${noun} ${badge.label}`}>
                        {count}
                    </Link>
                ) : (
                    count
                )
            }
        />
    )
}

function SummariesSection({ report }: { report: FiscalReconciliationReport }) {
    const collection = useEntityCollection(reconciliationSummaryEntity, { rows: report.summaries }, { pagination: { mode: "none" } })
    const noRcvImport = report.summaries.every((s) => s.rcv_total === null)
    const terminal = countEntries(report.terminal)

    return (
        <div className="space-y-4">
            <Section.Scope>
                <Section.Header title="Boletas y comprobantes" description="Resumen mensual del ERP frente a las ventas TUU y el RCV de ventas del SII." />
                {noRcvImport && (
                    <Banner tone="info" className="mb-3">No hay importación RCV de ventas para este período.</Banner>
                )}
                <Collection.Root collection={collection} label="Boletas y comprobantes">
                    <Collection.View table={reconciliationSummaryViews.table} emptyTitle="Sin resúmenes" />
                </Collection.Root>
            </Section.Scope>
            {terminal.length > 0 && (
                <Section title="Ventas TUU" as="h3">
                    {terminal.map(({ status, count }) => (
                        <StatusCountRow key={status} status={status} count={count} noun="ventas TUU" />
                    ))}
                </Section>
            )}
        </div>
    )
}

function DocumentsSection({ report, year, month }: { report: FiscalReconciliationReport; year: number; month: number }) {
    return (
        <div className="space-y-4">
            <Section.Header title="Facturas y notas" description="Documentos del RCV del SII por estado de cuadre. Cada conteo abre los documentos filtrados." />
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {DIRECTIONS.map((dir) => {
                    const entries = countEntries(report.documents[dir.key])
                    return (
                        <Section key={dir.key} title={dir.title} as="h3" isEmpty={entries.length === 0} emptyTitle="Sin documentos">
                            {entries.map(({ status, count }) => (
                                <StatusCountRow
                                    key={status}
                                    status={status}
                                    count={count}
                                    noun={dir.noun}
                                    // ONLY_ERP no tiene documento RCV: se lista en «Falta en el SII».
                                    href={status === "ONLY_ERP" ? undefined : `${dir.href}?year=${year}&month=${month}&match_status=${status}`}
                                />
                            ))}
                        </Section>
                    )
                })}
            </div>
        </div>
    )
}

function OnlyErpSection({ report }: { report: FiscalReconciliationReport }) {
    const { openEntity } = useGlobalModalActions()
    const collection = useEntityCollection(onlyErpDocumentEntity, { rows: report.only_erp }, { pagination: { mode: "none" } })
    return (
        <Section.Scope>
            <Section.Header
                title="Falta en el SII"
                description="Facturas y notas del ERP publicadas que no aparecen en el RCV (máximo 50)."
            />
            <Collection.Root collection={collection} label="Falta en el SII" onOpen={(doc) => openEntity("billing.invoice", doc.id)}>
                <Collection.View
                    table={onlyErpDocumentViews.table}
                    card={onlyErpDocumentViews.card}
                    emptyTitle="Sin documentos faltantes"
                    emptyDescription={report.start_date ? "Todas las facturas y notas del período están en el RCV." : "Configure la fecha de inicio del cuadre para buscarlas."}
                />
            </Collection.Root>
        </Section.Scope>
    )
}

export default FiscalReconciliationClientView
