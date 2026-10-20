import type { Metadata } from "next"
import { DocumentsClientView } from "@/features/inventory"
import { getInventoryOperationsSubTab } from "@/features/inventory/navigation"
import { buildMetadataFromTab } from "@/lib/navigation-helpers"

const tabConfig = getInventoryOperationsSubTab("manual-operations")
export const metadata: Metadata = tabConfig ? buildMetadataFromTab(tabConfig) : { title: "Ajustes y Transferencias Manuales | ERPGrafico" }

export default function InventoryManualOperationsPage() {
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <DocumentsClientView />
    </div>
  )
}