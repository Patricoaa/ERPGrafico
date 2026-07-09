import type { Metadata } from "next"
import { PageSectionHeader } from "@/components/shared"
import { DocumentsClientView } from "@/features/inventory"

export const metadata: Metadata = {
    title: "Guías de Despacho | ERPGrafico",
}

export default function SalesDeliveriesPage() {
    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <PageSectionHeader title="Guías de Despacho" description="Historial de envíos y entregas a clientes, incluyendo notas de débito" />
            <DocumentsClientView documentTypeFilter="DELIVERY" />
        </div>)
}

