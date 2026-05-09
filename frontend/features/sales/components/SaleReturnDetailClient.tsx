"use client"

import React, { useState, useEffect } from "react"
import { notFound, useRouter } from "next/navigation"
import api from "@/lib/api"
import { EntityDetailPage, FormFooter, SubmitButton, CancelButton, FormSkeleton } from "@/components/shared"
import { SaleNoteForm } from "./SaleNoteModal"
import { toast } from "sonner"

interface SaleReturnDetailClientProps {
    orderId: string
}

export function SaleReturnDetailClient({ orderId }: SaleReturnDetailClientProps) {
    const [order, setOrder] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<number | null>(null)
    const [isSaving, setIsSaving] = useState(false)
    const router = useRouter()

    useEffect(() => {
        api.get(`/sales/orders/${orderId}/`)
            .then(res => setOrder(res.data))
            .catch(err => setError(err.response?.status || 500))
            .finally(() => setLoading(false))
    }, [orderId])

    if (error === 404) return notFound()
    if (error) return <div className="p-8 text-destructive">Error al cargar la orden de venta</div>
    
    if (loading || !order) {
        return (
            <div className="flex-1 p-8">
                <FormSkeleton />
            </div>
        )
    }

    return (
        <EntityDetailPage
            entityType="sale_return"
            title="Devolución de Orden"
            displayId={`NV-${order.number}`}
            icon="corner-down-left"
            breadcrumb={[
                { label: "Ventas", href: "/sales/orders" },
                { label: `NV-${order.number}`, href: `/sales/orders/${orderId}` },
                { label: "Devolución", href: `/sales/returns/${orderId}` }
            ]}
            instanceId={order.id}
            footer={
                <FormFooter
                    actions={
                        <>
                            <CancelButton onClick={() => router.push('/sales/orders')} disabled={isSaving} />
                            <SubmitButton form="sale-return-form-form" loading={isSaving}>
                                Confirmar Devolución
                            </SubmitButton>
                        </>
                    }
                />
            }
        >
            <div className="max-w-5xl mx-auto py-6">
                <SaleNoteForm 
                    orderId={Number(orderId)} 
                    orderNumber={order.number}
                    invoiceId={order.related_documents?.invoices?.[0]?.id}
                    id="sale-return-form"
                    initialType="NOTA_CREDITO"
                    onLoadingChange={setIsSaving} 
                    onSuccess={() => {
                        router.push('/sales/orders')
                        router.refresh()
                    }} 
                />
            </div>
        </EntityDetailPage>
    )
}
