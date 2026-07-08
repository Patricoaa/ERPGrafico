import { PageSectionHeader } from "@/components/shared"
import { serverFetch } from "@/lib/server-fetch"
import type { SalaryAdvance } from "@/types/hr"
import AdvancesPageClient from "./AdvancesPageClient"

const FILTER_PARAMS = new Set(['is_discounted'])

interface PageProps {
    searchParams: Promise<Record<string, string | undefined>>
}

export default async function AdvancesPage({ searchParams }: PageProps) {
    const params = await searchParams

    const hasActiveFilters = Object.keys(params).some(k => FILTER_PARAMS.has(k))
    let initialAdvances: SalaryAdvance[] | undefined
    if (!hasActiveFilters) {
        try {
            initialAdvances = await serverFetch<SalaryAdvance[]>('hr/advances/', {
                params: { page_size: '200' },
                revalidate: 10,
            })
        } catch {
            // Client-side fetch handles fallback
        }
    }

    return (
        <>
            <PageSectionHeader title="Anticipos" description="Gestión de adelantos de remuneraciones" />
            <AdvancesPageClient initialAdvances={initialAdvances} />
        </>)
}
