"use client"

import React, { useState } from "react"
import { notFound, useRouter } from "next/navigation"
import { EntityDetailPage, FormFooter, SubmitButton, CancelButton, SkeletonShell } from "@/components/shared"
import { PurchaseOrderModal } from "./PurchaseOrderModal"
import { usePurchasingOrder } from "../hooks/usePurchasing"

interface PurchaseOrderDetailClientProps {
    orderId: string
}

export function PurchaseOrderDetailClient({ orderId }: PurchaseOrderDetailClientProps) {
    const { order, isLoading: loading } = usePurchasingOrder(Number(orderId))

    const router = useRouter()
    const [isSaving, setIsSaving] = useState(false)

    if (!loading && !order) return notFound()
    
    if (loading || !order) {
         return (
             <div className="flex-1 p-8">
                 <SkeletonShell isLoading={loading || !order} ariaLabel="Cargando detalle de orden de compra" />
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
                <PurchaseOrderModal 
                    {...{ initialData: order, onLoadingChange: setIsSaving } as any}
                    onSuccess={() => {
                        router.push('/purchasing/orders')
                        router.refresh()
                    }} 
                />
            </div>
        </EntityDetailPage>
    )
}
