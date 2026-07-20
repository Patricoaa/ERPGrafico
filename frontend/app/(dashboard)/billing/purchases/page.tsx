import { PageSectionHeader, ToolbarCreateButton } from "@/components/shared"
import { PurchaseInvoicesClientView } from "@/features/billing"

export default function PurchasesPage() {
    return (
        <>
            <PageSectionHeader title="Facturas de Compra" description="Documentos tributarios electrónicos de compra" />
            <PurchaseInvoicesClientView createAction={<ToolbarCreateButton label="Nueva Factura" href="/billing/purchases?modal=new" />} />
        </>
    )
}
