"use client"

import { useMemo, useState, type ReactNode } from "react"
import { FileText } from "lucide-react"
import { ActionConfirmModal, Drawer, DrawerLayout, EmptyState, MoneyDisplay, Section, SkeletonShell, StatusBadge } from "@/components/shared"
import { formatDate } from "@/components/entity-view"
import { useGlobalModalActions } from "@/components/providers/GlobalModalProvider"
import { Button } from "@/components/ui/button"
import { useDrawerIdentity, useDrawerMode, type DrawerMode } from "@/features/_shared"
import { getDteLabel } from "@/lib/entity-registry"
import { formDrawerWidth } from "@/lib/form-widths"
import { matchStatusValue } from "@/lib/fiscal-match"
import {
    useConfirmRcvDraft,
    useCreateRcvDraft,
    useMatchRcvDocument,
    useRcvDocumentCandidates,
    useRcvDraftSuggestions,
    useRcvSupplierPurchaseOrders,
    useUnmatchRcvDocument,
} from "@/features/tax"
import { useRcvDocument } from "../../hooks/useRcvDocuments"
import { formatRcvDteType, rcvAcknowledgementStatus } from "../../entity-view/rcvDocument.entity"
import { formatRcvPeriod } from "../../entity-view/rcvImport.entity"
import type { RcvDirection, RcvDocumentDetail, RcvImportRef } from "../../types"

export interface RcvDocumentDrawerProps {
    id: number | null
    open: boolean
    onOpenChange: (open: boolean) => void
    /** Solo lectura: el documento es una copia del SII, el modo efectivo siempre es `view`. */
    mode?: DrawerMode
}

const DIRECTION_LABELS: Record<RcvDirection, string> = { PURCHASES: "Compra", SALES: "Venta" }

/** "202610" (período del SII) → "Octubre 2026"; otro formato se muestra tal cual. */
function formatRcvPeriodCode(period: string): string {
    const match = /^(\d{4})(\d{2})$/.exec(period)
    return match ? formatRcvPeriod(Number(match[1]), Number(match[2])) : period
}

/**
 * Ficha de solo lectura de un documento del RCV (`accounting.rcvdocument`), cargada por id.
 * Incluye el enlace a la importación que lo trajo y la copia cruda del SII ("Datos originales", plegable).
 */
export function RcvDocumentDrawer({ id, open, onOpenChange, mode: modeProp }: RcvDocumentDrawerProps) {
    const { mode } = useDrawerMode({ mode: modeProp, initialData: id ? { id } : undefined, defaultMode: "view" })
    const { document: doc, isLoading, isError } = useRcvDocument(id)
    const identity = useDrawerIdentity("accounting.rcvdocument", mode, doc, {
        overrideTitle: doc ? `${doc.dte_type_label || `DTE ${doc.dte_type}`} ${doc.folio}` : "Documento RCV",
        overrideSubtitle: doc ? `${doc.counterparty_name} · ${DIRECTION_LABELS[doc.direction]}` : undefined,
    })

    const detail = isError ? (
        <EmptyState context="generic" title="No se pudo cargar el documento" description="Revisa tu conexión e intenta nuevamente." variant="compact" />
    ) : (
        <SkeletonShell isLoading={isLoading || !doc} ariaLabel="Cargando documento RCV">
            {doc && <RcvDocumentDetailBody doc={doc} />}
        </SkeletonShell>
    )

    return (
        <Drawer
            fillContent
            contentClassName="p-0"
            open={open}
            onOpenChange={onOpenChange}
            side="left"
            defaultSize={formDrawerWidth("complex", false)}
            mode="view"
            icon={identity.icon}
            title={identity.title}
            subtitle={identity.subtitle}
        >
            <DrawerLayout
                className="min-w-0 h-full overflow-hidden"
                tabs={[{ value: "detail", label: "Detalle", icon: FileText, content: detail }]}
            />
        </Drawer>
    )
}

