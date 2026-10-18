import type { Metadata } from "next"
import { PurchaseOrdersView } from "@/features/purchasing"
import { getPurchasingTab } from "@/features/purchasing/navigation"
import { buildMetadataFromTab } from "@/lib/navigation-helpers"

const tabConfig = getPurchasingTab("notes")
export const metadata: Metadata = tabConfig ? buildMetadataFromTab(tabConfig) : { title: "Notas de Crédito y Débito | ERPGrafico" }

export default function PurchaseNotesPage() {
  return <PurchaseOrdersView viewMode="notes" />
}