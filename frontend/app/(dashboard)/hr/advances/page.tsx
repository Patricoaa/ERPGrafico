import { serverFetch } from "@/lib/server-fetch"
import type { SalaryAdvance } from "@/types/hr"
import AdvancesPageClient from "./AdvancesPageClient"
import { getHRTab } from "@/features/hr/navigation"
import { buildMetadataFromTab } from "@/lib/navigation-helpers"

const tabConfig = getHRTab("advances")
export const metadata = tabConfig ? buildMetadataFromTab(tabConfig) : { title: "Anticipos de Sueldo | ERPGrafico" }

const FILTER_PARAMS = new Set(["is_discounted"])

interface PageProps {
  searchParams: Promise<Record<string, string | undefined>>
}

export default async function AdvancesPage({ searchParams }: PageProps) {
  const params = await searchParams

  const hasActiveFilters = Object.keys(params).some((k) => FILTER_PARAMS.has(k))
  let initialAdvances: SalaryAdvance[] | undefined
  if (!hasActiveFilters) {
    try {
      const res = await serverFetch<{ results: SalaryAdvance[] }>("hr/advances/", {
        params: { page_size: "200" },
        revalidate: 10,
      })
      initialAdvances = res.results
    } catch {
      // Client-side fetch handles fallback
    }
  }

  return <AdvancesPageClient initialAdvances={initialAdvances} />
}