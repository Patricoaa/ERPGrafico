"use client"

import { useState, type ReactNode } from "react"
import { Drawer, DrawerLayout, EmptyState, MoneyDisplay, Section, SkeletonShell, StatusBadge } from "@/components/shared"
import { Collection, formatDate, useEntityCollection } from "@/components/entity-view"
import { useDrawerIdentity } from "@/features/_shared"
import { formDrawerWidth } from "@/lib/form-widths"
import { useTerminalSale } from "../hooks/useTerminalSales"
import type { TerminalSaleDetail } from "../types"
import {
    terminalSaleItemEntity,
    terminalSaleItemViews,
    terminalSalePaymentType,
    terminalSaleReconciliationEntity,
    terminalSaleReconciliationViews,
    terminalSaleSettlement,
    terminalSaleStatus,
    toTerminalSaleItemRows,
    toTerminalSaleReconciliationRows,
} from "../entity-view/terminalSale.entity"

interface TerminalSaleDrawerProps {
    saleId: number | null
    open: boolean
    onOpenChange: (open: boolean) => void
}

const SOURCE_LABELS: Record<string, string> = { BRANCH: "Reporte de sucursal", GENERAL: "Reporte general" }

/**
 * Detalle de solo lectura de una venta TUU sincronizada: todos los campos, ítems, abonos y la copia cruda
 * de los reportes que la trajeron ("Datos originales", plegable).
 */
export function TerminalSaleDrawer({ saleId, open, onOpenChange }: TerminalSaleDrawerProps) {
    const { sale, isLoading, isError } = useTerminalSale(saleId)
    const identity = useDrawerIdentity("treasury.terminalsale", "view", sale, {
        overrideTitle: sale ? `Venta ${sale.sale_id || sale.sequence_number || `#${sale.id}`}` : "Venta de terminal de cobro",
        overrideSubtitle: sale ? `${sale.provider_name} · ${formatDate(sale.transaction_at, true)}` : undefined,
    })

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
            <DrawerLayout>
                {isError ? (
                    <EmptyState context="generic" title="No se pudo cargar la venta" description="Revisa tu conexión e intenta nuevamente." variant="compact" />
                ) : (
                    <SkeletonShell isLoading={isLoading || !sale} ariaLabel="Cargando venta de terminal de cobro">
                        {sale && <TerminalSaleDetailBody sale={sale} />}
                    </SkeletonShell>
                )}
            </DrawerLayout>
        </Drawer>
    )
}

