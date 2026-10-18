import type { Metadata } from "next"
import DeliveriesPageClient from "./DeliveriesPageClient"
import { getSalesOrdersSubTab } from "@/features/sales/navigation"
import { buildMetadataFromTab } from "@/lib/navigation-helpers"

const tabConfig = getSalesOrdersSubTab("deliveries")
export const metadata: Metadata = tabConfig ? buildMetadataFromTab(tabConfig) : { title: "Guías de Despacho | ERPGrafico" }

export default function SalesOrdersDeliveriesPage() {
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <DeliveriesPageClient />
    </div>
  )
}