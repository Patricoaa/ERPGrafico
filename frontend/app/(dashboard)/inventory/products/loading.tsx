import { Skeleton } from "@/components/ui/skeleton"

export default function ProductsLoading() {
    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex justify-center">
                <Skeleton className="h-12 w-full max-w-2xl rounded-full" />
            </div>
            <div className="flex items-center justify-between">
                <div className="space-y-2">
                    <Skeleton className="h-8 w-[250px]" />
                    <Skeleton className="h-4 w-[350px]" />
                </div>
                <Skeleton className="h-8 w-8 rounded-full" />
            </div>
            <div className="pt-4">
                <Skeleton className="h-[500px] w-full rounded-xl" />
            </div>
        </div>
    )
}
