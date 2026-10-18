import type { Metadata } from "next"
import { MovementClientView } from "@/features/inventory"
import { getInventoryReportsSubTab } from "@/features/inventory/navigation"
import { buildMetadataFromTab } from "@/lib/navigation-helpers"

const tabConfig = getInventoryReportsSubTab("movements")
export const metadata: Metadata = tabConfig ? buildMetadataFromTab(tabConfig) : { title: "Movimientos de Stock | ERPGrafico" }

export default async function StockMovementsPage() {
  return <MovementClientView />
}