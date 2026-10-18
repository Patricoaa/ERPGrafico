import type { Metadata } from "next"
import { ToolbarCreateButton } from "@/components/shared"
import { TreasuryAccountsClientView } from "@/features/treasury"
import { getOperacionesSubTab } from "@/features/treasury/navigation"
import { buildMetadataFromTab } from "@/lib/navigation-helpers"

const tabConfig = getOperacionesSubTab("accounts")
export const metadata: Metadata = tabConfig ? buildMetadataFromTab(tabConfig) : { title: "Cuentas de Tesorería | ERPGrafico" }

interface PageProps {
  searchParams: Promise<{ modal?: string }>
}

export default async function OperacionesAccountsPage({ searchParams }: PageProps) {
  const { modal } = await searchParams
  const modalOpen = modal === "new"
  const action = <ToolbarCreateButton label="Nueva Cuenta" href="/treasury/operaciones/accounts?modal=new" />

  return (
    <>
      <TreasuryAccountsClientView activeTab="accounts" externalOpen={modalOpen} createAction={action} />
    </>
  )
}