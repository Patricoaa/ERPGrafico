import { AttributeManager } from "@/features/inventory"
import { LAYOUT_TOKENS } from "@/lib/styles"
import { PageHeader } from "@/components/shared/PageHeader"
import { ToolbarCreateButton } from "@/components/shared/ToolbarCreateButton"

interface PageProps {
    searchParams: Promise<{ modal?: string }>
}

export default async function AttributesPage({ searchParams }: PageProps) {
    const { modal } = await searchParams
    const isModalOpen = modal === "new"

    return (
        <div className={LAYOUT_TOKENS.view}>
            <PageHeader
                title="Atributos de Variantes"
                description="Gestiona los atributos y valores para productos con variaciones."
                variant="minimal"
                iconName="tags"
            />
            <div className="pt-4">
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
        </div>
    )
}
