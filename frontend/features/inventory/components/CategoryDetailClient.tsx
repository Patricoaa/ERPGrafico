"use client"

import { useState } from "react"
import { notFound, useRouter } from "next/navigation"
import { EntityDetailPage, FormFooter, SubmitButton, CancelButton, SkeletonShell } from "@/components/shared"
import { CategoryForm } from "./CategoryForm"
import { useCategory, type Category } from "../hooks/useCategories"

interface CategoryDetailClientProps {
    categoryId: string
}

// Placeholder tipado para el esqueleto — sigue el contrato.
const CATEGORY_SKELETON: Category = {
    id: 0,
    name: "————————————",
    parent: null,
    parent_name: "————————————",
    asset_account: null,
    income_account: null,
    expense_account: null,
}

export function CategoryDetailClient({ categoryId }: CategoryDetailClientProps) {
    const router = useRouter()
    const [isSaving, setIsSaving] = useState(false)
    const numericId = Number(categoryId)
    const idIsValid = Number.isFinite(numericId) && numericId > 0

    const { data: category, isLoading: loading, error: queryError } = useCategory(idIsValid ? numericId : null)
    const error = queryError ? (queryError as { response?: { status?: number } })?.response?.status ?? 500 : null

    if (!idIsValid || error === 404) return notFound()
    if (error) return <div className="p-8 text-destructive">Error al cargar la categoría</div>

    return (
        <SkeletonShell isLoading={loading || !category} ariaLabel="Cargando detalle de categoría">
            <EntityDetailPage
                entityLabel="inventory.product"
                displayId={(category ?? CATEGORY_SKELETON).name}
                breadcrumb={[
                    { label: "Categorías", href: "/inventory/categories" },
                    { label: (category ?? CATEGORY_SKELETON).name, href: `/inventory/categories/${categoryId}` }
                ]}
                instanceId={(category ?? CATEGORY_SKELETON).id ?? 0}
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
                        }}
                    />
                </div>
            </EntityDetailPage>
        </SkeletonShell>
    )
}
