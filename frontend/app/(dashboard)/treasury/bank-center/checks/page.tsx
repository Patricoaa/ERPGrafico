import type { Metadata } from "next"
import { ChecksClientView } from "@/features/treasury"
import { buildAllBanksMetadata } from "@/features/treasury/navigation.server"

export const metadata: Metadata = buildAllBanksMetadata("checks")

export default function AllBanksChecksPage() {
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <ChecksClientView direction="ISSUED" />
    </div>
  )
}
