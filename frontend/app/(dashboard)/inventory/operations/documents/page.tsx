import type { Metadata } from "next"
import { PageSectionHeader, ToolbarCreateButton } from "@/components/shared"
import { DocumentsClientView } from "@/features/inventory"

export const metadata: Metadata = {
    title: "Documentos de Inventario | ERPGrafico",
}

interface PageProps {
    searchParams: Promise<{ modal?: string }>
}

export default async function InventoryDocumentsPage({ searchParams }: PageProps) {
    const { modal } = await searchParams

    const createAction = <ToolbarCreateButton label="Nuevo Documento" href="/inventory/operations/documents?modal=new" />

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <PageSectionHeader
                title="Documentos de Inventario"
                description="Recepciones, entregas, transferencias y ajustes de mercadería."
            />
            <DocumentsClientView
                externalOpen={modal === 'new'}
                createAction={createAction}
            />
        </div>
    )
}
