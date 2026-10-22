import type { Metadata } from "next"
import { BudgetsClientView } from "@/features/finance"
import { ToolbarCreateButton } from "@/components/shared"
import { getFinancesBudgetsSubTab } from "@/features/finances/navigation"
import { buildMetadataFromTab } from "@/lib/navigation-helpers"

const tabConfig = getFinancesBudgetsSubTab("list")
export const metadata: Metadata = tabConfig ? buildMetadataFromTab(tabConfig) : { title: "Control Presupuestario | ERPGrafico" }

interface PageProps {
  searchParams: Promise<{ modal?: string }>
}

export default async function BudgetsListPage({ searchParams }: PageProps) {
  const { modal } = await searchParams
  const createAction = <ToolbarCreateButton label="Nuevo Presupuesto" href="/finances/budgets/list?modal=new" />

  return <BudgetsClientView externalOpen={modal === "new"} createAction={createAction} />
}