import { PageSectionHeader } from "@/components/shared"
import { AccountingClosuresClientView } from "@/features/accounting"

interface PageProps {
    searchParams: Promise<{ modal?: string }>
}

export default async function ClosuresPage({ searchParams }: PageProps) {
    const { modal } = await searchParams

    return (
        <>
            <PageSectionHeader title="Cierres" description="Cierres de período y ejercicio fiscal" />
            <AccountingClosuresClientView externalOpen={modal === 'fy'} />
        </>)
}
