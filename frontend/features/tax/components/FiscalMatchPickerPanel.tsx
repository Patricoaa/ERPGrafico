"use client"

import { useState } from "react"
import {
    ActionConfirmModal,
    EmptyState,
    MoneyDisplay,
    SkeletonShell,
} from "@/components/shared"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { useApplyFiscalMatch } from "../hooks/useFiscalMatches"
import { useInvoiceFiscalMatchCandidates } from "../hooks/useInvoiceFiscalMatchCandidates"
import { FiscalMatchCandidateCard } from "./FiscalMatchCandidateCard"
import { FiscalMatchSearchToolbar } from "./FiscalMatchSearchToolbar"
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
            <FiscalMatchSearchToolbar
                search={q}
                onSearchChange={(val) => {
                    setQ(val)
                    setPage(1)
                }}
                ordering={ordering}
                onOrderingChange={setOrdering}
            />

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
                            const blockingWarning = item.warnings?.find((w) => w.blocking)

                            return (
                                <div key={item.id} className="flex flex-col gap-1.5">
                                    <FiscalMatchCandidateCard
                                        part="rcv"
                                        card={{
                                            id: item.id,
                                            label: item.label,
                                            counterparty: item.counterparty ?? "",
                                            date: item.date ?? null,
                                            amount: item.amount ? String(item.amount) : null,
                                            score: item.score,
                                            warnings: item.warnings,
                                        }}
                                        state={isSelected ? "selected" : "idle"}
                                        onToggle={() => handleAssignClick(item)}
                                        readOnly={apply.isPending || !!blockingWarning}
                                    />
                                </div>
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
