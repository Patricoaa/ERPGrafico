import { type Metadata } from "next"
import { StockReport } from "@/features/inventory"
import { getInventoryReportsSubTab } from "@/features/inventory/navigation"
import { buildMetadataFromTab } from "@/lib/navigation-helpers"

const tabConfig = getInventoryReportsSubTab("stock")
export const metadata: Metadata = tabConfig ? buildMetadataFromTab(tabConfig) : { title: "Existencias | ERPGrafico" }

export default function StockReportPage() {
  return <StockReport />
}