import { PageLayoutSkeleton } from "@/components/shared"

export default function TreasuryLoading() {
    return (
        <PageLayoutSkeleton 
            hasTabs={true}
            tabsCount={4}
            contentType="table"
        />
    )
}
