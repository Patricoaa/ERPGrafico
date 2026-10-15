"use client"

import { useEffect, useMemo, useState } from "react"
import { FileText, Link2 } from "lucide-react"
import { useGlobalModals } from "@/components/providers/GlobalModalProvider"
import {
    DocumentActionsMenu,
    DocumentDrawerShell,
    DocumentLifecycle,
    type DocumentActionItem,
    type DocumentSheetTab,
} from "@/components/shared"
import { formatCurrency } from "@/lib/money"
import { ActivitySidebar } from "@/features/audit"
import { PrintableLayout, useDrawerIdentity, usePrintableDrawer } from "@/features/_shared"
import {
    DocumentRelationsTab,
    resolveRegistryActions,
    useDocumentRelations,
    useInvalidateDocuments,
    type DocumentDomain,
    type ResolvedDocumentAction,
} from "@/features/documents"
import { saleOrderActions } from "@/features/sales"
import { purchaseOrderActions } from "@/features/purchasing"
import { useOrderHubData } from "@/hooks/useOrderHubData"
import { useOrderActionEngine } from "../../hooks/useOrderActionEngine"
import { useOrderRelatedActions } from "../../hooks/useOrderRelatedActions"
import { getInvoiceLifecycle } from "../../utils/lifecycle"
import { CATEGORY_DOMAIN, PRIMARY_PRIORITY } from "../../utils/orderSheetActions"
import type { Order, OrderLine } from "../../types"
import { InvoiceSummaryTab } from "./InvoiceSummaryTab"

export interface InvoiceSheetProps {
    id: number | null
    open: boolean
    onOpenChange: (open: boolean) => void
    /** Sin Drawer: cuerpo incrustado (POS, notas C/D). */
    embedded?: boolean
    posSessionId?: number | null
    onActionSuccess?: () => void
}

const LABEL = "billing.invoice"

/**
 * Acciones del registro de OV/OC que aplican a una factura o nota (ADR-0083). En el Hub era el
 * "modo nota": el mismo motor actúa sobre la factura (pagos imputados a ella, folio, NC/ND,
 * logística propia de la nota).
 */
const INVOICE_ACTIONS = new Set(["complete-folio", "register-payment", "register-payment-return", "create-credit-note", "create-debit-note"])
const NOTE_ACTIONS = new Set([
    "complete-folio", "register-payment", "register-payment-return",
    "register-delivery", "register-reception", "confirm-service-delivery", "register-merchandise-return",
])

/**
 * Ficha documental de factura/nota (ADR-0083). Reemplaza el Order Hub en "modo nota" y el
 * InvoiceDrawer: ciclo (origen, emisión/folio, logística, pago), acciones en la cabecera
 * y tabs Resumen · Relaciones.
 */
