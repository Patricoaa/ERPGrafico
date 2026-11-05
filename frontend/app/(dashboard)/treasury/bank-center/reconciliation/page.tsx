import type { Metadata } from "next"
import { StatementsClientView } from "@/features/finance"
import { buildAllBanksMetadata } from "@/features/treasury/navigation.server"

export const metadata: Metadata = buildAllBanksMetadata("reconciliation")

export default function AllBanksReconciliationPage() {
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <StatementsClientView />
    </div>
  )
}
