import type { Metadata } from "next"
import { ToolbarCreateButton } from "@/components/shared"
import { TreasuryMovementsClientView } from "@/features/treasury"
import { getTreasuryTab } from "@/features/treasury/navigation"
import { buildMetadataFromTab } from "@/lib/navigation-helpers"

const tabConfig = getTreasuryTab("operaciones")
export const metadata: Metadata = tabConfig ? buildMetadataFromTab(tabConfig) : { title: "Operaciones de Tesorería | ERPGrafico" }

interface PageProps {
  searchParams: Promise<{ modal?: string }>
}

export default async function OperacionesPage({ searchParams }: PageProps) {
  const { modal } = await searchParams
  const modalOpen = modal === "new"
  const createAction = (
    <ToolbarCreateButton label="Nuevo Movimiento" href="/treasury/operaciones/movements?modal=new" />
  )

  return (
    <>
      <TreasuryMovementsClientView externalOpen={modalOpen} createAction={createAction} />
    </>
  )
}