import { PageSectionHeader } from "@/components/shared"
import { UoMsView } from "@/features/inventory"

interface PageProps {
    searchParams: Promise<{ modal?: string }>
}

export default async function UoMsCategoriesPage({ searchParams }: PageProps) {
    const { modal } = await searchParams
    return (
        <>
            <PageSectionHeader title="Categorías de Unidades" description="Clasificación de unidades de medida" />
            <UoMsView activeTab="categories" externalOpen={modal === 'new'} />
        </>)
}
