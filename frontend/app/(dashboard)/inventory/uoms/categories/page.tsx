import { UoMsView } from "@/features/inventory"

interface PageProps {
    searchParams: Promise<{ modal?: string }>
}

export default async function UoMsCategoriesPage({ searchParams }: PageProps) {
    const { modal } = await searchParams
    return <UoMsView activeTab="categories" externalOpen={modal === 'new'} />
}
