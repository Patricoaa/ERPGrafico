import type { Metadata } from "next"
import SalesOrdersPageClient from "./SalesOrdersPageClient"
import { getSalesDtesSubTab } from "@/features/sales/navigation"
import { buildMetadataFromTab } from "@/lib/navigation-helpers"

const tabConfig = getSalesDtesSubTab("orders")
export const metadata: Metadata = tabConfig ? buildMetadataFromTab(tabConfig) : { title: "Órdenes de Venta | ERPGrafico" }

export default async function SalesOrdersPage() {
  return <SalesOrdersPageClient />
}
