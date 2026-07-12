import type { Metadata } from "next"
import { ProductClientView } from "@/features/inventory"
import { PageSectionHeader, ToolbarCreateButton } from "@/components/shared"
import { serverFetch } from "@/lib/server-fetch"
import type { Product } from "@/features/inventory"

export const metadata: Metadata = {
    title: "Productos | ERPGrafico",
    description: "Gestión de catálogo, categorías y reglas de precios.",
}

interface PageProps {
    searchParams: Promise<{ modal?: string; search?: string; product_type?: string; category?: string; has_variants?: string; availability?: string }>
}

const FILTER_PARAMS = new Set(['search', 'product_type', 'category', 'has_variants', 'availability', 'is_active'])

export default async function ProductsPage({ searchParams }: PageProps) {
    const params = await searchParams
    const { modal } = params

    // Only pre-fetch when there are no active search/filter params; otherwise
    // the unfiltered server data would be immediately discarded by the client.
    const hasActiveFilters = Object.keys(params).some(k => FILTER_PARAMS.has(k))
    let initialProducts: Product[] | undefined
    if (!hasActiveFilters) {
        try {
            const data = await serverFetch<{ results: Product[] }>('inventory/products/', {
                params: {
                    page_size: '200',
                },
                revalidate: 10,
            })
            initialProducts = data.results
        } catch {
            // Client-side fetch handles fallback
        }
    }

    const createAction = <ToolbarCreateButton key="create-product" label="Nuevo Producto" href="/inventory/products?modal=new" />

    return (
        <>
            <PageSectionHeader title="Productos" description="Gestión de catálogo, categorías y reglas de precios" />
            <ProductClientView
                initialProducts={initialProducts}
                externalOpen={modal === 'new'}
                createAction={createAction}
            />
        </>)
}
