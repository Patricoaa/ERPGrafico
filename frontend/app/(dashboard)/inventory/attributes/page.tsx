import { PageSectionHeader } from "@/components/shared"
import { AttributesClientView } from "@/features/inventory"
import { ToolbarCreateButton } from '@/components/shared'

interface PageProps {
    searchParams: Promise<{ modal?: string }>
}

export default async function AttributesPage({ searchParams }: PageProps) {
    const { modal } = await searchParams
    const isModalOpen = modal === "new"

    return (
        <div className="h-full flex flex-col">
            <PageSectionHeader title="Atributos de Producto" description="Variantes, tallas, colores y otros atributos" />
            <AttributesClientView
                externalOpen={isModalOpen}
                createAction={
                    <ToolbarCreateButton
                        label="Nuevo Atributo"
                        href="/inventory/attributes?modal=new"
                    />
                }
            />
        </div>
    )
}
