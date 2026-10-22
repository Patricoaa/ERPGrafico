import type { Metadata } from "next"
import { InventoryCountClientView } from "@/features/inventory"
import { getInventoryOperationsSubTab } from "@/features/inventory/navigation"
import { buildMetadataFromTab } from "@/lib/navigation-helpers"

const tabConfig = getInventoryOperationsSubTab("counts")
export const metadata: Metadata = tabConfig ? buildMetadataFromTab(tabConfig) : { title: "Conteo de Inventario | ERPGrafico" }

export default function InventoryCountsPage() {
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <InventoryCountClientView />
    </div>
  )
}