"use client"

import React, { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { notFound, useRouter } from "next/navigation"
import api from "@/lib/api"
import { EntityDetailPage, FormFooter, SubmitButton, CancelButton, FormSkeleton } from "@/components/shared"
import { SaleNoteForm } from "./SaleNoteModal"
import { toast } from "sonner"
import { formatEntityDisplay } from "@/lib/entity-registry"

interface SaleReturnDetailClientProps {
    orderId: string
}

export function SaleReturnDetailClient({ orderId }: SaleReturnDetailClientProps) {
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

    const orderCode = formatEntityDisplay('sales.saleorder', order);

    return (
        <EntityDetailPage
            entityType="sales.salereturn"
            title="Devolución de Orden"
            displayId={orderCode}
            icon="corner-down-left"
            breadcrumb={[
                { label: "Ventas", href: "/sales/orders" },
                { label: orderCode, href: `/sales/orders/${orderId}` },
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
