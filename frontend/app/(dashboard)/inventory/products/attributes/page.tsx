import { AttributesClientView } from "@/features/inventory"
import { ToolbarCreateButton } from "@/components/shared"

interface PageProps {
    searchParams: Promise<{ modal?: string }>
}

export default async function ProductsAttributesPage({ searchParams }: PageProps) {
    const { modal } = await searchParams
    const createAction = <ToolbarCreateButton label="Nuevo Atributo" href="/inventory/products/attributes?modal=new" />

    return (
        <AttributesClientView
            externalOpen={modal === 'new'}
            createAction={createAction}
        />
    )
}
