import { PageSectionHeader } from "@/components/shared"
import { serverFetch } from "@/lib/server-fetch"
import type { Employee } from "@/types/hr"
import EmployeesPageClient from "./EmployeesPageClient"

const FILTER_PARAMS = new Set(['search', 'status'])

interface PageProps {
    searchParams: Promise<Record<string, string | undefined>>
}

export default async function EmployeesPage({ searchParams }: PageProps) {
    const params = await searchParams

    const hasActiveFilters = Object.keys(params).some(k => FILTER_PARAMS.has(k))
    let initialEmployees: Employee[] | undefined
    if (!hasActiveFilters) {
        try {
            initialEmployees = await serverFetch<Employee[]>('hr/employees/', {
                params: { page_size: '200' },
                revalidate: 10,
            })
        } catch {
            // Client-side fetch handles fallback
        }
    }

    return (
        <>
            <PageSectionHeader title="Empleados" description="Gestión de colaboradores y datos laborales" />
            <EmployeesPageClient initialEmployees={initialEmployees} />
        </>)
}
