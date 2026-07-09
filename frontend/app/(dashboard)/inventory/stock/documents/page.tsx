import type { Metadata } from "next"
import { PageSectionHeader } from "@/components/shared"
import { DocumentsClientView } from "@/features/inventory"

export const metadata: Metadata = {
    title: "Documentos de Inventario | ERPGrafico",
}

export default function InventoryDocumentsPage() {
    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <DocumentsClientView />
        </div>
    )
}
