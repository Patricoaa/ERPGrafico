import type { Metadata } from "next"
import BankCenterPageClient from "./BankCenterPageClient"
import { buildAllBanksMetadata } from "@/features/treasury/navigation.server"

export const metadata: Metadata = buildAllBanksMetadata("banks")

export default function BankCenterPage() {
  return <BankCenterPageClient />
}