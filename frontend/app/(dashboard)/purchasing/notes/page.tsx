import { PageSectionHeader } from "@/components/shared"
import { PurchasingOrdersClientView } from "../orders/components/PurchasingOrdersClientView"

export default function PurchaseNotesPage() {
    return (
        <>
            <PageSectionHeader title="Notas de Compra" description="Notas de crédito y débito de compras" />
            <PurchasingOrdersClientView viewMode="notes" />
        </>)
}
