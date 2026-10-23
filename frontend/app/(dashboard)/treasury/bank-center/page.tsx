import type { Metadata } from "next"
import BankCenterPageClient from "./BankCenterPageClient"
import { BANK_CENTER_BANKS_TAB } from "@/features/treasury/navigation"
import { buildMetadataFromTab } from "@/lib/navigation-helpers"

export const metadata: Metadata = buildMetadataFromTab(BANK_CENTER_BANKS_TAB)

export default function BankCenterPage() {
  return <BankCenterPageClient />
}