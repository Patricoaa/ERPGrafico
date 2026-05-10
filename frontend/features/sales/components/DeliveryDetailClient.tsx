"use client"

import React, { useState, useEffect } from "react"
import { notFound, useRouter } from "next/navigation"
import api from "@/lib/api"
import { EntityDetailPage, FormFooter, SubmitButton, CancelButton, FormSkeleton } from "@/components/shared"
import { DeliveryForm } from "./DeliveryModal"
import { toast } from "sonner"
import { formatEntityDisplay } from "@/lib/entity-registry"

interface DeliveryDetailClientProps {
    orderId: string
}

export function DeliveryDetailClient({ orderId }: DeliveryDetailClientProps) {
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

    const orderCode = formatEntityDisplay('sales.saleorder', order);

    return (
        <EntityDetailPage
            entityType="sales.saledelivery"
            title="Despacho de Orden"
            displayId={orderCode}
            icon="truck"
            breadcrumb={[
                { label: "Ventas", href: "/sales/orders" },
                { label: orderCode, href: `/sales/orders/${orderId}` },
                { label: "Despacho", href: `/sales/deliveries/${orderId}` }
            ]}
            instanceId={order.id}
            footer={
                <FormFooter
                    actions={
                        <>
                            <CancelButton onClick={() => router.push('/sales/orders')} disabled={isSaving} />
                            <SubmitButton form="delivery-form-form" loading={isSaving}>
                                Confirmar Despacho
                            </SubmitButton>
                        </>
                    }
                />
            }
        >
            <div className="max-w-5xl mx-auto py-6">
                <DeliveryForm 
                    orderId={Number(orderId)} 
                    id="delivery-form"
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
