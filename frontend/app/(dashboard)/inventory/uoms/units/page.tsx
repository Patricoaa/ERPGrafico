import { UoMsView } from "@/features/inventory"

interface PageProps {
    searchParams: Promise<{ modal?: string }>
}

export default async function UoMsUnitsPage({ searchParams }: PageProps) {
    const { modal } = await searchParams
    return <UoMsView activeTab="units" externalOpen={modal === 'new'} />
}
