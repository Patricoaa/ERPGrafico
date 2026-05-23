import { cn } from "@/lib/utils"
import { type ReactNode } from "react"

interface SkeletonShellProps {
    isLoading: boolean
    children?: ReactNode
    className?: string
    ariaLabel?: string
}

/**
 * CSS-based shimmer overlay. When isLoading=true, renders children's DOM
 * structure with shimmer applied via CSS — no parallel skeleton component needed.
 *
 * Usage: pass the real component with empty/placeholder data as children.
 * The component layout IS the skeleton. No drift possible.
 *
 * When children is omitted, renders a default skeleton placeholder so the
 * component can be used as a standalone loading indicator.
 *
 * @example
 * // With placeholder data (preferred — zero layout shift)
 * if (isLoading) return (
 *   <SkeletonShell isLoading>
 *     <InvoiceTable data={SKELETON_ROWS} columns={columns} />
 *   </SkeletonShell>
 * )
 *
 * @example
 * // Standalone skeleton (quick loading guard)
 * if (loading) return <SkeletonShell isLoading ariaLabel="Cargando..." />
 */
export function SkeletonShell({ isLoading, children, className, ariaLabel = 'Cargando...' }: SkeletonShellProps) {
    if (!isLoading) return children ? <>{children}</> : null

    return (
        <div
            data-skeleton-shell
            className={cn("animate-in fade-in duration-200", className)}
            aria-busy="true"
            aria-live="polite"
            aria-label={ariaLabel}
        >
            {children ?? <SkeletonShellPlaceholder />}
        </div>
    )
}

function SkeletonShellPlaceholder() {
    return (
        <div className="space-y-6 p-8" aria-hidden="true">
            <p className="h-5 w-48">&nbsp;</p>
            <div className="space-y-3">
                <p className="h-10 w-full">&nbsp;</p>
                <p className="h-10 w-full">&nbsp;</p>
                <p className="h-10 w-3/4">&nbsp;</p>
                <p className="h-10 w-full">&nbsp;</p>
            </div>
            <p className="h-10 w-1/3">&nbsp;</p>
        </div>
    )
}
