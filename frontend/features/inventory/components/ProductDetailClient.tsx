"use client"

import React, { useState, useEffect } from "react"
import { notFound, useRouter } from "next/navigation"
import api from "@/lib/api"
import { EntityDetailPage, FormFooter, SubmitButton, CancelButton, FormSkeleton } from "@/components/shared"
import { ProductForm } from "./ProductForm"

interface ProductDetailClientProps {
    productId: string
}

export function ProductDetailClient({ productId }: ProductDetailClientProps) {
    const [product, setProduct] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<number | null>(null)
    const [isSaving, setIsSaving] = useState(false)
    const router = useRouter()

    useEffect(() => {
        api.get(`/inventory/products/${productId}/`)
            .then(res => setProduct(res.data))
            .catch(err => setError(err.response?.status || 500))
            .finally(() => setLoading(false))
    }, [productId])

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
