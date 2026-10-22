import type { Metadata } from "next"
import SalesInvoicesPageClient from "./SalesInvoicesPageClient"
import { getSalesDtesSubTab } from "@/features/sales/navigation"
import { buildMetadataFromTab } from "@/lib/navigation-helpers"

const tabConfig = getSalesDtesSubTab("dtes")
export const metadata: Metadata = tabConfig ? buildMetadataFromTab(tabConfig) : { title: "DTE de Ventas | ERPGrafico" }

export default function SalesDtesPage() {
  return <SalesInvoicesPageClient />
}
