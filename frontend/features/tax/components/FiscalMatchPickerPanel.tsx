"use client"

import { useState } from "react"
import { Search, Sparkles } from "lucide-react"
import {
    ActionConfirmModal,
    CardSurface,
    Chip,
    EmptyState,
    MoneyDisplay,
    SkeletonShell,
} from "@/components/shared"
import { formatDate } from "@/components/entity-view"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { matchScoreIntent } from "@/lib/fiscal-match"
import { toast } from "sonner"
import { useApplyFiscalMatch } from "../hooks/useFiscalMatches"
import { useInvoiceFiscalMatchCandidates } from "../hooks/useInvoiceFiscalMatchCandidates"
import type { FiscalMatchSearchItem } from "../types/fiscalMatch"

export interface FiscalMatchPickerPanelProps {
    invoiceId?: number | null
    preInvoiceContext?: {
        direction: "sale" | "purchase"
        sii_code: number
        counterparty_rut?: string | null
        amount?: number | null
    } | null
    selectedFiscalMatchId?: number | null
    onAssign: (fiscalMatchId: number, folio: string) => void
    invoiceDisplayId?: string
    invoiceTotal?: string
    className?: string
    onSwitchToManual?: () => void
}

export function FiscalMatchPickerPanel({
    invoiceId,
    preInvoiceContext,
    selectedFiscalMatchId,
    onAssign,
    invoiceDisplayId,
    invoiceTotal,
    className,
    onSwitchToManual,
}: FiscalMatchPickerPanelProps) {
    const [q, setQ] = useState("")
    const [ordering, setOrdering] = useState<"score" | "recent">("score")
    const [page, setPage] = useState(1)
    const [pendingItem, setPendingItem] = useState<(FiscalMatchSearchItem & { fiscal_match_id: number }) | null>(null)

    const apply = useApplyFiscalMatch()

    const { data, isLoading, isError, refetch } = useInvoiceFiscalMatchCandidates({
        invoiceId: invoiceId ?? undefined,
        direction: preInvoiceContext?.direction,
        siiCode: preInvoiceContext?.sii_code,
        counterpartyRut: preInvoiceContext?.counterparty_rut,
        amount: preInvoiceContext?.amount,
        q,
        ordering,
        page,
        enabled: true,
    })

    const items = data?.results ?? []

    const handleAssignClick = (item: FiscalMatchSearchItem & { fiscal_match_id: number }) => {
        if (invoiceId) {
            setPendingItem(item)
        } else {
            const folio = item.carried_rcv?.[0]?.folio || item.label.split("N°")[1]?.trim() || ""
            onAssign(item.fiscal_match_id, folio)
            toast.success(`Documento SII seleccionado: ${item.label}`)
        }
    }

    const handleConfirmAssign = async () => {
        if (!pendingItem || !invoiceId) return
        const folio = pendingItem.carried_rcv?.[0]?.folio || pendingItem.label.split("N°")[1]?.trim() || ""
        try {
            await apply.mutateAsync({
                id: pendingItem.fiscal_match_id,
                changes: [{ op: "link", part: "erp", id: invoiceId }],
            })
            onAssign(pendingItem.fiscal_match_id, folio)
            toast.success("Documento asignado y vinculado con éxito")
            setPendingItem(null)
        } catch {
            // El error ya es manejado por el hook
        }
    }

    return (
        <div className={className ?? "space-y-4"}>
            <div className="flex flex-col sm:flex-row gap-2 items-center justify-between">
                <div className="relative w-full sm:w-72">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar por folio, RUT, monto…"
                        value={q}
                        onChange={(e) => {
                            setQ(e.target.value)
                            setPage(1)
                        }}
                        className="pl-8 text-sm"
                    />
                </div>
                <div className="flex items-center gap-1.5 self-end text-xs text-muted-foreground">
                    <span>Ordenar por:</span>
                    <Button
                        type="button"
                        size="sm"
                        variant={ordering === "score" ? "secondary" : "ghost"}
                        className="h-7 text-xs"
                        onClick={() => setOrdering("score")}
                    >
                        Coincidencia
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        variant={ordering === "recent" ? "secondary" : "ghost"}
                        className="h-7 text-xs"
                        onClick={() => setOrdering("recent")}
                    >
                        Recientes
                    </Button>
                </div>
            </div>

            <SkeletonShell isLoading={isLoading} ariaLabel="Cargando candidatos del SII">
                {isError ? (
                    <EmptyState
                        context="generic"
                        title="Error al buscar documentos del SII"
                        description="No se pudieron cargar los registros. Comprueba tu conexión."
                        action={
                            <Button type="button" variant="outline" size="sm" onClick={() => void refetch()}>
                                Reintentar
                            </Button>
                        }
                    />
                ) : items.length === 0 ? (
                    <EmptyState
                        context="generic"
                        title="No hay documentos del SII pendientes"
                        description="No se encontraron registros del RCV sin cuadrar que coincidan con este tipo de documento."
                        action={
                            onSwitchToManual ? (
                                <Button type="button" variant="outline" size="sm" onClick={onSwitchToManual}>
                                    Registrar manualmente
                                </Button>
                            ) : undefined
                        }
                    />
                ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                        {items.map((item) => {
                            const isSelected = selectedFiscalMatchId === item.fiscal_match_id
                            const scoreIntent = matchScoreIntent(item.score)
                            const blockingWarning = item.warnings?.find((w) => w.blocking)
                            const folio = item.carried_rcv?.[0]?.folio || item.label.split("N°")[1]?.trim() || ""

                            return (
                                <CardSurface
                                    key={item.id}
                                    className={`p-3 space-y-2 border transition-all ${
                                        isSelected
                                            ? "border-primary bg-primary/5 ring-1 ring-primary shadow-sm"
                                            : "hover:border-border/80"
                                    }`}
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <h4 className="text-sm font-semibold text-foreground truncate">
                                                {item.label}
                                            </h4>
                                            <p className="text-xs text-muted-foreground truncate">
                                                {item.counterparty}
                                            </p>
                                        </div>
                                        {item.score !== undefined && (
                                            <Chip intent={scoreIntent} size="sm">
                                                <Sparkles className="size-3" />
                                                {item.score}%
                                            </Chip>
                                        )}
                                    </div>

                                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                                        <span>{item.date ? formatDate(item.date) : "—"}</span>
                                        {item.amount && (
                                            <span className="font-medium text-foreground">
                                                <MoneyDisplay amount={item.amount} currency="CLP" />
                                            </span>
                                        )}
                                    </div>

                                    {item.warnings && item.warnings.length > 0 && (
                                        <div className="flex flex-wrap gap-1 pt-1">
                                            {item.warnings.map((w) => (
                                                <Chip
                                                    key={w.code}
                                                    intent={w.blocking ? "destructive" : "warning"}
                                                    size="sm"
                                                >
                                                    {w.label}
                                                </Chip>
                                            ))}
                                        </div>
                                    )}

                                    <div className="pt-2 flex justify-end">
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant={isSelected ? "secondary" : "default"}
                                            className="h-8 text-xs font-medium"
                                            onClick={() => handleAssignClick(item)}
                                            disabled={apply.isPending || !!blockingWarning}
                                        >
                                            {isSelected ? "Seleccionado" : "Asignar este DTE"}
                                        </Button>
                                    </div>
                                </CardSurface>
                            )
                        })}
                    </div>
                )}
            </SkeletonShell>

            <ActionConfirmModal
                open={pendingItem !== null}
                onOpenChange={(open) => {
                    if (!open) setPendingItem(null)
                }}
                onConfirm={handleConfirmAssign}
                title="Asignar folio y vincular con el SII"
                confirmText="Vincular documento"
                variant="warning"
                description={
                    pendingItem && (
                        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm [&_dd]:text-foreground">
                            {invoiceDisplayId && (
                                <>
                                    <dt className="text-muted-foreground">Documento ERP:</dt>
                                    <dd className="font-semibold">{invoiceDisplayId}</dd>
                                </>
                            )}
                            <dt className="text-muted-foreground">Registro del SII:</dt>
                            <dd className="font-semibold">{pendingItem.label}</dd>
                            <dt className="text-muted-foreground">Folio SII:</dt>
                            <dd className="font-mono">
                                {pendingItem.carried_rcv?.[0]?.folio || pendingItem.label.split("N°")[1]?.trim() || "—"}
                            </dd>
                            {invoiceTotal && (
                                <>
                                    <dt className="text-muted-foreground">Total ERP:</dt>
                                    <dd>
                                        <MoneyDisplay amount={invoiceTotal} currency="CLP" />
                                    </dd>
                                </>
                            )}
                            <dt className="text-muted-foreground">Total en el SII:</dt>
                            <dd>
                                <MoneyDisplay amount={pendingItem.amount} currency="CLP" />
                            </dd>
                        </dl>
                    )
                }
            />
        </div>
    )
}
