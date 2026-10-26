import type { Metadata } from "next"
import { BankCenterAllDashboard } from "@/features/treasury"
import { buildAllBanksMetadata } from "@/features/treasury/navigation.server"

export const metadata: Metadata = buildAllBanksMetadata("overview")

export default function AllBanksOverviewPage() {
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <BankCenterAllDashboard />
    </div>
  )
}
