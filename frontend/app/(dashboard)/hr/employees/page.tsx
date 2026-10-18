import { serverFetch } from "@/lib/server-fetch"
import type { Employee } from "@/types/hr"
import EmployeesPageClient from "./EmployeesPageClient"
import { getHRTab } from "@/features/hr/navigation"
import { buildMetadataFromTab } from "@/lib/navigation-helpers"

const tabConfig = getHRTab("employees")
export const metadata = tabConfig ? buildMetadataFromTab(tabConfig) : { title: "Nómina de Personal | ERPGrafico" }

const FILTER_PARAMS = new Set(["search", "status"])

interface PageProps {
  searchParams: Promise<Record<string, string | undefined>>
}

export default async function EmployeesPage({ searchParams }: PageProps) {
  const params = await searchParams

  const hasActiveFilters = Object.keys(params).some((k) => FILTER_PARAMS.has(k))
  let initialEmployees: Employee[] | undefined
  if (!hasActiveFilters) {
    try {
      initialEmployees = (await serverFetch<{ results: Employee[] }>("hr/employees/", {
        params: { page_size: "200" },
        revalidate: 10,
      })).results
    } catch {
      // Client-side fetch handles fallback
    }
  }

  return <EmployeesPageClient initialEmployees={initialEmployees} />
}