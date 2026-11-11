"use client"

import { AlertTriangle, CheckCircle2, ClipboardCheck, ListChecks, MessageSquareText, Scale, UserCheck } from "lucide-react"
import { DocumentFieldGrid, EmptyState, FormSection, SkeletonShell, StatCard, type DocumentField } from "@/components/shared"
import { formatCurrency } from "@/lib/money"
import type { POSSession, POSSessionOverview } from "../../types"
import { AmountCell, GRID_LEFT, dateTime } from "./shared"

interface ClosingTabProps {
    session: POSSession
    overview: POSSessionOverview | undefined
    isLoading: boolean
}

/**
 * Cómo terminó la sesión y si lo declarado coincide con lo esperado. «Coincide» compara importes;
 * no equivale a «revisado» por un supervisor (el sistema no registra esa revisión).
 */
export function ClosingTab({ session, overview, isLoading }: ClosingTabProps) {
    const closing = overview?.closing ?? null

    if (!session.closed_at) {
        return <EmptyState variant="compact" icon={ClipboardCheck} title="La sesión sigue abierta" description="El cierre aparecerá aquí cuando se cierre la sesión." />
    }

    return (
        <SkeletonShell isLoading={isLoading || !overview} ariaLabel="Cargando cierre de la sesión">
            {overview && closing && (
                <div className="space-y-8">
                    <div aria-label="Contexto del cierre" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <StatCard
                            label="Cerrada por"
                            value={closing.closed_by_name ?? "—"}
                            icon={UserCheck}
                            accent="primary"
                            valueSize="md"
                            subtext={`${dateTime(closing.closed_at)} · ${overview.timezone}`}
                        />
                        <StatCard
                            label="Resultado"
                            value={closing.result === null ? "Sin arqueo" : closing.result === "MATCH" ? "Coincide" : "Con diferencia"}
                            icon={closing.result === "DIFFERENCE" ? AlertTriangle : CheckCircle2}
                            accent={closing.result === "DIFFERENCE" ? "destructive" : closing.result === "MATCH" ? "success" : "muted"}
                            valueSize="md"
                            subtext={closing.difference != null ? `Diferencia ${formatCurrency(Number(closing.difference))}` : undefined}
                        />
                        <StatCard
                            label="Incidencias"
                            value={overview.alerts.length}
                            icon={ListChecks}
                            accent={overview.alerts.length > 0 ? "warning" : "success"}
                            valueSize="md"
                            subtext={overview.alerts.length > 0 ? overview.alerts.map((a) => a.message).join(" ") : "Sin incidencias"}
                        />
                    </div>

                    <section aria-label="Comparativa por método" className="space-y-4">
                        <FormSection title="Comparativa por método" icon={Scale} />
                        <DocumentFieldGrid className={GRID_LEFT} fields={comparison(overview)} />
                    </section>

                    <section aria-label="Observaciones del cierre" className="space-y-4">
                        <FormSection title="Observaciones del cierre" icon={MessageSquareText} />
                        {closing.notes ? (
                            <div className="space-y-1">
                                <p className="whitespace-pre-line text-xs text-foreground">{closing.notes}</p>
                                <p className="text-3xs text-muted-foreground">
                                    {closing.notes_author ?? "—"} · <span className="tabular-nums">{dateTime(closing.notes_at)}</span> ({overview.timezone})
                                </p>
                            </div>
                        ) : (
                            <p className="text-xs text-muted-foreground">Sin observaciones registradas.</p>
                        )}
                    </section>
                </div>
            )}
        </SkeletonShell>
    )
}

function comparison(overview: POSSessionOverview): DocumentField[] {
    const closing = overview.closing
    const fields: DocumentField[] = [
        { label: "Efectivo · esperado", value: <AmountCell value={closing?.expected_cash ?? 0} /> },
        { label: "Efectivo · declarado", value: closing?.counted_cash != null ? <AmountCell value={closing.counted_cash} /> : null },
        { label: "Efectivo · diferencia", value: closing?.difference != null ? <AmountCell value={closing.difference} signed bold /> : null },
    ]
    for (const c of overview.collections.filter((x) => x.method !== "CASH")) {
        fields.push({ label: `${c.label} · esperado`, value: <AmountCell value={c.amount} /> })
    }
    return fields
}
