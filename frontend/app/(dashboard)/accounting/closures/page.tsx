import type { Metadata } from "next"
import { AccountingClosuresClientView } from "@/features/accounting"
import { getAccountingTab } from "@/features/accounting/navigation"
import { buildMetadataFromTab } from "@/lib/navigation-helpers"

const tabConfig = getAccountingTab("closures")
export const metadata: Metadata = tabConfig ? buildMetadataFromTab(tabConfig) : { title: "Gestión de Cierres | ERPGrafico" }

interface PageProps {
  searchParams: Promise<{ modal?: string }>
}

export default async function ClosuresPage({ searchParams }: PageProps) {
  const { modal } = await searchParams

  return (
    <>
      <AccountingClosuresClientView externalOpen={modal === "fy"} />
    </>
  )
}