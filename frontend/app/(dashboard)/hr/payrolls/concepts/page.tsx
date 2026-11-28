import type { Metadata } from "next"
import { PayrollConceptClientView } from "@/features/settings"
import { getHRPayrollsSubTab } from "@/features/hr/navigation"
import { buildMetadataFromTab } from "@/lib/navigation-helpers"

const tabConfig = getHRPayrollsSubTab("concepts")
export const metadata: Metadata = tabConfig ? buildMetadataFromTab(tabConfig) : { title: "Conceptos de Nómina | ERPGrafico" }

export default async function HRPayrollsConceptsPage() {
  return <PayrollConceptClientView />
}
