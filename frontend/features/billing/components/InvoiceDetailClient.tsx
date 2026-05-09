"use client"

import React, { useState, useEffect } from "react"
import { notFound } from "next/navigation"
import api from "@/lib/api"
import { EntityDetailPage, FormSkeleton } from "@/components/shared"
import { InvoiceCard } from "./InvoiceCard"
import { Invoice } from "../types"

interface InvoiceDetailClientProps {
    invoiceId: string
    type: 'sale' | 'purchase'
}

export function InvoiceDetailClient({ invoiceId, type }: InvoiceDetailClientProps) {
    const [invoice, setInvoice] = useState<Invoice | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<number | null>(null)

    useEffect(() => {
        api.get(`/billing/invoices/${invoiceId}/`)
            .then(res => setInvoice(res.data))
            .catch(err => setError(err.response?.status || 500))
            .finally(() => setLoading(false))
    }, [invoiceId])

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
            entityType={type === 'sale' ? "sale_invoice" : "purchase_invoice"}
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
                <InvoiceCard 
                    item={invoice} 
                    type={type === 'sale' ? 'sale_invoice' : 'purchase_invoice'} 
                    isDetailView={true} 
                />
            </div>
        </EntityDetailPage>
    )
}
