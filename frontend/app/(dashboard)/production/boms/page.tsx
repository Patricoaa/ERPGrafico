import { PageSectionHeader } from "@/components/shared"
import { serverFetch } from "@/lib/server-fetch"
import type { BOM } from "@/features/production/types"
import BOMsPageClient from "./BOMsPageClient"

const FILTER_PARAMS = new Set(['search', 'active'])

interface PageProps {
    searchParams: Promise<Record<string, string | undefined>>
}

export default async function BOMsPage({ searchParams }: PageProps) {
    const params = await searchParams

    const hasActiveFilters = Object.keys(params).some(k => FILTER_PARAMS.has(k))
    let initialBoms: BOM[] | undefined
    if (!hasActiveFilters) {
        try {
            initialBoms = await serverFetch<BOM[]>('production/boms/', {
                params: {
                    page_size: '200',
                },
                revalidate: 10,
            })
        } catch {
            // Client-side fetch handles fallback
        }
    }

    return (
        <>
            <PageSectionHeader title="Listas de Materiales" description="Estructuras de productos y recetas de fabricación" />
            <BOMsPageClient initialBoms={initialBoms} />
        </>)
}
