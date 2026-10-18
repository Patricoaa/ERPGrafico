import type { Metadata } from "next"
import { ChecksClientView } from "@/features/treasury"
import { getOperacionesSubTab } from "@/features/treasury/navigation"
import { buildMetadataFromTab } from "@/lib/navigation-helpers"

const tabConfig = getOperacionesSubTab("checks")
export const metadata: Metadata = tabConfig ? buildMetadataFromTab(tabConfig) : { title: "Gestión de Cheques | ERPGrafico" }

export default async function OperacionesChecksPage() {
  return <ChecksClientView direction="RECEIVED" />
}