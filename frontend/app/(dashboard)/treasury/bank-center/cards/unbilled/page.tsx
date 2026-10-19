import type { Metadata } from "next"
import { CardChargesAggregateView } from "@/features/treasury"
import { buildAllBanksMetadata } from "@/features/treasury/navigation.server"

export const metadata: Metadata = buildAllBanksMetadata("cards")

export default function AllBanksCardsUnbilledPage() {
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <CardChargesAggregateView />
    </div>
  )
}
