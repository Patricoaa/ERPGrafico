"use client"

import { AlertTriangle, Banknote, CheckCircle2, ClipboardCheck, ListChecks, MessageSquareText, Scale, UserCheck } from "lucide-react"
import { DocumentFieldGrid, EmptyState, SkeletonShell, StatCard, type DocumentField, Section } from "@/components/shared"
import { Button } from "@/components/ui/button"
import { useGlobalModals } from "@/components/providers/GlobalModalProvider"
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
    const { openEntity } = useGlobalModals()
    // La diferencia de efectivo ya se explica en «Arqueo de efectivo»; aquí van las demás incidencias.
    const otherAlerts = (overview?.alerts ?? []).filter((a) => a.code !== "CASH_DIFFERENCE")

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
                            value={otherAlerts.length}
                            icon={ListChecks}
                            accent={otherAlerts.length > 0 ? "warning" : "success"}
                            valueSize="md"
                            subtext={otherAlerts.length > 0 ? otherAlerts.map((a) => a.message).join(" ") : "Sin otras incidencias"}
                        />
                    </div>

                    <section aria-label="Arqueo de efectivo" className="space-y-4">
                        <Section.Header spaced title="Arqueo de efectivo" icon={Banknote} />
                        <DocumentFieldGrid className={GRID_LEFT} fields={cashCount(overview, openEntity)} />
                    </section>

                    <section aria-label="Cobros por método" className="space-y-4">
                        <Section.Header spaced title="Cobros por método" icon={Scale} />
                        <DocumentFieldGrid className={GRID_LEFT} fields={otherMethods(overview)} />
                    </section>

                    <section aria-label="Observaciones del cierre" className="space-y-4">
                        <Section.Header spaced title="Observaciones del cierre" icon={MessageSquareText} />
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

type OpenEntity = (label: string, id: number) => void

function MovementLink({ movement, openEntity }: { movement: { id: number; display_id: string; label: string }; openEntity: OpenEntity }) {
    return (
        <Button type="button" variant="link" className="h-auto p-0 font-mono text-xs" onClick={() => openEntity(movement.label, movement.id)}>
            {movement.display_id}
        </Button>
    )
}

/** Esperado, declarado y diferencia con su motivo, el ajuste que generó y el retiro al cerrar. */
function cashCount(overview: POSSessionOverview, openEntity: OpenEntity): DocumentField[] {
    const closing = overview.closing
    const adjustment = closing?.adjustment ?? null
    const withdrawal = closing?.withdrawal ?? null
    const fields: DocumentField[] = [
        { label: "Esperado", value: <AmountCell value={closing?.expected_cash ?? 0} /> },
        { label: "Declarado", value: closing?.counted_cash != null ? <AmountCell value={closing.counted_cash} /> : null },
        { label: "Diferencia", value: closing?.difference != null ? <AmountCell value={closing.difference} signed bold /> : null },
    ]
    if (adjustment) {
        fields.push(
            { label: "Motivo de la diferencia", value: adjustment.reason_display ?? "Sin motivo registrado" },
            { label: "Ajuste generado", value: <MovementLink movement={adjustment} openEntity={openEntity} /> },
        )
    }
    if (withdrawal) {
        fields.push(
            {
                label: "Retirado al cerrar",
                value: (
                    <span className="flex flex-col">
                        <AmountCell value={withdrawal.amount} />
                        <span className="text-muted-foreground">{withdrawal.destination ? `Hacia ${withdrawal.destination} · ` : ""}<MovementLink movement={withdrawal} openEntity={openEntity} /></span>
                    </span>
                ),
            },
        )
    }
    if (closing?.left_in_box != null) {
        fields.push({ label: "Queda en la caja", value: <AmountCell value={closing.left_in_box} bold /> })
    }
    return fields
}

/** Métodos distintos de efectivo: lo cobrado en la sesión (el efectivo se contrasta arriba). */
function otherMethods(overview: POSSessionOverview): DocumentField[] {
    return overview.collections
        .filter((c) => c.method !== "CASH")
        .map((c) => ({ label: c.label, value: <AmountCell value={c.amount} /> }))
}
