"use client"

import { useState, type ReactNode } from "react"
import { ActionConfirmModal, MoneyDisplay, Section } from "@/components/shared"
import { formatDate } from "@/components/entity-view"
import { Button } from "@/components/ui/button"
import { getDteLabel } from "@/lib/entity-registry"
import {
    useConfirmFiscalMatchDraft,
    useCreateFiscalMatchDraft,
    useFiscalMatchDraftSuggestions,
    useFiscalMatchPurchaseOrders,
} from "../hooks/useRcvFeeding"
import type { FiscalMatchRcvDetail } from "../types/fiscalMatch"

export interface FiscalMatchRegisterSectionProps {
    /** Grupo huérfano de compra. */
    groupId: number
    /** Su único registro del SII: aporta el folio y el total a confirmar. */
    doc: FiscalMatchRcvDetail
}

/** Borrador elegido para emitir, pendiente de confirmación. */
interface PendingDraft {
    id: number
    display_id: string
    total: string
}

/**
 * Compra que falta en el ERP: emitir un borrador parecido con el folio del RCV o crear uno desde una OC.
 * Nada corre sin un clic explícito (ADR-0138 D8); emitir pide confirmar folio y totales.
 */
export function FiscalMatchRegisterSection({ groupId, doc }: FiscalMatchRegisterSectionProps) {
    const drafts = useFiscalMatchDraftSuggestions(groupId, true)
    const orders = useFiscalMatchPurchaseOrders(groupId, true)
    const confirm = useConfirmFiscalMatchDraft()
    const create = useCreateFiscalMatchDraft()
    const busy = confirm.isPending || create.isPending
    const [pending, setPending] = useState<PendingDraft | null>(null)

    return (
        <Section title="Registrar en el ERP">
            {drafts.isError ? (
                <Note title="Borradores" text="No se pudieron cargar los borradores" />
            ) : drafts.isLoading ? (
                <Note title="Borradores" text="Buscando…" />
            ) : drafts.suggestions.length === 0 ? (
                <Note title="Borradores" text="Sin borradores parecidos" />
            ) : (
                drafts.suggestions.map((d) => (
                    <Section.Row
                        key={d.id}
                        title={d.display_id}
                        description={`${getDteLabel(d.dte_type)} · Borrador · ${formatDate(d.date)}`}
                        value={<MoneyDisplay amount={d.total} currency="CLP" />}
                        actions={
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={busy}
                                onClick={() => setPending({ id: d.id, display_id: d.display_id, total: d.total })}
                            >
                                Asignar folio y emitir
                            </Button>
                        }
                    />
                ))
            )}
            {orders.isError ? (
                <Note title="Crear borrador desde OC" text="No se pudieron cargar las OC" />
            ) : orders.isLoading ? (
                <Note title="Crear borrador desde OC" text="Buscando…" />
            ) : orders.orders.length === 0 ? (
                <Note title="Crear borrador desde OC" text="Sin OC del proveedor" />
            ) : (
                orders.orders.map((o) => (
                    <Section.Row
                        key={o.id}
                        title={o.display_id}
                        description={`OC · ${formatDate(o.date)}`}
                        value={<MoneyDisplay amount={o.total} currency="CLP" />}
                        actions={
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={busy}
                                aria-label={`Crear borrador desde OC ${o.display_id}`}
                                onClick={() => void create.mutateAsync({ groupId, purchaseOrderId: o.id }).catch(() => undefined)}
                            >
                                Crear borrador desde OC
                            </Button>
                        }
                    />
                ))
            )}
            <ActionConfirmModal
                open={pending !== null}
                onOpenChange={(open) => { if (!open) setPending(null) }}
                // Si falla, el hook ya muestra el error y el diálogo queda abierto.
                onConfirm={async () => { if (pending) await confirm.mutateAsync({ groupId, invoiceId: pending.id }) }}
                title="Asignar folio y emitir"
                confirmText="Emitir"
                variant="warning"
                description={
                    pending && (
                        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm [&_dd]:text-foreground">
                            <dt className="text-muted-foreground">Borrador</dt>
                            <dd>{pending.display_id}</dd>
                            <dt className="text-muted-foreground">Folio a asignar</dt>
                            <dd className="font-mono">{doc.folio}</dd>
                            <dt className="text-muted-foreground">Total del borrador</dt>
                            <dd><MoneyDisplay amount={pending.total} currency="CLP" /></dd>
                            <dt className="text-muted-foreground">Total en el SII</dt>
                            <dd><MoneyDisplay amount={doc.total_amount} currency="CLP" /></dd>
                        </dl>
                    )
                }
            />
        </Section>
    )
}

function Note({ title, text }: { title: string; text: ReactNode }) {
    return <Section.Row variant="stat" title={title} value={text} plain />
}
