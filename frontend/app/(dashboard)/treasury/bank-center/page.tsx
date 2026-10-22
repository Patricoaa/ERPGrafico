import type { Metadata } from "next"
import BankCenterPageClient from "./BankCenterPageClient"
import { getTreasuryTab } from "@/features/treasury/navigation"
import { buildMetadataFromTab } from "@/lib/navigation-helpers"

const mainTab = getTreasuryTab("bank-center")
const allTab = mainTab?.subTabs?.find((t) => t.value === "all")
export const metadata: Metadata = allTab ? buildMetadataFromTab(allTab) : { title: "Centro de Bancos | ERPGrafico" }

export default function BankCenterPage() {
  return <BankCenterPageClient />
}