import type { Metadata } from "next"
import { BankMovementsClientView } from "@/features/treasury"
import { buildAllBanksMetadata } from "@/features/treasury/navigation.server"

export const metadata: Metadata = buildAllBanksMetadata("movements")

export default function AllBanksMovementsPage() {
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <BankMovementsClientView />
    </div>
  )
}
