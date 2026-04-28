import { PageLayoutSkeleton } from "@/components/shared"

export default function AccountingLoading() {
    return (
        <PageLayoutSkeleton 
            hasTabs={true}
            tabsCount={5}
            contentType="table"
        />
    )
}
