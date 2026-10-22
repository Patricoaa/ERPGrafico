import type { Metadata } from "next"
import { POSSessionsClientView } from "@/features/sales"
import { getSalesPosSubTab } from "@/features/sales/navigation"
import { buildMetadataFromTab } from "@/lib/navigation-helpers"

const tabConfig = getSalesPosSubTab("sessions")
export const metadata: Metadata = tabConfig ? buildMetadataFromTab(tabConfig) : { title: "Sesiones POS | ERPGrafico" }

export default function POSSessionsPage() {
  return (
    <div className="h-full flex flex-col">
      <POSSessionsClientView hideHeader />
    </div>
  )
}