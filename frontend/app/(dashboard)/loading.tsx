import { Skeleton, CardSkeleton } from "@/components/shared"

export default function DashboardLoading() {
    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between">
                <div className="space-y-2">
                    <Skeleton className="h-8 w-[200px]" />
                    <Skeleton className="h-4 w-[300px]" />
                </div>
                <Skeleton className="h-8 w-8 rounded-full" />
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <CardSkeleton count={4} className="h-[120px]" />
            </div>
            <Skeleton className="h-[400px] w-full rounded-xl" />
        </div>
    )
}
