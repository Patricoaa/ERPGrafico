import { PageLayoutSkeleton } from "@/components/shared"

export default function FinancesLoading() {
    return (
        <PageLayoutSkeleton 
            hasTabs={true}
            tabsCount={3}
            contentType="table"
        />
    )
}
