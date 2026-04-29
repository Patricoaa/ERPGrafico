import { PageLayoutSkeleton } from "@/components/shared"

export default function HRLoading() {
    return (
        <PageLayoutSkeleton 
            hasTabs={true}
            tabsCount={5}
            contentType="table"
        />
    )
}
