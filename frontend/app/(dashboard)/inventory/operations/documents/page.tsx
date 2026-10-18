import type { Metadata } from "next"
import { DocumentsClientView } from "@/features/inventory"
import { getInventoryOperationsSubTab } from "@/features/inventory/navigation"
import { buildMetadataFromTab } from "@/lib/navigation-helpers"

const tabConfig = getInventoryOperationsSubTab("documents")
export const metadata: Metadata = tabConfig ? buildMetadataFromTab(tabConfig) : { title: "Recepciones, Entregas y Ajustes | ERPGrafico" }

export default function InventoryDocumentsPage() {
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <DocumentsClientView />
    </div>
  )
}