import { serverFetch } from "@/lib/server-fetch"
import type { Payroll } from "@/types/hr"
import PayrollsPageClient from "./PayrollsPageClient"
import { getHRTab } from "@/features/hr/navigation"
import { buildMetadataFromTab } from "@/lib/navigation-helpers"

const tabConfig = getHRTab("payrolls")
export const metadata = tabConfig ? buildMetadataFromTab(tabConfig) : { title: "Liquidaciones y Remuneraciones | ERPGrafico" }

const FILTER_PARAMS = new Set(["search", "status", "period_year"])

interface PageProps {
  searchParams: Promise<Record<string, string | undefined>>
}

export default async function PayrollsPage({ searchParams }: PageProps) {
  const params = await searchParams

  const hasActiveFilters = Object.keys(params).some((k) => FILTER_PARAMS.has(k))
  let initialPayrolls: Payroll[] | undefined
  if (!hasActiveFilters) {
    try {
      const res = await serverFetch<{ results: Payroll[] }>("hr/payrolls/", {
        params: { page_size: "200" },
        revalidate: 10,
      })
      initialPayrolls = res.results
    } catch {
      // Client-side fetch handles fallback
    }
  }

  return <PayrollsPageClient initialPayrolls={initialPayrolls} />
}