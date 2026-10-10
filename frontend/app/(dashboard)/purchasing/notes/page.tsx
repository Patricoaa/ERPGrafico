import { PageSectionHeader } from "@/components/shared"
import { PurchasingOrdersClientView } from "../orders/components/PurchasingOrdersClientView"

export default function PurchaseNotesPage() {
    return (
        <>
            <PageSectionHeader as="h1" title="Notas de Compra" description="Notas de crédito y débito de compras" />
            <PurchasingOrdersClientView viewMode="notes" />
        </>)
}
