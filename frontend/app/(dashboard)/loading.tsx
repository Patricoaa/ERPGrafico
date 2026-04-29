import { PageLayoutSkeleton } from "@/components/shared"

export default function DashboardLoading() {
    return (
        <PageLayoutSkeleton 
            hasTabs={false}
            contentType="table"
        />
    )
}
