import type { Metadata } from "next"
import SalesInvoicesPageClient from "./SalesInvoicesPageClient"
import { getBillingTab } from "@/features/billing/navigation"
import { buildMetadataFromTab } from "@/lib/navigation-helpers"

const tabConfig = getBillingTab("sales")
export const metadata: Metadata = tabConfig ? buildMetadataFromTab(tabConfig) : { title: "Facturación de Ventas | ERPGrafico" }

export default function SalesInvoicesPage() {
  return <SalesInvoicesPageClient />
}