function TerminalSaleDetailBody({ sale }: { sale: TerminalSaleDetail }) {
    const [rawOpen, setRawOpen] = useState(false)
    const commission = sale.commission_amount === null ? null : -Math.abs(Number(sale.commission_amount))
    const paymentType = terminalSalePaymentType(sale.payment_type)
    const status = terminalSaleStatus(sale.status)

    return (
        <div className="space-y-6">
            <Section title="Venta">
                <Stat title="Estado" value={<StatusBadge status={status.status} label={status.label} intent={status.intent} size="sm" />} />
                <Stat title="Fecha y hora" value={formatDate(sale.transaction_at, true)} plain />
                <Stat title="ID venta" value={sale.sale_id} />
                <Stat title="N° secuencia" value={sale.sequence_number} />
                <Stat title="Proveedor" value={sale.provider_name} plain />
                <Stat title="Terminal" value={sale.device_name ?? sale.serial_number} plain />
                <Stat title="N° de serie" value={sale.serial_number} />
                <Stat title="Sucursal" value={sale.location_id} />
                <Stat title="Documento" value={sale.document_type_label} plain />
                <Stat title="Instancia" value={sale.instance} />
                <Stat title="Estado original" value={sale.raw_status} />
                <Stat title="Clave natural" value={sale.natural_key} />
                <Stat title="Fuentes" value={sale.sources.map((s) => SOURCE_LABELS[s] ?? s).join(" · ")} plain />
            </Section>

            <Section title="Pago">
                <Stat title="Tipo de pago" value={<StatusBadge status={paymentType.status} label={paymentType.label} intent={paymentType.intent} size="sm" />} />
                <Stat title="Marca" value={sale.card_brand} plain />
                <Stat title="Emisor" value={sale.card_issuer} plain />
                <Stat title="BIN" value={sale.card_bin} />
                <Stat title="Origen de la tarjeta" value={sale.card_origin} plain />
                <Stat title="Tipo de cuotas" value={sale.installment_type} plain />
                <Stat title="Cuotas" value={sale.installment_count} />
                <Stat title="Adquirente" value={sale.acquirer_id} />
            </Section>

            <Section title="Montos">
                <Stat title="Venta" value={<MoneyDisplay amount={sale.sale_amount} currency={sale.currency} />} />
                <Stat title="Propina" value={<MoneyDisplay amount={sale.tip_amount} currency={sale.currency} />} />
                <Stat title="Vuelto (cashback)" value={<MoneyDisplay amount={sale.cashback_amount} currency={sale.currency} />} />
                <Stat title="Total" strong value={<MoneyDisplay amount={sale.total_amount} currency={sale.currency} />} />
                <Stat title="Comisión" value={commission === null ? null : <MoneyDisplay amount={commission} currency={sale.currency} />} />
                <Stat title="Neto" strong value={sale.net_amount === null ? null : <MoneyDisplay amount={sale.net_amount} currency={sale.currency} />} />
            </Section>

            <Section title="Abono">
                <Stat title="Fecha de abono" value={terminalSaleSettlement(sale.settlement_date)} plain />
                <Stat title="ID abono" value={sale.settlement_id} />
                <Stat title="Monto abonado" value={sale.settlement_amount === null ? null : <MoneyDisplay amount={sale.settlement_amount} currency={sale.currency} />} />
            </Section>

            <TerminalSaleItems items={sale.items} />
            <TerminalSaleReconciliations reconciliations={sale.reconciliations} />

            <Section title="Datos originales">
                <Section.Row
                    title="Copia cruda de los reportes TUU"
                    expand={{
                        label: rawOpen ? "Ocultar" : "Mostrar",
                        expanded: rawOpen,
                        onToggle: () => setRawOpen((v) => !v),
                        content: (
                            <pre className="max-h-96 overflow-auto rounded-md border bg-muted/40 p-3 font-mono text-2xs text-muted-foreground whitespace-pre">
                                {JSON.stringify(sale.raw, null, 2)}
                            </pre>
                        ),
                    }}
                />
            </Section>
        </div>
    )
}

/** Key–value row; empty values show a dash so every field of the sale stays visible. */
function Stat({ title, value, plain, strong }: { title: string; value: ReactNode; plain?: boolean; strong?: boolean }) {
    const empty = value === null || value === undefined || value === ""
    return <Section.Row variant="stat" title={title} value={empty ? "—" : value} plain={plain} strong={strong} />
}

function TerminalSaleItems({ items }: { items: Record<string, unknown>[] }) {
    const collection = useEntityCollection(terminalSaleItemEntity, { rows: toTerminalSaleItemRows(items) }, { pagination: { mode: "none" } })
    return (
        <Section.Scope>
            <Section.Header title="Ítems" />
            <Collection.Root collection={collection} label="Ítems de la venta">
                <Collection.View table={terminalSaleItemViews.table} emptyTitle="Sin ítems" emptyDescription="TUU no informó ítems para esta venta." />
            </Collection.Root>
        </Section.Scope>
    )
}

function TerminalSaleReconciliations({ reconciliations }: { reconciliations: Record<string, unknown>[] }) {
    const collection = useEntityCollection(
        terminalSaleReconciliationEntity,
        { rows: toTerminalSaleReconciliationRows(reconciliations) },
        { pagination: { mode: "none" } },
    )
    return (
        <Section.Scope>
            <Section.Header title="Abonos (conciliaciones)" />
            <Collection.Root collection={collection} label="Abonos de la venta">
                <Collection.View table={terminalSaleReconciliationViews.table} emptyTitle="Sin abonos" emptyDescription="La venta aún no tiene abonos informados." />
            </Collection.Root>
        </Section.Scope>
    )
}

export default TerminalSaleDrawer
