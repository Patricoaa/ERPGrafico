import { PageLayoutSkeleton } from "@/components/shared"

export default function PurchasingLoading() {
    return (
        <PageLayoutSkeleton 
            hasTabs={true}
            tabsCount={3}
            contentType="table"
        />
    )
}
