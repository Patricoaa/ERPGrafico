"use client"

import { useQuery } from "@tanstack/react-query"
import { notFound } from "next/navigation"
import api from "@/lib/api"
import { EntityDetailPage, FormSkeleton } from "@/components/shared"
import { DomainCard } from "@/components/shared/DomainCard"

interface InvoiceDetailClientProps {
    invoiceId: string
    type: 'sale' | 'purchase'
}

export function InvoiceDetailClient({ invoiceId, type }: InvoiceDetailClientProps) {
    const { data: invoice, isLoading: loading, error: queryError } = useQuery({
        queryKey: ['invoice', invoiceId],
        queryFn: async () => {
            const res = await api.get(`/billing/invoices/${invoiceId}/`)
            return res.data
        }
    })

    const error = queryError ? (queryError as any).response?.status || 500 : null

    if (error === 404) return notFound()
    if (error) return <div className="p-8 text-destructive">Error al cargar la factura</div>

    if (loading || !invoice) {
        return (
            <div className="flex-1 p-8">
                <FormSkeleton />
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
