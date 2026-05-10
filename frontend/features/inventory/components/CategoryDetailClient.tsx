"use client"

import React, { useState, useEffect } from "react"
import { notFound, useRouter } from "next/navigation"
import api from "@/lib/api"
import { EntityDetailPage, FormFooter, SubmitButton, CancelButton, FormSkeleton } from "@/components/shared"
import { CategoryForm } from "./CategoryForm"

interface CategoryDetailClientProps {
    categoryId: string
}

export function CategoryDetailClient({ categoryId }: CategoryDetailClientProps) {
    const [category, setCategory] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<number | null>(null)
    const [isSaving, setIsSaving] = useState(false)
    const router = useRouter()

    useEffect(() => {
        api.get(`/inventory/categories/${categoryId}/`)
            .then(res => setCategory(res.data))
            .catch(err => setError(err.response?.status || 500))
            .finally(() => setLoading(false))
    }, [categoryId])

    if (error === 404) return notFound()
    if (error) return <div className="p-8 text-destructive">Error al cargar la categoría</div>
    
    if (loading || !category) {
        return (
            <div className="flex-1 p-8">
                <FormSkeleton />
            </div>
        )
    }

    return (
        <EntityDetailPage
            entityLabel="inventory.product"
            displayId={category.name}
            breadcrumb={[
                { label: "Categorías", href: "/inventory/categories" },
                { label: category.name, href: `/inventory/categories/${categoryId}` }
            ]}
            instanceId={category.id}
            footer={
                <FormFooter
                    actions={
                        <>
                            <CancelButton onClick={() => router.push('/inventory/categories')} disabled={isSaving} />
                            <SubmitButton form="category-form" loading={isSaving}>
                                Guardar Cambios
                            </SubmitButton>
                        </>
                    }
                />
            }
        >
            <div className="max-w-5xl mx-auto h-full">
                <CategoryForm 
                    open={true}
                    inline={true}
                    onOpenChange={(open) => {
                        if (!open) router.push('/inventory/categories')
                    }}
                    initialData={category} 
                    onLoadingChange={setIsSaving}
                    onSuccess={() => {
                        router.push('/inventory/categories')
                        router.refresh()
                    }} 
                />
            </div>
        </EntityDetailPage>
    )
}
