import { PageLayoutSkeleton } from "@/components/shared"

export default function BillingLoading() {
    return (
        <PageLayoutSkeleton 
            hasTabs={true}
            tabsCount={3}
            contentType="table"
        />
    )
}
