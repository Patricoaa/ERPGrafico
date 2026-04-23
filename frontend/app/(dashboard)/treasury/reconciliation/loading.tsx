import { PageLayoutSkeleton } from "@/components/shared"

export default function ReconciliationLoading() {
    return (
        <PageLayoutSkeleton 
            hasTabs={false}
            hasToolbar={true}
            contentType="table"
        />
    )
}
