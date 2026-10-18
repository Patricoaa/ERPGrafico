import type { Metadata } from "next"
import { ToolbarCreateButton } from "@/components/shared"
import { TerminalBatchesClientView } from "@/features/treasury"
import { getTerminalCobroSubTab } from "@/features/treasury/navigation"
import { buildMetadataFromTab } from "@/lib/navigation-helpers"

const tabConfig = getTerminalCobroSubTab("batches")
export const metadata: Metadata = tabConfig ? buildMetadataFromTab(tabConfig) : { title: "Lotes de Pago | ERPGrafico" }

export default async function TerminalCobroBatchesPage() {
  const createAction = <ToolbarCreateButton label="Registrar Liquidación" href="/treasury/terminal-cobro/batches?modal=batch" />

  return (
    <>
      <TerminalBatchesClientView createAction={createAction} />
    </>
  )
}