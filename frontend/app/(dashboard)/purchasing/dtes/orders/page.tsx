import type { Metadata } from "next"
import PurchasingPageClient from "./PurchasingPageClient"
import { getPurchasingTab } from "@/features/purchasing/navigation"
import { buildMetadataFromTab } from "@/lib/navigation-helpers"

const tabConfig = getPurchasingTab("orders")
export const metadata: Metadata = tabConfig ? buildMetadataFromTab(tabConfig) : { title: "Órdenes de Compra | ERPGrafico" }

export default function PurchaseOrdersPage() {
  return <PurchasingPageClient />
}