import { PageLayoutSkeleton } from "@/components/shared"

export default function InventoryLoading() {
    return (
        <PageLayoutSkeleton 
            hasTabs={true}
            tabsCount={5}
            contentType="table"
        />
    )
}
