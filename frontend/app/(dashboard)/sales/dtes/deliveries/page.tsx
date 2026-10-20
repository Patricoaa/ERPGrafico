import type { Metadata } from "next"
import { SalesDeliveriesView } from "@/features/sales"
import { getSalesDtesSubTab } from "@/features/sales/navigation"
import { buildMetadataFromTab } from "@/lib/navigation-helpers"

const tabConfig = getSalesDtesSubTab("deliveries")
export const metadata: Metadata = tabConfig ? buildMetadataFromTab(tabConfig) : { title: "Guías de Despacho | ERPGrafico" }

export default function SalesDeliveriesPage() {
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <SalesDeliveriesView />
    </div>
  )
}
