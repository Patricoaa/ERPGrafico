import { notFound } from "next/navigation"
import { FinancialStatementsReport } from "@/features/finance"
import {
  FINANCES_STATEMENTS_SUB_TABS,
  getFinancesStatementsSubTab,
} from "@/features/finances/navigation"
import { buildMetadataFromTab } from "@/lib/navigation-helpers"

const STATEMENTS_CONFIG = FINANCES_STATEMENTS_SUB_TABS

type StatementKey = "bs" | "pl" | "cf"

export function generateStaticParams() {
  return STATEMENTS_CONFIG.map((s) => ({ statement: s.value }))
}

interface PageProps {
  params: Promise<{ statement: string }>
}

export async function generateMetadata({ params }: PageProps) {
  const { statement } = await params
  const tabConfig = getFinancesStatementsSubTab(statement)
  if (!tabConfig) notFound()
  return buildMetadataFromTab(tabConfig)
}

export default async function StatementPage({ params }: PageProps) {
  const { statement } = await params
  const tabConfig = getFinancesStatementsSubTab(statement)
  if (!tabConfig) notFound()

  return <FinancialStatementsReport activeTab={statement} />
}