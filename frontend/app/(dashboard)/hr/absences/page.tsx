import { serverFetch } from "@/lib/server-fetch"
import type { Absence } from "@/types/hr"
import AbsencesPageClient from "./AbsencesPageClient"
import { getHRTab } from "@/features/hr/navigation"
import { buildMetadataFromTab } from "@/lib/navigation-helpers"

const tabConfig = getHRTab("absences")
export const metadata = tabConfig ? buildMetadataFromTab(tabConfig) : { title: "Inasistencias y Licencias | ERPGrafico" }

const FILTER_PARAMS = new Set(["absence_type", "start_date_after", "start_date_before"])

interface PageProps {
  searchParams: Promise<Record<string, string | undefined>>
}

export default async function AbsencesPage({ searchParams }: PageProps) {
  const params = await searchParams

  const hasActiveFilters = Object.keys(params).some((k) => FILTER_PARAMS.has(k))
  let initialAbsences: Absence[] | undefined
  if (!hasActiveFilters) {
    try {
      const res = await serverFetch<{ results: Absence[] }>("hr/absences/", {
        params: { page_size: "200" },
        revalidate: 10,
      })
      initialAbsences = res.results
    } catch {
      // Client-side fetch handles fallback
    }
  }

  return <AbsencesPageClient initialAbsences={initialAbsences} />
}