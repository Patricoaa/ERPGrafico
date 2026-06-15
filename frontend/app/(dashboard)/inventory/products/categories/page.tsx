import { CategoryClientView } from "@/features/inventory"
import { ToolbarCreateButton } from "@/components/shared"

interface PageProps {
    searchParams: Promise<{ modal?: string }>
}

export default async function ProductsCategoriesPage({ searchParams }: PageProps) {
    const { modal } = await searchParams
    const createAction = <ToolbarCreateButton label="Nueva Categoría" href="/inventory/products/categories?modal=new" />

    return (
        <CategoryClientView
            externalOpen={modal === 'new'}
            createAction={createAction}
        />
    )
}
