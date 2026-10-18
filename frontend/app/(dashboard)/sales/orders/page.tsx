import type { Metadata } from "next"
import SalesOrdersPageClient from "./SalesOrdersPageClient"
import { getSalesTab } from "@/features/sales/navigation"
import { buildMetadataFromTab } from "@/lib/navigation-helpers"

const tabConfig = getSalesTab("orders")
export const metadata: Metadata = tabConfig ? buildMetadataFromTab(tabConfig) : { title: "Órdenes | ERPGrafico" }

export default async function SalesOrdersPage() {
  return <SalesOrdersPageClient />
}