"use client"

import { showApiError, getErrorMessage } from "@/lib/errors"
import React, { useState, useRef } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { ActionConfirmModal, DataTableView, createCodeColumn, createDateColumn, createCurrencyColumn, createSecondaryColumn, createContactColumn } from '@/components/shared'
import { type ColumnDef } from "@tanstack/react-table"
import {IconButton, SmartSearchBar, useSmartSearch, SegmentationBar, useSegmentation} from "@/components/shared"
import { invoiceSearchDef } from "@/features/billing/searchDef"
import { invoiceSegDef } from "@/features/billing/segmentationDef"
import { ArrowRight, ArrowLeft } from "lucide-react"
import { treasuryApi } from "@/features/treasury"
import { useInvoices } from "@/features/billing/hooks/useInvoices"
import { type Invoice, type InvoiceFilters } from "@/features/billing/types"
import { toast } from "sonner"
import { UnifiedNoteWizard } from "@/features/notes"
import { PaymentModal } from "@/features/treasury"
import { useHubPanel } from "@/components/providers/HubPanelProvider"
import { useConfirmAction } from "@/hooks/useConfirmAction"

import { getDtePrefix } from "@/lib/entity-registry"

export function SalesInvoicesClientView() {
    const { filters: textFilters, isFiltered: isTextFiltered, clearAll: clearText } = useSmartSearch(invoiceSearchDef)
    const basePeriod = { serverParamFrom: 'date_from', serverParamTo: 'date_to' }
    const { filters: segFilters, isFiltered: isSegFiltered, clearAll: clearSeg } = useSegmentation(invoiceSegDef, basePeriod)
    const isFiltered = isTextFiltered || isSegFiltered
    const { invoices, isLoading, isRefetching, refetch, annulInvoice } = useInvoices({ filters: { ...(textFilters as InvoiceFilters), ...(segFilters as Record<string, string>), mode: 'sale' } })
    const { openHub, closeHub, hubConfig, isHubOpen } = useHubPanel()
    const [notingInvoice, setNotingInvoice] = useState<Invoice | null>(null)
    const [payingInv, setPayingInv] = useState<Invoice | null>(null)
    const router = useRouter()
    const searchParams = useSearchParams()
    const pathname = usePathname()

    const toggleSelection = (inv: Invoice) => {
        const isSelected = hubConfig?.invoiceId === inv.id
        const params = new URLSearchParams(searchParams.toString())
        if (isSelected && isHubOpen) {
            params.delete('selected')
        } else {
            params.set('selected', String(inv.id))
        }
        const query = params.toString()
        router.push(query ? `${pathname}?${query}` : pathname, { scroll: false })
    }

    // El motivo se captura en el modal de anulación y se reutiliza en el force-retry
    const annulReasonRef = useRef('')

    const forceAnnulConfirm = useConfirmAction<number>(async (id) => {
        try {
            await annulInvoice({ id, force: true, reason: annulReasonRef.current })
        } catch (error: unknown) {
            toast.error(getErrorMessage(error) || "Error al anular el documento.")
        }
    })

    const annulConfirm = useConfirmAction<number>(async (id) => {
        try {
            await annulInvoice({ id, force: false, reason: annulReasonRef.current })
        } catch (error: unknown) {
            console.error("Error annulling invoice:", error)
            const errorMessage = getErrorMessage(error) || ""
            if (errorMessage.includes("pagos")) {
                forceAnnulConfirm.requestConfirm(id)
                return
            }
            toast.error(errorMessage || "Error al anular el documento.")
        }
    })

    const handleAnnul = (id: number) => {
        annulConfirm.requestConfirm(id)
    }

    const handlePayment = async (data: Record<string, unknown>) => {
        if (!payingInv) return
        const d = data as unknown as { amount: number; paymentMethod: string; transaction_number?: string; is_pending_registration?: boolean; treasury_account_id?: string | number; dteType?: string; documentReference?: string; documentDate?: string; documentAttachment?: File | Blob }
        try {
            const formData = new FormData()
            formData.append('amount', d.amount.toString())
            let paymentType = 'INBOUND'
            if (payingInv.dte_type === 'NOTA_CREDITO') paymentType = 'OUTBOUND'
            formData.append('payment_type', paymentType)
            const prefix = ['NOTA_CREDITO', 'NOTA_DEBITO'].includes(payingInv.dte_type) ? getDtePrefix(payingInv.dte_type) : 'PAGO';
            formData.append('reference', `${prefix}-${payingInv.number}`)
            formData.append('sale_order', payingInv.sale_order ? payingInv.sale_order.toString() : '')
            formData.append('invoice', payingInv.id.toString())
            formData.append('payment_method', d.paymentMethod)
            if (d.transaction_number) formData.append('transaction_number', d.transaction_number)
            if (d.is_pending_registration !== undefined) formData.append('is_pending_registration', d.is_pending_registration.toString())
            if (d.treasury_account_id) formData.append('treasury_account_id', String(d.treasury_account_id))
            if (d.dteType) formData.append('dte_type', d.dteType)
            if (d.documentReference) formData.append('document_reference', d.documentReference)
            if (d.documentDate) formData.append('document_date', d.documentDate)
            if (d.documentAttachment) formData.append('document_attachment', d.documentAttachment)

            await treasuryApi.createPayment(formData)
            toast.success("Operación registrada correctamente")
            setPayingInv(null)
            refetch()
        } catch (error: unknown) {
            console.error("Error registering payment:", error)
            showApiError(error, "Error al registrar la operación")
        }
    }

    const columns: ColumnDef<Invoice>[] = [
        createCodeColumn<Invoice>("number", "Folio", {
            render: (row) => <>{row.display_id ?? row.number}</>,
        }),
        createDateColumn<Invoice>("date", "Fecha"),
        createSecondaryColumn<Invoice>("dte_type_display", "Tipo"),
        createContactColumn<Invoice>("partner_name", "Cliente", "partner"),
        createCurrencyColumn<Invoice>("total", "Total"),
        {
            id: "hub_trigger",
            header: () => null,
            cell: ({ row }) => {
                const item = row.original
                const isSelected = hubConfig?.invoiceId === item.id
                return (
                    <div className="flex justify-end pr-2">
                        <IconButton
                            circular
                            className="h-8 w-8 hover:bg-transparent"
                            onClick={() => toggleSelection(item)}
                        >
                            {isSelected && isHubOpen ? (
                                <ArrowLeft className="h-4 w-4 text-primary animate-in fade-in slide-in-from-right-1 duration-300" />
                            ) : (
                                <ArrowRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                            )}
                        </IconButton>
                    </div>
                )
            },
        },
    ]

    return (
        <div className="flex-1 min-h-0 flex flex-col">

            <div className="flex-1 min-h-0">
                <DataTableView
                    entityLabel="billing.invoice"
                    columns={columns}
                    data={invoices}
                    isLoading={isLoading}
                    isRefetching={isRefetching}
                    onRowClick={(row: Invoice) => toggleSelection(row)}
                    variant="embedded"
                    smartSearch={<SmartSearchBar searchDef={invoiceSearchDef} placeholder="Buscar facturas..." className="w-full" />}
                    segmentation={<SegmentationBar def={invoiceSegDef} basePeriod={basePeriod} />}
                    showReset={isFiltered}
                    onReset={() => { clearText(); clearSeg() }}
                    defaultPageSize={20}
                    isSelected={(data: Invoice) => hubConfig?.invoiceId === data.id}
                    isHubOpen={isHubOpen}
                    isFiltered={isFiltered}
                    emptyState={{
                        context: "finance",
                        title: "Aún no hay documentos de venta",
                        description: "Las boletas y facturas que emitas aparecerán aquí.",
                    }}
                    cardGroupBy={{ field: 'date', sort: 'desc', aggregators: [{ key: 'total', label: 'Total', field: 'total', fn: 'sum', format: 'money' }, { key: 'count', label: 'Items', fn: 'count', format: 'integer' }] }}
                />
            </div>

            {notingInvoice && (
                <UnifiedNoteWizard
                    open={!!notingInvoice}
                    onOpenChange={(open) => !open && setNotingInvoice(null)}
                    mode="sales"
                    initialType="NOTA_CREDITO"
                    features={{ logistics: true, manufacturing: true }}
                    referenceLabel={notingInvoice.number as string | undefined}
                    fetchSource={async () => {
                        const invoiceId = notingInvoice.id;
                        const { billingApi } = await import('@/features/billing/api/billingApi')
                        const inv = (await billingApi.getInvoice(invoiceId) as unknown) as Record<string, unknown>
                        const invLines = ((inv.lines as Record<string, unknown>[]) || []).map((l: Record<string, unknown>) => ({
                            lineId: l.id as number,
                            productId: l.product as number,
                            productName: l.product_name as string,
                            productCode: l.product_code as string | undefined,
                            productType: l.product_type as string | undefined,
                            trackInventory: l.track_inventory as boolean | undefined,
                            hasBom: l.has_bom as boolean | undefined,
                            requiresAdvancedManufacturing: l.requires_advanced_manufacturing as boolean | undefined,
                            mfgAutoFinalize: l.mfg_auto_finalize as boolean | undefined,
                            createsStockMove: (l.track_inventory as boolean) && (l.product_type as string) !== 'MANUFACTURABLE',
                            uomName: l.uom_name as string | undefined,
                            originalQuantity: (l.quantity_delivered as number) || (l.quantity as number),
                            noteQuantity: 0,
                            noteUnitPrice: (l.unit_price as number) || 0,
                            taxAmountPerUnit: ((l.unit_price as number) || 0) * (((l.tax_rate as number) ?? 19) / 100),
                            reason: '',
                        }))
                        return {
                            label: `${inv.dte_type_display as string} ${inv.number as string}`,
                            isExempt: (inv.dte_type as string) === 'FACTURA_EXENTA' || (inv.dte_type as string) === 'BOLETA_EXENTA',
                            originalTotal: inv.total as number,
                            lines: invLines,
                        }
                    }}
                    onSubmit={async (payload) => {
                        const invoiceId = notingInvoice.id;
                        const { billingApi } = await import('@/features/billing/api/billingApi')
                        const formData = new FormData()
                        formData.append('original_invoice_id', invoiceId.toString())
                        formData.append('note_type', payload.noteType)
                        formData.append('selected_items', JSON.stringify(payload.lines.map(l => ({
                            line_id: l.lineId,
                            product_id: l.productId,
                            quantity: l.noteQuantity,
                            unit_price: l.noteUnitPrice,
                            tax_amount: l.taxAmountPerUnit ?? 0,
                            reason: l.reason ?? '',
                            manufacturing_data: l.manufacturingData ?? null,
                        }))))
                        if (payload.logistics) formData.append('logistics_data', JSON.stringify(payload.logistics))
                        const reg = payload.registration
                        formData.append('registration_data', JSON.stringify({ document_number: reg.documentNumber, document_date: reg.documentDate, is_pending: reg.isPending }))
                        if (reg.attachment) formData.append('document_attachment', reg.attachment)
                        if (payload.payment.method) formData.append('payment_data', JSON.stringify(payload.payment))
                        await billingApi.noteWorkflowCheckout(formData)
                    }}
                    onSuccess={refetch}
                />
            )}

            {payingInv && (
                <PaymentModal
                    open={!!payingInv}
                    onOpenChange={(open) => !open && setPayingInv(null)}
                    onConfirm={handlePayment}
                    isPurchase={false}
                    total={parseFloat(payingInv.total)}
                    pendingAmount={payingInv.pending_amount ?? parseFloat(payingInv.total)}
                    hideDteFields={true}
                    isRefund={payingInv.dte_type === 'NOTA_CREDITO'}
                    existingInvoice={{ dte_type: payingInv.dte_type || '', number: payingInv.number || '', document_attachment: null }}
                />
            )}

            <ActionConfirmModal
                open={annulConfirm.isOpen}
                onOpenChange={(open) => { if (!open) annulConfirm.cancel() }}
                onConfirm={(reason) => { annulReasonRef.current = reason ?? ''; return annulConfirm.confirm() }}
                title="Anular Documento"
                description="¿Está seguro de que desea ANULAR este documento? Esta acción generará reversos contables y no se puede deshacer."
                variant="destructive"
                requireReason
                reasonLabel="Motivo de la anulación"
            />

            <ActionConfirmModal
                open={forceAnnulConfirm.isOpen}
                onOpenChange={(open) => { if (!open) forceAnnulConfirm.cancel() }}
                onConfirm={forceAnnulConfirm.confirm}
                title="Desvincular y Anular Pagos"
                description="Este documento tiene pagos asociados. ¿Desea anular también todos los pagos vinculados automáticamente?"
                variant="destructive"
            />
        </div>
    )
}
