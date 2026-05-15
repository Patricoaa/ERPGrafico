"use client"

import React, { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { notFound, useRouter } from "next/navigation"
import api from "@/lib/api"
import { EntityDetailPage, FormFooter, SubmitButton, CancelButton, FormSkeleton } from "@/components/shared"
import { SaleOrderForm } from "./forms/SaleOrderForm"
import { toast } from "sonner"
import { SaleOrderSidebar } from "./SaleOrderSidebar"

interface SaleOrderDetailClientProps {
    orderId: string
}

export function SaleOrderDetailClient({ orderId }: SaleOrderDetailClientProps) {
    const [isSaving, setIsSaving] = useState(false)
    const router = useRouter()
    
    const { data: order, isLoading: loading, error: queryError } = useQuery({
        queryKey: ['saleOrder', orderId],
        queryFn: async () => {
            const res = await api.get(`/sales/orders/${orderId}/`)
            return res.data
        }
    })
    
    const error = queryError ? (queryError as any).response?.status || 500 : null

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
            entityLabel="sales.saleorder"
            displayId={order.number}
            breadcrumb={[
                { label: "Ventas", href: "/sales/orders" },
                { label: order.number, href: `/sales/orders/${orderId}` }
            ]}
            instanceId={order.id}
            sidebar={<SaleOrderSidebar orderId={order.id} />}
            footer={
                <FormFooter
                    actions={
                        <>
                            <CancelButton onClick={() => router.push('/sales/orders')} disabled={isSaving} />
                            <SubmitButton form="sale-order-form" loading={isSaving}>
                                Guardar Cambios
                            </SubmitButton>
                        </>
                    }
                />
            }
        >
            <div className="max-w-5xl mx-auto">
                <SaleOrderForm 
                    initialData={order} 
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