export function InvoiceSheet({ id, open, onOpenChange, embedded = false, posSessionId = null, onActionSuccess }: InvoiceSheetProps) {
    // TODO(U6): reemplazar por el hook de detalle de billing al retirar el Hub.
    const hub = useOrderHubData({ invoiceId: id, enabled: open || embedded })
    const { loading, isError, fetchOrderDetails } = hub
    const invoice = (hub.activeInvoice ?? null) as Order | null
    const permissions = hub.userPermissions as string[]
    const isSale = invoice ? (invoice.is_sale_document === true || !!invoice.sale_order) : true
    const isNote = invoice?.dte_type === "NOTA_CREDITO" || invoice?.dte_type === "NOTA_DEBITO"
    const { data: relations } = useDocumentRelations(LABEL, invoice?.id ?? null)
    const invalidateDocuments = useInvalidateDocuments()

    const [tab, setTab] = useState("summary")
    const [domain, setDomain] = useState<DocumentDomain | null>(null)

    const handleSuccess = () => {
        void fetchOrderDetails()
        void invalidateDocuments()
        onActionSuccess?.()
    }

    const engine = useOrderActionEngine({ order: invoice, posSessionId, onActionSuccess: handleSuccess })
    const related = useOrderRelatedActions({ order: invoice, isSale, permissions, onSuccess: handleSuccess })

    const { printRef, handlePrint } = usePrintableDrawer()
    const displayId = invoice?.display_id ?? invoice?.number
    const identity = useDrawerIdentity(LABEL, "view", invoice, { overrideTitle: displayId ?? "Factura" })

    const { setEntityDisplay } = useGlobalModals()
    useEffect(() => {
        if (invoice?.id && displayId) setEntityDisplay(LABEL, invoice.id, String(displayId))
    }, [invoice?.id, displayId, setEntityDisplay])

    // NC/ND del registro buscan la factura entre `invoices`: la propia factura es su base.
    const actionDoc = useMemo(() => (invoice && !isNote ? { ...invoice, invoices: [invoice] } : invoice), [invoice, isNote])
    const resolved = useMemo(() => {
        const registry = isSale ? saleOrderActions : purchaseOrderActions
        const allowed = isNote ? NOTE_ACTIONS : INVOICE_ACTIONS
        return resolveRegistryActions(registry, actionDoc, permissions, (actionId) => !allowed.has(actionId))
    }, [isSale, isNote, actionDoc, permissions])

    const toItem = ({ action, disabled, disabledReason }: ResolvedDocumentAction<Order>): DocumentActionItem => ({
        id: action.id,
        label: action.label,
        icon: action.icon,
        disabled,
        disabledReason,
        onClick: () => (action.onClick && invoice ? action.onClick(invoice) : engine.run(action.id)),
    })

    const primary = PRIMARY_PRIORITY.map((pid) => resolved.find((r) => r.action.id === pid && !r.disabled)).find(Boolean) ?? null
    const sectionActions = useMemo(() => {
        const result: Partial<Record<DocumentDomain, DocumentActionItem[]>> = {}
        for (const r of resolved) {
            const d = CATEGORY_DOMAIN[r.category]
            if (d) (result[d] ??= []).push(toItem(r))
        }
        return result
        // toItem depende de invoice/engine, ya cubiertos por resolved
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [resolved])

    const lifecycleSteps = invoice ? getInvoiceLifecycle(invoice) : null
    const lines: OrderLine[] = invoice?.lines ?? invoice?.items ?? []

    const openRelationsAt = (stepId: string) => {
        setDomain(["origin", "billing", "logistics", "treasury"].includes(stepId) ? (stepId as DocumentDomain) : null)
        setTab("relations")
    }

    const tabs: DocumentSheetTab[] = invoice ? [
        { value: "summary", label: "Resumen", icon: FileText, content: <InvoiceSummaryTab invoice={invoice} /> },
        {
            value: "relations", label: "Relaciones", icon: Link2, badge: relations?.relations.length,
            content: (
                <DocumentRelationsTab
                    label={LABEL}
                    id={invoice.id}
                    sectionActions={sectionActions}
                    rowActions={related.rowActions}
                    domain={domain}
                    onDomainChange={setDomain}
                />
            ),
        },
    ] : []

    return (
        <>
            {invoice && (
                <PrintableLayout
                    ref={printRef}
                    title={invoice.dte_type_display ?? "Comprobante"}
                    displayId={String(displayId ?? "")}
                    subtitle={invoice.partner_name}
                >
                    {lines.map((line, idx) => (
                        <div key={line.id ?? idx} className="flex justify-between text-3xs">
                            <span className="flex-1">{line.product_name ?? line.description ?? "-"}</span>
                            <span className="w-12 text-right">{Math.round(Number(line.quantity ?? 0))}</span>
                            <span className="w-16 text-right">{formatCurrency(Number(line.subtotal ?? 0))}</span>
                        </div>
                    ))}
                    <div className="flex justify-between font-bold border-t mt-2 pt-1 text-xs">
                        <span>Total</span>
                        <span>{formatCurrency(Number(invoice.total))}</span>
                    </div>
                </PrintableLayout>
            )}

            <DocumentDrawerShell
                open={open}
                onOpenChange={onOpenChange}
                embedded={embedded}
                title={identity.title}
                subtitle={identity.subtitle}
                icon={identity.icon}
                headerActions={invoice && (
                    <DocumentActionsMenu
                        primary={primary ? toItem(primary) : null}
                        actions={[...resolved.map(toItem), ...related.invoiceActions({ id: invoice.id, status: invoice.status })]}
                        onPrint={handlePrint}
                    />
                )}
                isLoading={loading || (!invoice && !isError)}
                error={isError ? new Error("No se pudo cargar la factura") : undefined}
                loadingLabel="Cargando factura"
                lifecycle={lifecycleSteps && (
                    <DocumentLifecycle
                        steps={lifecycleSteps}
                        onStepClick={openRelationsAt}
                        activeStepId={tab === "relations" ? domain : null}
                    />
                )}
                tabs={tabs}
                tab={tab}
                onTabChange={setTab}
                sidebar={invoice && !embedded ? <ActivitySidebar entityType="invoice" entityId={invoice.id} /> : undefined}
            />

            {engine.host}
            {related.host}
        </>
    )
}
