"use client"

import React, { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { notFound, useRouter } from "next/navigation"
import api from "@/lib/api"
import { EntityDetailPage, FormFooter, SubmitButton, CancelButton, FormSkeleton } from "@/components/shared"
import { ProductForm } from "./ProductForm"

interface ProductDetailClientProps {
    productId: string
}

export function ProductDetailClient({ productId }: ProductDetailClientProps) {
    const { data: product, isLoading: loading, error: queryError } = useQuery({
        queryKey: ['product', productId],
        queryFn: async () => {
            const res = await api.get(`/inventory/products/${productId}/`)
            return res.data
        }
    })

    const error = queryError ? (queryError as any).response?.status || 500 : null

    if (error === 404) return notFound()
    if (error) return <div className="p-8 text-destructive">Error al cargar el producto</div>
    
    if (loading || !product) {
        return (
            <div className="flex-1 p-8">
                <FormSkeleton hasTabs tabs={6} cards={2} fields={5} />
            </div>
        )
    }

    return (
        <EntityDetailPage
            entityLabel="inventory.product"
            displayId={product.code || product.name}
            breadcrumb={[
                { label: "Productos", href: "/inventory/products" },
                { label: product.code || product.name, href: `/inventory/products/${productId}` }
            ]}
            instanceId={product.id}
            footer={
                <FormFooter
                    actions={
                        <>
                            <CancelButton onClick={() => router.push('/inventory/products')} disabled={isSaving} />
                            <SubmitButton form="product-form" loading={isSaving}>
                                Guardar Cambios
                            </SubmitButton>
                        </>
                    }
                />
            }
        >
            <div className="h-full">
                <ProductForm 
                    open={true}
                    inline={true}
                    onOpenChange={(open) => {
                        if (!open) router.push('/inventory/products')
                    }}
                    initialData={product} 
                    onLoadingChange={setIsSaving}
                    onSuccess={() => {
                        router.push('/inventory/products')
                        router.refresh()
                    }} 
                />
            </div>
        </EntityDetailPage>
    )
}
