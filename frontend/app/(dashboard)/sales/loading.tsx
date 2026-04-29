import { PageLayoutSkeleton } from "@/components/shared"

export default function SalesLoading() {
    return (
        <PageLayoutSkeleton 
            hasTabs={true}
            tabsCount={5}
            contentType="table"
        />
    )
}
