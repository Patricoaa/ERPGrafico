import type { Metadata } from "next"
import { PageSectionHeader } from "@/components/shared"
import { DocumentsClientView } from "@/features/inventory"

export const metadata: Metadata = {
    title: "Recepciones de Compra | ERPGrafico",
}

export default function PurchasingReceiptsPage() {
    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <PageSectionHeader title="Recepciones de Compra" description="Historial de ingresos de mercadería por compras y notas de débito" />
            <DocumentsClientView documentTypeFilter="RECEIPT" />
        </div>)
}