function RcvDocumentDetailBody({ doc }: { doc: RcvDocumentDetail }) {
    const [rawOpen, setRawOpen] = useState(false)
    // Solo se serializa al desplegar: la copia cruda puede ser grande.
    const rawText = useMemo(() => (rawOpen ? JSON.stringify(doc.raw, null, 2) : ""), [rawOpen, doc.raw])
    const purchases = doc.direction === "PURCHASES"
    const ack = rcvAcknowledgementStatus(doc.acknowledgement)
    const money = (amount: string) => <MoneyDisplay amount={amount} currency="CLP" />

    return (
        <div className="space-y-6">
            <Section title="Identificación">
                <Stat title="Tipo de documento" value={formatRcvDteType(doc.dte_type, doc.dte_type_label)} plain />
                <Stat title="Folio" value={doc.folio} />
                <Stat title={purchases ? "RUT proveedor" : "RUT cliente"} value={doc.counterparty_rut} />
                <Stat title={purchases ? "Proveedor" : "Cliente"} value={doc.counterparty_name} plain />
                <Stat title="Período" value={formatRcvPeriodCode(doc.period)} plain />
                <Stat title="RUT empresa" value={doc.company_rut} />
            </Section>

            <Section title="Fechas">
                <Stat title="Emisión" value={doc.issue_date ? formatDate(doc.issue_date) : null} plain />
                <Stat title="Recepción SII" value={doc.received_at ? formatDate(doc.received_at, true) : null} plain />
                <Stat title="Acuse" value={doc.acknowledged_at ? formatDate(doc.acknowledged_at, true) : null} plain />
            </Section>

            <Section title="Montos">
                <Stat title="Exento" value={money(doc.exempt_amount)} />
                <Stat title="Neto" value={money(doc.net_amount)} />
                <Stat title="IVA" value={money(purchases ? doc.vat_recoverable : doc.vat_amount)} />
                <Stat title="IVA no recuperable" value={money(doc.vat_non_recoverable)} />
                <Stat title="Otros impuestos" value={money(doc.other_taxes_total)} />
                <Stat title="Total" strong value={money(doc.total_amount)} />
            </Section>

            <Section title="Estado">
                <Stat title="Estado" value={doc.status} plain />
                <Stat
                    title="Acuse de recibo"
                    value={ack && <StatusBadge status={ack.status} label={ack.label} intent={ack.intent} size="sm" />}
                />
                <Stat title="Indicador de servicio" value={doc.service_indicator} plain />
                <Stat
                    title="Referencia"
                    value={doc.reference_folio ? `${doc.reference_dte_type ?? ""} ${doc.reference_folio}`.trim() : null}
                    plain
                />
            </Section>

            <RcvErpDocumentSection doc={doc} />

            {purchases && doc.match_status === "ONLY_EXTERNAL" && <RcvRegisterSection doc={doc} />}

            <RcvImportSection doc={doc} />

            <Section title="Datos originales">
                <Section.Row
                    title="Copia cruda del registro del SII"
                    expand={{
                        label: rawOpen ? "Ocultar" : "Mostrar",
                        expanded: rawOpen,
                        onToggle: () => setRawOpen((v) => !v),
                        content: rawOpen && (
                            <pre className="max-h-96 overflow-auto rounded-md border bg-muted/40 p-3 font-mono text-2xs text-muted-foreground whitespace-pre">
                                {rawText}
                            </pre>
                        ),
                    }}
                />
            </Section>
        </div>
    )
}

/** Boletas que el cuadre empareja con una venta TUU (ADR-0139). */
const BOLETA_DTE_TYPES: readonly number[] = [39, 41]

