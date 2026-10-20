import type { Metadata } from "next"
import { SalesFulfillmentView } from "@/features/sales"
import { getSalesDtesSubTab } from "@/features/sales/navigation"
import { buildMetadataFromTab } from "@/lib/navigation-helpers"

const tabConfig = getSalesDtesSubTab("fulfillment")
export const metadata: Metadata = tabConfig ? buildMetadataFromTab(tabConfig) : { title: "Despachos y Devoluciones | ERPGrafico" }

export default function SalesFulfillmentPage() {
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <SalesFulfillmentView />
    </div>
  )
}