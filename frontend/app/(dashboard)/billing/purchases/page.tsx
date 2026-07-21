import { PageSectionHeader, ToolbarCreateButton } from "@/components/shared"
import { PurchaseInvoicesClientView } from "@/features/billing"

export default function PurchasesPage() {
    return (
        <>
            <PageSectionHeader title="DTE Recibidos" description="Documentos tributarios electrónicos recibidos" />
            <PurchaseInvoicesClientView createAction={<ToolbarCreateButton label="Nueva Factura" href="/billing/purchases?modal=new" />} />
        </>
    )
}
