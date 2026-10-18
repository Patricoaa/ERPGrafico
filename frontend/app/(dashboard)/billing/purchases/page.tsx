import type { Metadata } from "next"
import { ToolbarCreateButton } from "@/components/shared"
import { PurchaseInvoicesClientView } from "@/features/billing"
import { getBillingTab } from "@/features/billing/navigation"
import { buildMetadataFromTab } from "@/lib/navigation-helpers"

const tabConfig = getBillingTab("purchases")
export const metadata: Metadata = tabConfig ? buildMetadataFromTab(tabConfig) : { title: "Facturación de Compras | ERPGrafico" }

export default function PurchasesPage() {
  return (
    <>
      <PurchaseInvoicesClientView createAction={<ToolbarCreateButton label="Nueva Factura" href="/billing/purchases?modal=new" />} />
    </>
  )
}