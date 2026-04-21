import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

// Explicit map avoids Tailwind purging dynamic `grid-cols-${n}` classes
const GRID_COLS: Record<number, string> = {
    1: "",
    2: "lg:grid-cols-2",
    3: "lg:grid-cols-3",
    4: "lg:grid-cols-4",
}

interface FormSkeletonProps {
    className?: string
    /** Number of form-field rows to render per card */
    fields?: number
    /** Number of cards to render side by side (1–4) */
    cards?: number
    /** Render a tabs bar above the card(s) */
    hasTabs?: boolean
    /** Number of tab buttons in the tabs bar */
    tabs?: number
}

export function FormSkeleton({
    className,
    fields = 4,
    cards = 1,
    hasTabs = false,
    tabs = 3,
}: FormSkeletonProps) {
    return (
        <div className={cn("space-y-4", className)}>
            {hasTabs && (
                <div className="flex gap-1 h-12 p-1 bg-muted/50 rounded-md border-2">
                    {Array.from({ length: tabs }).map((_, i) => (
                        <Skeleton key={i} className="flex-1 h-full rounded-sm" />
                    ))}
                </div>
            )}

            <div className={cn("grid gap-6", cards > 1 && GRID_COLS[cards])}>
                {Array.from({ length: cards }).map((_, ci) => (
                    <div key={ci} className="border-2 rounded-md p-6 space-y-6">
                        <div className="space-y-1 pb-4 border-b">
                            <Skeleton className="h-4 w-40" />
                            <Skeleton className="h-3 w-64" />
                        </div>
                        <div className="space-y-6">
                            {Array.from({ length: fields }).map((_, fi) => (
                                <div key={fi} className="space-y-2">
                                    <Skeleton className="h-3 w-32" />
                                    <Skeleton className="h-9 w-full" />
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
