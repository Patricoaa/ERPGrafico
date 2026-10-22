import type { Metadata } from "next"
import { ToolbarCreateButton } from "@/components/shared"
import EntriesClientView from "./EntriesClientView"
import { getAccountingTab } from "@/features/accounting/navigation"
import { buildMetadataFromTab } from "@/lib/navigation-helpers"

const tabConfig = getAccountingTab("entries")
export const metadata: Metadata = tabConfig ? buildMetadataFromTab(tabConfig) : { title: "Asientos Contables | ERPGrafico" }

interface PageProps {
  searchParams: Promise<{ modal?: string }>
}

export default async function EntriesPage({ searchParams }: PageProps) {
  const { modal } = await searchParams

  const createAction = (
    <ToolbarCreateButton label="Nuevo Asiento" href="/accounting/entries?modal=new" />
  )

  return (
    <>
      <EntriesClientView externalOpen={modal === "new"} createAction={createAction} />
    </>
  )
}