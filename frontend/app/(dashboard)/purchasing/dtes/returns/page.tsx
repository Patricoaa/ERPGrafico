import type { Metadata } from "next"
import { PurchaseReturnsView } from "@/features/purchasing"
import { getPurchasingDtesSubTab } from "@/features/purchasing/navigation"
import { buildMetadataFromTab } from "@/lib/navigation-helpers"

const tabConfig = getPurchasingDtesSubTab("returns")
export const metadata: Metadata = tabConfig ? buildMetadataFromTab(tabConfig) : { title: "Devoluciones | ERPGrafico" }

export default function PurchaseReturnsPage() {
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <PurchaseReturnsView />
    </div>
  )
}
