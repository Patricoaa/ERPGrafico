"use client"

import React, { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { notFound, useRouter } from "next/navigation"
import api from "@/lib/api"
import { EntityDetailPage, FormFooter, SubmitButton, CancelButton, SkeletonShell } from "@/components/shared"
import { SaleOrderForm } from "./forms/SaleOrderForm"
import { toast } from "sonner"
import { SaleOrderSidebar } from "./SaleOrderSidebar"
import { useEntitySubscription } from "@/features/realtime"

interface SaleOrderDetailClientProps {
    orderId: string
}

export function SaleOrderDetailClient({ orderId }: SaleOrderDetailClientProps) {
    const [isSaving, setIsSaving] = useState(false)
    const router = useRouter()

    const detailQueryKey = useMemo(() => ['saleOrder', orderId] as const, [orderId])
    const detailKeys = useMemo(() => [detailQueryKey], [detailQueryKey])

    // Remote-change / cross-tab refresh for THIS sale order — see ADR-0026.
    useEntitySubscription(`sales.saleorder.${orderId}`, detailKeys)

    const { data: order, isLoading: loading, error: queryError } = useQuery({
        queryKey: detailQueryKey,
        queryFn: async () => {
            const res = await api.get(`/sales/orders/${orderId}/`)
            return res.data
        }
    })
    
    const error = queryError ? (queryError as any).response?.status || 500 : null

    if (error === 404) return notFound()
    if (error) return <div className="p-8 text-destructive">Error al cargar la orden de venta</div>
    
    return (
        <SkeletonShell isLoading={loading || !order} ariaLabel="Cargando orden de venta">
            <EntityDetailPage
                entityLabel="sales.saleorder"
                displayId={order?.number || ''}
                breadcrumb={[
                    { label: "Ventas", href: "/sales/orders" },
                    { label: order?.number || '', href: `/sales/orders/${orderId}` }
                ]}
                instanceId={order?.id}
                sidebar={<SaleOrderSidebar orderId={order?.id} />}
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
        </SkeletonShell>
    )
}