import type { Metadata } from "next"
import { ToolbarCreateButton } from "@/components/shared"
import { AccountsClientView } from "@/features/accounting"
import { getAccountingTab } from "@/features/accounting/navigation"
import { buildMetadataFromTab } from "@/lib/navigation-helpers"

const tabConfig = getAccountingTab("ledger")
export const metadata: Metadata = tabConfig ? buildMetadataFromTab(tabConfig) : { title: "Plan de Cuentas | ERPGrafico" }

interface PageProps {
  searchParams: Promise<{ modal?: string }>
}

export default async function LedgerPage({ searchParams }: PageProps) {
  const { modal } = await searchParams

  const createAction = (
    <ToolbarCreateButton label="Nueva Cuenta" href="/accounting/ledger?modal=new" />
  )

  return (
    <>
      <AccountsClientView externalOpen={modal === "new"} createAction={createAction} />
    </>
  )
}