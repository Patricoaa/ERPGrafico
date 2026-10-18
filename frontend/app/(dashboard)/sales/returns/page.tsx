import type { Metadata } from "next"
import ReturnsPageClient from "./ReturnsPageClient"
import { getSalesReturnsSubTab } from "@/features/sales/navigation"
import { buildMetadataFromTab } from "@/lib/navigation-helpers"

const tabConfig = getSalesReturnsSubTab("returns")
export const metadata: Metadata = tabConfig ? buildMetadataFromTab(tabConfig) : { title: "Devoluciones | ERPGrafico" }

export default function SalesReturnsPage() {
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <ReturnsPageClient />
    </div>
  )
}