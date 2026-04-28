import { PageLayoutSkeleton } from "@/components/shared"

export default function ProductionLoading() {
    return (
        <PageLayoutSkeleton 
            hasTabs={true}
            tabsCount={3}
            contentType="table"
        />
    )
}
