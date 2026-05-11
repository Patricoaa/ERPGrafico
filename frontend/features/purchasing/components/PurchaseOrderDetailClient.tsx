"use client"

import React, { useState, useEffect } from "react"
import { notFound, useRouter } from "next/navigation"
import api from "@/lib/api"
import { EntityDetailPage, FormFooter, SubmitButton, CancelButton, FormSkeleton } from "@/components/shared"
import { PurchaseOrderForm } from "./PurchaseOrderForm"

interface PurchaseOrderDetailClientProps {
    orderId: string
}

export function PurchaseOrderDetailClient({ orderId }: PurchaseOrderDetailClientProps) {
    const [order, setOrder] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<number | null>(null)
    const [isSaving, setIsSaving] = useState(false)
    const router = useRouter()

    useEffect(() => {
        api.get(`/purchasing/orders/${orderId}/`)
            .then(res => setOrder(res.data))
            .catch(err => setError(err.response?.status || 500))
            .finally(() => setLoading(false))
    }, [orderId])

    if (error === 404) return notFound()
    if (error) return <div className="p-8 text-destructive">Error al cargar la orden de compra</div>
    
    if (loading || !order) {
        return (
            <div className="flex-1 p-8">
                <FormSkeleton />
            </div>
        )
    }

    return (
        <EntityDetailPage
            entityLabel="purchasing.purchaseorder"
            displayId={order.number}
            breadcrumb={[
                { label: "Compras", href: "/purchasing/orders" },
                { label: order.number, href: `/purchasing/orders/${orderId}` }
            ]}
            instanceId={order.id}
            footer={
                <FormFooter
                    actions={
                        <>
                            <CancelButton onClick={() => router.push('/purchasing/orders')} disabled={isSaving} />
                            <SubmitButton form="purchase-order-form" loading={isSaving}>
                                Guardar Cambios
                            </SubmitButton>
                        </>
                    }
                />
            }
        >
            <div className="max-w-5xl mx-auto">
                <PurchaseOrderForm 
                    initialData={order} 
                    onLoadingChange={setIsSaving} 
                    onSuccess={() => {
                        router.push('/purchasing/orders')
                        router.refresh()
                    }} 
                />
            </div>
        </EntityDetailPage>
    )
}
