"use client"

import React, { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { notFound, useRouter } from "next/navigation"
import api from "@/lib/api"
import { EntityDetailPage, FormFooter, SubmitButton, CancelButton, FormSkeleton } from "@/components/shared"
import { CategoryForm } from "./CategoryForm"

interface CategoryDetailClientProps {
    categoryId: string
}

export function CategoryDetailClient({ categoryId }: CategoryDetailClientProps) {
    const { data: category, isLoading: loading, error: queryError } = useQuery({
        queryKey: ['category', categoryId],
        queryFn: async () => {
            const res = await api.get(`/inventory/categories/${categoryId}/`)
            return res.data
        }
    })

    const error = queryError ? (queryError as any).response?.status || 500 : null

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
