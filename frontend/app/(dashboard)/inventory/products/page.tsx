import { Metadata } from "next"
import { ProductClientView } from "@/features/inventory"
import { ToolbarCreateButton } from "@/components/shared"

export const metadata: Metadata = {
    title: "Productos | ERPGrafico",
    description: "Gestión de catálogo, categorías y reglas de precios.",
}

interface PageProps {
    searchParams: Promise<{ modal?: string }>
}

export default async function ProductsPage({ searchParams }: PageProps) {
    const { modal } = await searchParams
    const createAction = <ToolbarCreateButton label="Nuevo Producto" href="/inventory/products?modal=new" />

    return (
        <ProductClientView
            externalOpen={modal === 'new'}
            createAction={createAction}
        />
    )
}
