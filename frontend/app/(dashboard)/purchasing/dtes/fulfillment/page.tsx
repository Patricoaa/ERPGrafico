import type { Metadata } from "next"
import { PurchaseFulfillmentView } from "@/features/purchasing"
import { getPurchasingDtesSubTab } from "@/features/purchasing/navigation"
import { buildMetadataFromTab } from "@/lib/navigation-helpers"

const tabConfig = getPurchasingDtesSubTab("fulfillment")
export const metadata: Metadata = tabConfig ? buildMetadataFromTab(tabConfig) : { title: "Recepciones y Devoluciones | ERPGrafico" }

export default function PurchaseFulfillmentPage() {
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <PurchaseFulfillmentView />
    </div>
  )
}