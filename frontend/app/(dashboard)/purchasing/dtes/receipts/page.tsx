import type { Metadata } from "next"
import { PurchaseReceiptsView } from "@/features/purchasing"
import { getPurchasingDtesSubTab } from "@/features/purchasing/navigation"
import { buildMetadataFromTab } from "@/lib/navigation-helpers"

const tabConfig = getPurchasingDtesSubTab("receipts")
export const metadata: Metadata = tabConfig ? buildMetadataFromTab(tabConfig) : { title: "Recepciones | ERPGrafico" }

export default function PurchaseReceiptsPage() {
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <PurchaseReceiptsView />
    </div>
  )
}
