import { Skeleton } from "@/components/ui/skeleton"

export default function ReconciliationLoading() {
    return (
        <div className="flex-1 space-y-6 p-8 pt-6">
            <div className="flex justify-center">
                <Skeleton className="h-12 w-full max-w-2xl rounded-full" />
            </div>
            <div className="flex items-center justify-between">
                <div className="space-y-2">
                    <Skeleton className="h-8 w-[280px]" />
                    <Skeleton className="h-4 w-[380px]" />
                </div>
                <Skeleton className="h-8 w-8 rounded-full" />
            </div>
            <div className="pt-4">
                <Skeleton className="h-[500px] w-full rounded-xl" />
            </div>
        </div>
    )
}
