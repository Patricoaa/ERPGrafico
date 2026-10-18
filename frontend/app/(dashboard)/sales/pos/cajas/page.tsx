import type { Metadata } from "next"
import { ToolbarCreateButton } from "@/components/shared"
import { SalesPosLayout } from "@/features/sales"
import { getSalesPosSubTab } from "@/features/sales/navigation"
import { buildMetadataFromTab } from "@/lib/navigation-helpers"

const tabConfig = getSalesPosSubTab("cajas")
export const metadata: Metadata = tabConfig ? buildMetadataFromTab(tabConfig) : { title: "Puntos de Venta | ERPGrafico" }

interface PageProps {
  searchParams: Promise<{ modal?: string }>
}

export default async function PosCajasPage({ searchParams }: PageProps) {
  const { modal } = await searchParams
  const createAction = <ToolbarCreateButton label="Nuevo Punto de Venta" href="/sales/pos/cajas?modal=new-terminal" />

  return (
    <>
      <SalesPosLayout activeTab="cajas" modal={modal} createAction={createAction} />
    </>
  )
}