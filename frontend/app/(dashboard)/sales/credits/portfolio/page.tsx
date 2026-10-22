import type { Metadata } from "next"
import { CreditPortfolioClientView } from "@/features/credits"
import { ToolbarCreateButton } from "@/components/shared"
import { getSalesCreditsSubTab } from "@/features/sales/navigation"
import { buildMetadataFromTab } from "@/lib/navigation-helpers"

const tabConfig = getSalesCreditsSubTab("portfolio")
export const metadata: Metadata = tabConfig ? buildMetadataFromTab(tabConfig) : { title: "Cartera de Créditos | ERPGrafico" }

interface PageProps {
  searchParams: Promise<{ modal?: string }>
}

export default async function CreditsPortfolioPage({ searchParams }: PageProps) {
  const { modal } = await searchParams
  const createAction = <ToolbarCreateButton label="Asignar Crédito" href="/sales/credits/portfolio?modal=new" />

  return (
    <>
      <CreditPortfolioClientView activeTab="portfolio" externalOpen={modal === "new"} createAction={createAction} />
    </>
  )
}