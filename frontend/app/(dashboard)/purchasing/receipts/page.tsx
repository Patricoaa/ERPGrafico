import type { Metadata } from "next"
import { PageSectionHeader } from "@/components/shared"
import { PurchaseReceiptClientView } from "@/features/purchasing"

export const metadata: Metadata = {
    title: "Recepciones de Compra | ERPGrafico",
}

export default function PurchasingReceiptsPage() {
    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <PageSectionHeader title="Recepciones de Compra" description="Historial de ingresos de mercadería por compras y notas de débito" />
            <PurchaseReceiptClientView />
        </div>)
}
