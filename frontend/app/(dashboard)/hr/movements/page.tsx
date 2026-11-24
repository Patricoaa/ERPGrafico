import { serverFetch } from "@/lib/server-fetch"
import type { EmployeeMovement } from "@/types/hr"
import MovementsPageClient from "./MovementsPageClient"
import { getHRTab } from "@/features/hr/navigation"
import { buildMetadataFromTab } from "@/lib/navigation-helpers"

const tabConfig = getHRTab("movements")
export const metadata = tabConfig ? buildMetadataFromTab(tabConfig) : { title: "Movimientos con Empleados | ERPGrafico" }

const FILTER_PARAMS = new Set(["status", "kind"])

interface PageProps {
  searchParams: Promise<Record<string, string | undefined>>
}

export default async function MovementsPage({ searchParams }: PageProps) {
  const params = await searchParams

  const hasActiveFilters = Object.keys(params).some((k) => FILTER_PARAMS.has(k))
  let initialMovements: EmployeeMovement[] | undefined
  if (!hasActiveFilters) {
    try {
      const res = await serverFetch<{ results: EmployeeMovement[] }>("hr/employee-movements/", {
        params: { page_size: "200" },
        revalidate: 10,
      })
      initialMovements = res.results
    } catch {
      // Client-side fetch handles fallback
    }
  }

  return <MovementsPageClient initialMovements={initialMovements} />
}
