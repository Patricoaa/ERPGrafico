"use client"

import { showApiError, getErrorMessage } from "@/lib/errors"
import React, { useState, useEffect } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { DataTable } from "@/components/ui/data-table"
import { DataCell } from "@/components/ui/data-table-cells"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { ColumnDef } from "@tanstack/react-table"
import { IconButton } from "@/components/shared"
import { EntityCard } from "@/components/shared/EntityCard"
import { LayoutDashboard, ArrowRight, ArrowLeft, List } from "lucide-react"
import { treasuryApi } from "@/features/treasury/api/treasuryApi"
import { useInvoices } from "@/features/billing/hooks/useInvoices"
import { Invoice } from "@/features/billing/types"
import { EmptyState } from "@/components/shared/EmptyState"
import { toast } from "sonner"
import { SaleNoteModal } from "@/features/sales"
import { PaymentModal } from "@/features/treasury/components/PaymentModal"
import { useHubPanel } from "@/components/providers/HubPanelProvider"
import { InvoiceCard } from "@/features/billing/components/InvoiceCard"
import { useConfirmAction } from "@/hooks/useConfirmAction"
import { ActionConfirmModal } from "@/components/shared/ActionConfirmModal"

export function SalesInvoicesClientView() {
    const { invoices, isLoading, refetch, annulInvoice } = useInvoices()
    const { openHub, closeHub, hubConfig, isHubOpen } = useHubPanel()
    const [notingInvoice, setNotingInvoice] = useState<Invoice | null>(null)
    const [payingInv, setPayingInv] = useState<Invoice | null>(null)
    const router = useRouter()
    const searchParams = useSearchParams()
    const pathname = usePathname()

    const [currentView, setCurrentView] = React.useState<'card' | 'list'>(
        (searchParams.get('view') as 'card' | 'list') ?? 'card'
    )

    const handleViewChange = (v: string) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set('view', v)
        router.push(`${pathname}?${params.toString()}`, { scroll: false })
        setCurrentView(v as 'card' | 'list')
    }

    useEffect(() => {
        const viewParam = searchParams.get('view')
        if (!viewParam) {
            const params = new URLSearchParams(searchParams.toString())
            params.set('view', 'card')
            router.replace(`${pathname}?${params.toString()}`, { scroll: false })
            setCurrentView('card')
        } else if (viewParam !== currentView) {
            setCurrentView(viewParam as 'card' | 'list')
        }
    }, [searchParams, pathname, router, currentView])

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

    const viewOptions = [
        { label: "Lista", value: "list", icon: List },
        { label: "Tarjeta", value: "card", icon: LayoutDashboard }

    ]

    const forceAnnulConfirm = useConfirmAction<number>(async (id) => {
        try {
            await annulInvoice({ id, force: true })
        } catch (error: unknown) {
            toast.error(getErrorMessage(error) || "Error al anular el documento.")
        }
    })

    const annulConfirm = useConfirmAction<number>(async (id) => {
        try {
            await annulInvoice({ id, force: false })
        } catch (error: unknown) {
            console.error("Error annulling invoice:", error)
            const errorMessage = getErrorMessage(error) || ""
            if (errorMessage.includes("Debe anular los pagos asociados")) {
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
        const d = data as any
        try {
            const formData = new FormData()
            formData.append('amount', d.amount.toString())
            let paymentType = 'INBOUND'
            if (payingInv.dte_type === 'NOTA_CREDITO') paymentType = 'OUTBOUND'
            formData.append('payment_type', paymentType)
            formData.append('reference', `${payingInv.dte_type === 'NOTA_CREDITO' ? 'NC' : payingInv.dte_type === 'NOTA_DEBITO' ? 'ND' : 'PAGO'}-${payingInv.number}`)
            formData.append('sale_order', payingInv.sale_order ? payingInv.sale_order.toString() : '')
            formData.append('invoice', payingInv.id.toString())
            formData.append('payment_method', d.paymentMethod)
            if (d.transaction_number) formData.append('transaction_number', d.transaction_number)
            if (d.is_pending_registration !== undefined) formData.append('is_pending_registration', d.is_pending_registration.toString())
            if (d.treasury_account_id) formData.append('treasury_account_id', d.treasury_account_id)
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
        {
            accessorKey: "number",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Folio" className="justify-center" />,
            cell: ({ row }) => <DataCell.DocumentId label="billing.invoice" data={row.original} />,
        },
        {
            accessorKey: "date",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Fecha" className="justify-center" />,
            cell: ({ row }) => <DataCell.Date value={row.getValue("date")} />
        },
        {
            accessorKey: "dte_type_display",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Tipo" className="justify-center" />,
            cell: ({ row }) => <DataCell.Secondary className="font-bold uppercase text-[10px] text-center">{row.getValue("dte_type_display")}</DataCell.Secondary>
        },
        {
            accessorKey: "partner_name",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Cliente" className="justify-center" />,
            cell: ({ row }) => <DataCell.ContactLink contactId={(row.original as any).customer as number || (row.original as any).partner as number}>{row.getValue("partner_name")}</DataCell.ContactLink>
        },
        {
            accessorKey: "total",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Total" className="justify-center" />,
            cell: ({ row }) => <DataCell.Currency value={row.getValue("total")} />
        },
        {
            accessorKey: "status",
            header: () => null,
            cell: () => null,
            filterFn: (row, id, value) => value.includes(row.getValue(id)),
        },
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
        <div className="space-y-4 px-1">

            <DataTable
                columns={columns}
                data={invoices}
                isLoading={isLoading}
                onRowClick={(row: Invoice) => toggleSelection(row)}
                variant="embedded"
                currentView={currentView}
                onViewChange={handleViewChange}
                viewOptions={viewOptions}
                filterColumn="partner_name"
                searchPlaceholder="Buscar por cliente..."
                facetedFilters={[
                    {
                        column: "status",
                        title: "Estado",
                        options: [
                            { label: "Borrador", value: "DRAFT" },
                            { label: "Publicado", value: "POSTED" },
                            { label: "Pagado", value: "PAID" },
                            { label: "Anulado", value: "CANCELLED" },
                        ],
                    },
                ]}
                useAdvancedFilter={true}
                defaultPageSize={20}
                renderCustomView={currentView === 'card' ? (table) => {
                    const rows = table.getRowModel().rows
                    if (rows.length === 0) {
                        return (
                            <div className="py-12">
                                <EmptyState
                                    context="search"
                                    title="No hay documentos"
                                    description="No se encontraron facturas o boletas emitidas."
                                />
                            </div>
                        )
                    }
                    return (
                        <div className="grid gap-3 pt-2">
                            {rows.map((row: any) => {
                                const inv = row.original as Invoice
                                const isSelected = hubConfig?.invoiceId === inv.id
                                return (
                                    <InvoiceCard
                                        key={inv.id}
                                        item={inv}
                                        type="sale_invoice"
                                        isSelected={isSelected}
                                        visibleColumns={table.getState().columnVisibility}
                                        onClick={() => toggleSelection(inv)}
                                    />
                                )
                            })}
                        </div>
                    )
                } : undefined}
                renderLoadingView={currentView === 'card' ? () => (
                    <div className="grid gap-3 pt-2">
                        {Array.from({ length: 8 }).map((_, i) => (
                            <EntityCard.Skeleton key={i} />
                        ))}
                    </div>
                ) : undefined}
            />

            {notingInvoice && (
                <SaleNoteModal
                    open={!!notingInvoice}
                    onOpenChange={(open) => !open && setNotingInvoice(null)}
                    orderId={notingInvoice.sale_order || undefined}
                    orderNumber={notingInvoice.sale_order_number || undefined}
                    invoiceId={notingInvoice.id}
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
                onConfirm={annulConfirm.confirm}
                title="Anular Documento"
                description="¿Está seguro de que desea ANULAR este documento? Esta acción generará reversos contables y no se puede deshacer."
                variant="destructive"
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
