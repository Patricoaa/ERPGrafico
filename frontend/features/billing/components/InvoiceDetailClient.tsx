"use client"

import { notFound } from "next/navigation"
import { EntityDetailPage, SkeletonShell } from "@/components/shared"
import { DomainCard } from "@/components/shared/DomainCard"
import { useInvoice } from "../hooks/useInvoices"

interface InvoiceDetailClientProps {
    invoiceId: string
    type: 'sale' | 'purchase'
}

export function InvoiceDetailClient({ invoiceId, type }: InvoiceDetailClientProps) {
    const { data: invoice, isLoading: loading } = useInvoice(Number(invoiceId))

    if (!loading && !invoice) return notFound()

    if (loading || !invoice) {
         return (
             <div className="flex-1 p-8">
                 <SkeletonShell isLoading={loading || !invoice} ariaLabel="Cargando detalle de factura" />
             </div>
         )
     }

    const title = type === 'sale' ? 'Factura de Venta' : 'Factura de Compra'
    const breadcrumbRoot = type === 'sale'
        ? { label: "Ventas", href: "/billing/sales" }
        : { label: "Compras", href: "/billing/purchases" }

    const displayId = invoice.display_id || `${invoice.dte_type_display} ${invoice.number}` || 'Documento'

    return (
        <EntityDetailPage
            entityType="invoice"
            title={title}
            displayId={displayId}
            icon={type === 'sale' ? "receipt" : "package"}
            breadcrumb={[
                breadcrumbRoot,
                { label: displayId, href: `/billing/${type === 'sale' ? 'sales' : 'purchases'}/${invoiceId}` }
            ]}
            instanceId={invoice.id}
            readonly
        >
            <div className="max-w-4xl mx-auto py-6">
                <DomainCard
                    label="billing.invoice"
                    data={invoice}
                />
            </div>
        </EntityDetailPage>
    )
}