/** Cuadre fiscal: factura o nota del ERP vinculada, o candidatos para vincular a mano. */
function RcvErpDocumentSection({ doc }: { doc: RcvDocumentDetail }) {
    const { openEntity } = useGlobalModalActions()
    const match = useMatchRcvDocument()
    const unmatch = useUnmatchRcvDocument()
    const linked = doc.matched_invoice !== null
    const { candidates, isLoading, isError } = useRcvDocumentCandidates(doc.id, !linked)
    const status = matchStatusValue(doc.match_status, doc.match_status_display)

    return (
        <Section title="Documento ERP">
            <Stat title="Cuadre fiscal" value={<StatusBadge status={status.status} label={status.label} intent={status.intent} size="sm" />} />
            {doc.direction === "SALES" && BOLETA_DTE_TYPES.includes(doc.dte_type) && (
                <Stat
                    title="Venta TUU"
                    value={
                        doc.terminal_sale !== null ? (
                            <Button type="button" variant="link" className="h-auto p-0" onClick={() => openEntity("treasury.terminalsale", doc.terminal_sale as number)}>
                                {doc.terminal_sale_display ?? `#${doc.terminal_sale}`}
                            </Button>
                        ) : null
                    }
                />
            )}
            {linked ? (
                <Section.Row
                    title="Documento vinculado"
                    value={
                        <Button type="button" variant="link" className="h-auto p-0" onClick={() => openEntity("billing.invoice", doc.matched_invoice as number)}>
                            {doc.matched_invoice_display ?? `#${doc.matched_invoice}`}
                        </Button>
                    }
                    actions={
                        doc.matched_manually ? (
                            <Button type="button" size="sm" variant="outline" disabled={unmatch.isPending} onClick={() => void unmatch.mutateAsync(doc.id).catch(() => undefined)}>
                                Desvincular
                            </Button>
                        ) : undefined
                    }
                />
            ) : isError ? (
                <Stat title="Candidatos" value="No se pudieron cargar los candidatos." plain />
            ) : isLoading ? (
                <Stat title="Candidatos" value="Buscando…" plain />
            ) : candidates.length === 0 ? (
                <Stat title="Candidatos" value="Sin documentos candidatos" plain />
            ) : (
                candidates.map((c) => (
                    <Section.Row
                        key={c.id}
                        title={c.display_id}
                        description={`${getDteLabel(c.dte_type)} · ${formatDate(c.date)}`}
                        value={<MoneyDisplay amount={c.total} currency="CLP" />}
                        actions={
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={match.isPending}
                                onClick={() => void match.mutateAsync({ docId: doc.id, invoiceId: c.id }).catch(() => undefined)}
                            >
                                Vincular
                            </Button>
                        }
                    />
                ))
            )}
        </Section>
    )
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
function RcvRegisterSection({ doc }: { doc: RcvDocumentDetail }) {
    const docId = doc.id
    const drafts = useRcvDraftSuggestions(docId, true)
    const orders = useRcvSupplierPurchaseOrders(docId, true)
    const confirm = useConfirmRcvDraft()
    const create = useCreateRcvDraft()
    const busy = confirm.isPending || create.isPending
    const [pending, setPending] = useState<PendingDraft | null>(null)

    return (
        <Section title="Registrar en el ERP">
            {drafts.isError ? (
                <Stat title="Borradores" value="No se pudieron cargar los borradores" plain />
            ) : drafts.isLoading ? (
                <Stat title="Borradores" value="Buscando…" plain />
            ) : drafts.suggestions.length === 0 ? (
                <Stat title="Borradores" value="Sin borradores parecidos" plain />
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
                <Stat title="Crear borrador desde OC" value="No se pudieron cargar las OC" plain />
            ) : orders.isLoading ? (
                <Stat title="Crear borrador desde OC" value="Buscando…" plain />
            ) : orders.orders.length === 0 ? (
                <Stat title="Crear borrador desde OC" value="Sin OC del proveedor" plain />
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
                                onClick={() => void create.mutateAsync({ docId, purchaseOrderId: o.id }).catch(() => undefined)}
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
                onConfirm={async () => { if (pending) await confirm.mutateAsync({ docId, invoiceId: pending.id }) }}
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

function RcvImportSection({ doc }: { doc: RcvDocumentDetail }) {
    return (
        <Section title="Importación">
            <Stat title="Primera importación" value={<ImportLink importRef={doc.first_import} />} />
            <Stat title="Última importación" value={<ImportLink importRef={doc.last_import} />} />
            {doc.is_missing && (
                <Stat
                    title="No vino en la última importación"
                    value={
                        <span className="inline-flex items-center gap-2">
                            <StatusBadge status="missing" label="Faltante" intent="warning" size="sm" />
                            <ImportLink importRef={doc.missing_since_import} />
                        </span>
                    }
                />
            )}
        </Section>
    )
}

function ImportLink({ importRef }: { importRef: RcvImportRef | null }) {
    const { openEntity } = useGlobalModalActions()
    if (!importRef) return null
    return (
        <Button type="button" variant="link" className="h-auto p-0" onClick={() => openEntity("accounting.rcvimport", importRef.id)}>
            {`Importación ${formatRcvPeriodCode(importRef.period)}`}
        </Button>
    )
}

/** Key–value row; empty values show a dash so every field stays visible. */
function Stat({ title, value, plain, strong }: { title: string; value: ReactNode; plain?: boolean; strong?: boolean }) {
    const empty = value === null || value === undefined || value === "" || value === false
    return <Section.Row variant="stat" title={title} value={empty ? "—" : value} plain={plain} strong={strong} />
}

export default RcvDocumentDrawer
