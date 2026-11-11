"use client"

import { AlertTriangle, Banknote, Info, Receipt, Timer, TrendingUp, Wallet } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { DocumentFieldGrid, EntityBadge, FormSection, SkeletonShell, StatCard, type DocumentField } from "@/components/shared"
import type { POSSession, POSSessionOverview } from "../../types"
import { formatCurrency } from "@/lib/money"
import { AmountCell, GRID_LEFT, dateTime, formatDuration, type SessionTab } from "./shared"

const TAB_LABEL: Partial<Record<SessionTab, string>> = { closing: "Ir al cierre", sales: "Ver ventas" }

interface SummaryTabProps {
    session: POSSession
    overview: POSSessionOverview | undefined
    isLoading: boolean
    onGoTab: (tab: SessionTab) => void
}

/**
 * Resumen ejecutivo: excepciones primero, luego indicadores, responsables y cobros netos por
 * método. No repite las tablas de las otras pestañas: dirige a ellas.
 */
export function SummaryTab({ session, overview, isLoading, onGoTab }: SummaryTabProps) {
    return (
        <SkeletonShell isLoading={isLoading || !overview} ariaLabel="Cargando resumen de la sesión">
            {overview && (
                <div className="space-y-8">
                    {overview.alerts.length > 0 && (
                        <section aria-label="Alertas" className="space-y-2">
                            {overview.alerts.map((alert) => (
                                <Alert key={alert.code} variant={alert.severity === "destructive" ? "destructive" : "warning"}>
                                    <AlertTriangle className="h-4 w-4" />
                                    <AlertTitle>
                                        {alert.code === "CASH_DIFFERENCE" ? "Diferencia de caja" : "Cobros pendientes"}
                                        {alert.amount !== undefined && <> · <AmountCell value={alert.amount} signed /></>}
                                    </AlertTitle>
                                    <AlertDescription className="flex items-center justify-between gap-3">
                                        <span>{alert.message}</span>
                                        <Button type="button" size="sm" variant="outline" onClick={() => onGoTab(alert.tab)}>
                                            {TAB_LABEL[alert.tab] ?? "Ver detalle"}
                                        </Button>
                                    </AlertDescription>
                                </Alert>
                            ))}
                        </section>
                    )}

                    <IndicatorCards session={session} overview={overview} />

                    <section aria-label="Información operativa" className="space-y-4">
                        <FormSection title="Información operativa" icon={Info} />
                        <DocumentFieldGrid className={GRID_LEFT} fields={operational(session, overview)} />
                    </section>

                    <section aria-label="Cobros por métodos" className="space-y-4">
                        <FormSection title="Cobros por métodos" icon={Wallet} />
                        <CollectionsBar collections={overview.collections} />
                    </section>
                </div>
            )}
        </SkeletonShell>
    )
}

function IndicatorCards({ session, overview }: { session: POSSession; overview: POSSessionOverview }) {
    const { sales } = overview
    return (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
                label="Ventas"
                value={formatCurrency(Number(sales.net))}
                icon={TrendingUp}
                accent="success"
                valueSize="md"
                subtext={`Brutas ${formatCurrency(Number(sales.gross))} − devoluciones ${formatCurrency(Number(sales.returns_total))}`}
            />
            <StatCard
                label="N°Órdenes de venta"
                value={sales.sale_count}
                icon={Receipt}
                accent="primary"
                valueSize="md"
                subtext={`${sales.return_count} devolución(es)`}
            />
            <StatCard
                label="Media de Orden de Venta"
                value={formatCurrency(Number(sales.average_ticket))}
                icon={Banknote}
                accent="info"
                valueSize="md"
                subtext="Ventas ÷ órdenes de venta, IVA incluido"
            />
            <StatCard
                label="Duración"
                value={formatDuration(session.opened_at, session.closed_at)}
                icon={Timer}
                accent="muted"
                valueSize="md"
                subtext={`${session.closed_at ? "Sesión cerrada" : "En curso"} `}
            />
        </div>
    )
}

function operational(session: POSSession, overview: POSSessionOverview): DocumentField[] {
    const closing = overview.closing
    const closed = !!session.closed_at
    return [
        {
            label: "Punto de venta",
            value: session.terminal_details
                ? <EntityBadge label="treasury.posterminal" data={session.terminal_details} size="sm" />
                : session.terminal_name,
        },
        { label: "Responsable de apertura", value: session.user_name },
        { label: "Fecha de apertura", value: <span className="tabular-nums">{dateTime(session.opened_at)}</span> },
        { label: "Fondo de apertura", value: <AmountCell value={session.opening_balance} /> },
        { label: "Responsable de cierre", value: closed ? (closing?.closed_by_name ?? session.closed_by_name) : <span className="text-muted-foreground">En curso</span> },
        { label: "Fecha y hora de cierre", value: closed ? <span className="tabular-nums">{dateTime(session.closed_at as string)}</span> : null },
        { label: "Fondo final", value: closing?.counted_cash != null ? <AmountCell value={closing.counted_cash} /> : null },
    ]
}

/** Un color por método (orden estable); el nombre del método viene de su configuración. */
const METHOD_COLORS = ["bg-success", "bg-primary", "bg-info", "bg-warning", "bg-accent", "bg-secondary"]
const METHOD_TEXT = ["text-success-foreground", "text-primary-foreground", "text-info-foreground", "text-warning-foreground", "text-accent-foreground", "text-secondary-foreground"]

/** Barra distribuida (peso % de cada método) y, debajo, cada método con su importe. */
function CollectionsBar({ collections }: { collections: POSSessionOverview["collections"] }) {
    const colorOf = (key: string) => collections.findIndex((c) => c.key === key) % METHOD_COLORS.length
    const positive = collections.filter((c) => Number(c.amount) > 0)
    return (
        <div className="space-y-3">
            <div
                role="img"
                aria-label={`Distribución de cobros: ${positive.map((c) => `${c.label} ${Number(c.share).toFixed(0)}%`).join(", ") || "sin cobros"}`}
                className="flex h-6 w-full overflow-hidden rounded-sm bg-muted"
            >
                {positive.map((c) => (
                    <div
                        key={c.key}
                        className={`flex items-center justify-center text-3xs font-bold tabular-nums ${METHOD_COLORS[colorOf(c.key)]} ${METHOD_TEXT[colorOf(c.key)]}`}
                        style={{ width: `${Number(c.share)}%` }}
                    >
                        {Number(c.share) >= 8 ? `${Number(c.share).toFixed(0)}%` : null}
                    </div>
                ))}
            </div>
            <ul className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-1">
                {collections.map((c) => (
                    <li key={c.key} className="flex items-center justify-between gap-3 text-xs">
                        <span className="flex items-center gap-2">
                            <span aria-hidden className={`h-2.5 w-2.5 rounded-sm ${METHOD_COLORS[colorOf(c.key)]}`} />
                            {c.label}
                            {!c.enabled && <span className="text-3xs text-muted-foreground">(ya no habilitado)</span>}
                        </span>
                        <AmountCell value={c.amount} />
                    </li>
                ))}
            </ul>
        </div>
    )
}
