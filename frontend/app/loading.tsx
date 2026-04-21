import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
    return (
        <div className="flex h-screen w-full">
            {/* Sidebar placeholder */}
            <div className="hidden md:flex flex-col w-64 border-r p-4 gap-4 shrink-0">
                <Skeleton className="h-8 w-36" />
                <div className="space-y-2 mt-4">
                    {Array.from({ length: 7 }).map((_, i) => (
                        <Skeleton key={i} className="h-9 w-full" />
                    ))}
                </div>
            </div>

            {/* Main content placeholder */}
            <div className="flex-1 flex flex-col">
                <div className="h-14 border-b px-6 flex items-center justify-between shrink-0">
                    <Skeleton className="h-6 w-40" />
                    <Skeleton className="h-8 w-8 rounded-full" />
                </div>
                <div className="flex-1 p-8 space-y-4">
                    <div className="flex items-center justify-between">
                        <Skeleton className="h-8 w-48" />
                        <Skeleton className="h-9 w-28" />
                    </div>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <Skeleton key={i} className="h-28" />
                        ))}
                    </div>
                    <Skeleton className="h-80 w-full" />
                </div>
            </div>
        </div>
    )
}
