import { PageSectionHeader } from "@/components/shared"
import { UoMsView } from "@/features/inventory"

interface PageProps {
    searchParams: Promise<{ modal?: string }>
}

export default async function UoMsUnitsPage({ searchParams }: PageProps) {
    const { modal } = await searchParams
    return (
        <>
            <PageSectionHeader title="Unidades de Medida" description="Gestión de unidades y factores de conversión" />
            <UoMsView activeTab="units" externalOpen={modal === 'new'} />
        </>)
}
