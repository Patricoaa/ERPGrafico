import type { Metadata } from "next"
import { ToolbarCreateButton } from "@/components/shared"
import { PurchaseInvoicesClientView } from "@/features/billing"
import { getPurchasingDtesSubTab } from "@/features/purchasing/navigation"
import { buildMetadataFromTab } from "@/lib/navigation-helpers"

const tabConfig = getPurchasingDtesSubTab("dtes")
export const metadata: Metadata = tabConfig ? buildMetadataFromTab(tabConfig) : { title: "DTE de Compras | ERPGrafico" }

export default function PurchasingDtesPage() {
  return (
    <>
      <PurchaseInvoicesClientView createAction={<ToolbarCreateButton label="Nueva Factura" href="/purchasing/dtes?modal=new" />} />
    </>
  )
}
