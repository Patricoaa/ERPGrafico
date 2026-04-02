import { AttributeManager } from "@/features/inventory/components/AttributeManager"
import { LAYOUT_TOKENS } from "@/lib/styles"
import { PageHeader, PageHeaderButton } from "@/components/shared/PageHeader"
import Link from "next/link"

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
                titleActions={
                    <Link href="/inventory/attributes?modal=new">
                        <PageHeaderButton
                            iconName="plus"
                            circular
                            title="Nuevo Atributo"
                        />
                    </Link>
                }
            />
            <div className="pt-4">
                <AttributeManager externalOpen={isModalOpen} />
            </div>
        </div>
    )
}
