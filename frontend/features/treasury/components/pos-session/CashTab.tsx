"use client"

import { AlertTriangle, Banknote, Calculator, CheckCheck, Coins, Scale } from "lucide-react"
import { useGlobalModals } from "@/components/providers/GlobalModalProvider"
import { Collection, useEntityCollection } from "@/components/entity-view"
import { DocumentFieldGrid, FormSection, SkeletonShell, StatCard, type DocumentField } from "@/components/shared"
import { usePOSSessionSummary, type POSReportData } from "@/features/pos"
import { posSessionMovementViews } from "../../entity-view/posSessionSheet.views"
import { treasuryMovementEntity } from "../../entity-view/treasuryMovement.entity"
import type { POSSession, POSSessionOverview } from "../../types"
import { formatCurrency } from "@/lib/money"
import { AmountCell, GRID_LEFT, dateTime } from "./shared"

const num = (value: number | string | undefined | null) => Number(value ?? 0)

interface CashTabProps {
    session: POSSession
    overview: POSSessionOverview | undefined
}

/**
 * Cuánto efectivo debería haber y qué movimientos lo explican. Las OV cobradas en efectivo no
 * se repiten aquí (están en Ventas): se muestra su efecto agregado y los movimientos propios de
 * caja y cualquier otro movimiento de tesorería de la sesión.
 */
export function CashTab({ session, overview }: CashTabProps) {
    const { openEntity } = useGlobalModals()
    const { data, isLoading } = usePOSSessionSummary<POSReportData>(session.id)
    const closing = overview?.closing ?? null
    const own = session.cash_movements ?? []
    const collection = useEntityCollection(treasuryMovementEntity, { rows: own }, { pagination: { mode: "none" } })

    return (
        <SkeletonShell isLoading={isLoading || !data} ariaLabel="Cargando movimientos de tesorería">
            {data && (
                <div className="space-y-8">
                    <section aria-label="Comparativa de efectivo">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                            <StatCard label="Esperado" value={formatCurrency(Number(data.expected_cash))} icon={Coins} accent="primary" valueSize="md" subtext="Calculado a partir de las operaciones" />
                            <StatCard
                                label="Contado"
                                value={closing?.counted_cash != null ? formatCurrency(Number(closing.counted_cash)) : "—"}
                                icon={CheckCheck}
                                accent="info"
                                valueSize="md"
                                subtext={closing?.counted_cash != null ? "Registrado en el arqueo" : session.closed_at ? "Sin arqueo" : "Pendiente de arqueo"}
                            />
                            <StatCard
                                label="Diferencia"
                                value={closing?.difference != null ? formatCurrency(Number(closing.difference)) : "—"}
                                icon={Scale}
                                accent={closing?.difference == null || Number(closing.difference) === 0 ? "success" : "destructive"}
                                valueSize="md"
                                subtext="Contado − esperado"
                            />
                        </div>
                    </section>

                    <section aria-label="Cálculo del saldo" className="space-y-4">
                        <FormSection title="Cálculo del saldo" icon={Calculator} />
                        <DocumentFieldGrid className={GRID_LEFT} fields={balanceFields(data)} />
                    </section>

                    <section aria-label="Movimientos de tesorería" className="space-y-4">
                        <FormSection title="Movimientos de tesorería" icon={Banknote} />
                        {own.length === 0 ? (
                            <p className="text-xs text-muted-foreground">Sin movimientos de tesorería asociados a esta sesión.</p>
                        ) : (
                            <Collection.Root
                                collection={collection}
                                label="Movimientos de tesorería de la sesión"
                                onOpen={(movement) => openEntity("treasury.treasurymovement", movement.id)}
                            >
                                <Collection.View table={posSessionMovementViews.table} />
                            </Collection.Root>
                        )}
                    </section>

                    {(data.out_of_session_movements?.length ?? 0) > 0 && (
                        <section aria-label="Fuera de la sesión" className="space-y-4">
                            <FormSection title="Fuera de la sesión" icon={AlertTriangle} />
                            <DocumentFieldGrid
                                className={GRID_LEFT}
                                fields={(data.out_of_session_movements ?? []).map((mv) => ({
                                    label: `${mv.event === "ANNULMENT" ? "Anulación " : ""}${mv.display_id}${mv.document ? ` · ${mv.document}` : ""}`,
                                    value: (
                                        <span className="flex flex-col">
                                            <AmountCell value={mv.amount} isExpense={mv.direction === "OUT"} />
                                            {(mv.reason || mv.notes || mv.created_by_name) && (
                                                <span className="text-muted-foreground">
                                                    {[mv.created_by_name, mv.reason || mv.notes].filter(Boolean).join(" — ")}
                                                </span>
                                            )}
                                        </span>
                                    ),
                                    span: 2 as const,
                                }))}
                            />
                        </section>
                    )}
                </div>
            )}
        </SkeletonShell>
    )
}

function balanceFields(data: POSReportData): DocumentField[] {
    const b = data.cash_breakdown ?? null
    const cashSales = num(b ? b.cash_sales : data.total_cash_sales)
    const refunds = num(b?.cash_refunds)
    const inflow = num(data.total_manual_inflow) + num(b?.external_inflow)
    const outflow = num(data.total_manual_outflow) + num(b?.external_outflow)
    const annulments = num(b?.annulments)
    return [
        { label: "Fondo inicial", value: <AmountCell value={data.opening_balance} /> },
        { label: "(+) Ventas en efectivo", value: <AmountCell value={cashSales} /> },
        { label: "(−) Devoluciones en efectivo", value: <AmountCell value={refunds} isExpense /> },
        { label: "(+) Entradas", value: <AmountCell value={inflow} /> },
        { label: "(−) Retiradas", value: <AmountCell value={outflow} isExpense /> },
        { label: "(±) Anulaciones", value: <AmountCell value={annulments} signed />, hidden: annulments === 0 },
        { label: "(=) Efectivo esperado", value: <AmountCell value={data.expected_cash} bold /> },
    ]
}
