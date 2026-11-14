"use client"

import { useState, type ReactNode } from "react"
import { FileText } from "lucide-react"
import { Drawer, DrawerLayout, EmptyState, MoneyDisplay, Section, SkeletonShell, StatusBadge } from "@/components/shared"
import { formatDate } from "@/components/entity-view"
import { useGlobalModalActions } from "@/components/providers/GlobalModalProvider"
import { Button } from "@/components/ui/button"
import { useDrawerIdentity, useDrawerMode, type DrawerMode } from "@/features/_shared"
import { formDrawerWidth } from "@/lib/form-widths"
import { useRcvDocument } from "../../hooks/useRcvDocuments"
import { formatRcvDteType, rcvAcknowledgementStatus } from "../../entity-view/rcvDocument.entity"
import type { RcvDirection, RcvDocumentDetail, RcvImportRef } from "../../types"

export interface RcvDocumentDrawerProps {
    id: number | null
    open: boolean
    onOpenChange: (open: boolean) => void
    /** Solo lectura: el documento es una copia del SII, el modo efectivo siempre es `view`. */
    mode?: DrawerMode
}

const DIRECTION_LABELS: Record<RcvDirection, string> = { PURCHASES: "Compra", SALES: "Venta" }

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
                <Stat title="Período" value={doc.period} />
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

            <RcvImportSection doc={doc} />

            <Section title="Datos originales">
                <Section.Row
                    title="Copia cruda del registro del SII"
                    expand={{
                        label: rawOpen ? "Ocultar" : "Mostrar",
                        expanded: rawOpen,
                        onToggle: () => setRawOpen((v) => !v),
                        content: (
                            <pre className="max-h-96 overflow-auto rounded-md border bg-muted/40 p-3 font-mono text-2xs text-muted-foreground whitespace-pre">
                                {JSON.stringify(doc.raw, null, 2)}
                            </pre>
                        ),
                    }}
                />
            </Section>
        </div>
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
            {`Importación ${importRef.period}`}
        </Button>
    )
}

/** Key–value row; empty values show a dash so every field stays visible. */
function Stat({ title, value, plain, strong }: { title: string; value: ReactNode; plain?: boolean; strong?: boolean }) {
    const empty = value === null || value === undefined || value === "" || value === false
    return <Section.Row variant="stat" title={title} value={empty ? "—" : value} plain={plain} strong={strong} />
}

export default RcvDocumentDrawer
