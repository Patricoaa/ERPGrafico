import type { Metadata } from "next"
import { LoansClientView } from "@/features/treasury"
import { buildAllBanksMetadata } from "@/features/treasury/navigation.server"

export const metadata: Metadata = buildAllBanksMetadata("loans")

export default function AllBanksLoansPage() {
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <LoansClientView />
    </div>
  )
}
