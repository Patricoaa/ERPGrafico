import { ToolbarCreateButton } from "@/components/shared"
import { PurchaseInvoicesClientView } from "@/features/billing"

export default function PurchasesPage() {
    return (
        <>
            <PurchaseInvoicesClientView createAction={<ToolbarCreateButton label="Nueva Factura" href="/billing/purchases?modal=new" />} />
        </>
    )
}
