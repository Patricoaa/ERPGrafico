import { cn } from "@/lib/utils"
import { type ReactNode } from "react"

interface SkeletonShellProps {
    isLoading: boolean
    children: ReactNode
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
 * @example
 * if (isLoading) return (
 *   <SkeletonShell isLoading>
 *     <InvoiceTable data={SKELETON_ROWS} columns={columns} />
 *   </SkeletonShell>
 * )
 */
export function SkeletonShell({ isLoading, children, className, ariaLabel = 'Cargando...' }: SkeletonShellProps) {
    if (!isLoading) return <>{children}</>

    return (
        <div
            data-skeleton-shell
            className={cn("animate-in fade-in duration-200", className)}
            aria-busy="true"
            aria-live="polite"
            aria-label={ariaLabel}
        >
            {children}
        </div>
    )
}
