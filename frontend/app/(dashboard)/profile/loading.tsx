import { PageLayoutSkeleton } from "@/components/shared"

export default function ProfileLoading() {
    return (
        <PageLayoutSkeleton 
            hasTabs={true}
            tabsCount={2}
            contentType="table"
        />
    )
}
