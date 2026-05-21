import { AttributeManager } from "@/features/inventory"
import { ToolbarCreateButton } from "@/components/shared/ToolbarCreateButton"

interface PageProps {
    searchParams: Promise<{ modal?: string }>
}

export default async function AttributesPage({ searchParams }: PageProps) {
    const { modal } = await searchParams
    const isModalOpen = modal === "new"

    return (
        <div className="pt-2 flex-1 min-h-0 flex flex-col">
            <AttributeManager
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
