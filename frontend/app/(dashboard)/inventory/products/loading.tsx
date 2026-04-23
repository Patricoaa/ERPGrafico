import { PageLayoutSkeleton } from "@/components/shared"

export default function ProductsLoading() {
    return (
        <PageLayoutSkeleton 
            hasTabs={true}
            tabsCount={4}
            hasToolbar={true}
            contentType="table"
        />
    )
}
