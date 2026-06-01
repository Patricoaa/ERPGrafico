import { AccountingClosuresView } from "@/features/accounting"

interface PageProps {
    searchParams: Promise<{ modal?: string }>
}

export default async function ClosuresPage({ searchParams }: PageProps) {
    const { modal } = await searchParams

    return (
        <AccountingClosuresView externalOpen={modal === 'fy'} />
    )
}
