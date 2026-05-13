import * as React from "react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { type VariantProps } from "class-variance-authority"
import { badgeVariants } from "@/components/ui/badge"
import { LucideIcon } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"

// ─── Base props ───────────────────────────────────────────────────────────────

interface EntityCardRootProps {
    /** Compact removes footer and reduces padding — ideal for dense grids */
    variant?: "compact" | "full"
    isSelected?: boolean
    onClick?: () => void
    className?: string
    children: React.ReactNode
}

function EntityCardRoot({
    variant = "full",
    isSelected = false,
    onClick,
    className,
    children,
}: EntityCardRootProps) {
    return (
        <div
            role={onClick ? "button" : undefined}
            tabIndex={onClick ? 0 : undefined}
            onClick={onClick}
            onKeyDown={(e) => {
                if (onClick && (e.key === "Enter" || e.key === " ")) {
                    e.preventDefault()
                    onClick()
                }
            }}
            className={cn(
                "group relative flex flex-col rounded-lg border transition-all duration-200",
                "bg-card text-card-foreground shadow-sm",
                variant === "compact" ? "gap-1.5 p-3" : "gap-3 p-4",
                isSelected
                    ? "border-primary/60 bg-primary/5 ring-1 ring-primary/20 shadow-primary/10"
                    : "border-border/50 hover:border-border hover:shadow-md hover:bg-muted/20",
                onClick && "cursor-pointer select-none",
                className
            )}
        >
            {isSelected && (
                <span
                    aria-hidden
                    className="absolute inset-x-0 top-0 h-0.5 rounded-t-lg bg-primary"
                />
            )}
            {children}
        </div>
    )
}

// ─── Header ───────────────────────────────────────────────────────────────────

interface EntityCardHeaderProps {
    /** Primary identifier (e.g. document number, name) */
    title: React.ReactNode
    /** Optional subtitle below the title */
    subtitle?: React.ReactNode
    /** Status badge(s) or any trailing slot */
    trailing?: React.ReactNode
    className?: string
}

function EntityCardHeader({ title, subtitle, trailing, className }: EntityCardHeaderProps) {
    return (
        <div className={cn("flex items-start justify-between gap-2", className)}>
            <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold leading-tight tracking-tight">
                    {title}
                </div>
                {subtitle && (
                    <div className="mt-0.5 truncate text-xs text-muted-foreground">
                        {subtitle}
                    </div>
                )}
            </div>
            {trailing && <div className="shrink-0">{trailing}</div>}
        </div>
    )
}

// ─── Body ─────────────────────────────────────────────────────────────────────

interface EntityCardBodyProps {
    /** Use grid-cols-2 by default, override via className */
    className?: string
    children: React.ReactNode
}

function EntityCardBody({ children, className }: EntityCardBodyProps) {
    return (
        <div className={cn("grid grid-cols-2 gap-x-4 gap-y-2", className)}>
            {children}
        </div>
    )
}

// ─── Field ────────────────────────────────────────────────────────────────────

interface EntityCardFieldProps {
    label: string
    value: React.ReactNode
    /** Span full width */
    full?: boolean
    className?: string
    icon?: LucideIcon
}

function EntityCardField({ label, value, full, className, icon: Icon }: EntityCardFieldProps) {
    return (
        <div className={cn("flex flex-col gap-0.5 min-w-0", full && "col-span-2", className)}>
            <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/60">
                {label}
            </span>
            <span className="flex items-center gap-1 truncate text-xs font-medium text-foreground/80">
                {Icon && <Icon className="h-3 w-3 shrink-0 text-muted-foreground/50" />}
                {value ?? <span className="text-muted-foreground/40">—</span>}
            </span>
        </div>
    )
}

// ─── Footer ───────────────────────────────────────────────────────────────────

interface EntityCardFooterProps {
    children: React.ReactNode
    className?: string
}

function EntityCardFooter({ children, className }: EntityCardFooterProps) {
    return (
        <div
            className={cn(
                "flex items-center justify-end gap-1.5 border-t border-border/30 pt-2.5",
                className
            )}
        >
            {children}
        </div>
    )
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

interface EntityCardBadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {
    label: string
    dot?: boolean
}

function EntityCardBadge({ label, dot = false, variant = "secondary", className, ...props }: EntityCardBadgeProps) {
    return (
        <Badge
            variant={variant}
            className={cn("h-5 gap-1 rounded-md px-1.5 text-[10px] font-semibold uppercase tracking-wide", className)}
            {...props}
        >
            {dot && <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />}
            {label}
        </Badge>
    )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function EntityCardSkeleton({ className, variant = "full" }: { className?: string; variant?: "full" | "compact" }) {
    if (variant === "compact") {
        return (
            <EntityCardRoot variant="compact" className={cn("animate-in fade-in duration-500", className)}>
                <div className="flex flex-col gap-2 p-1">
                    <div className="flex items-center gap-3">
                        <Skeleton className="h-8 w-8 rounded-sm shrink-0" />
                        <div className="flex flex-col gap-1.5 flex-1">
                            <Skeleton className="h-4 w-3/4" />
                            <Skeleton className="h-3 w-1/2 opacity-60" />
                        </div>
                    </div>
                </div>
            </EntityCardRoot>
        )
    }

    return (
        <EntityCardRoot className={cn("animate-in fade-in duration-500", className)}>
            <EntityCardHeader
                title={
                    <div className="flex items-center gap-3">
                        <Skeleton className="h-10 w-10 rounded-sm shrink-0" />
                        <Skeleton className="h-5 w-48" />
                    </div>
                }
                subtitle={
                    <div className="flex items-center gap-2.5 pl-[52px]">
                        <Skeleton className="h-4 w-20 rounded-md" />
                        <Skeleton className="h-4 w-24" />
                    </div>
                }
                trailing={
                    <div className="flex items-center gap-4">
                        <div className="hidden sm:flex px-4">
                            <Skeleton className="h-6 w-24 rounded-full" />
                        </div>
                        <div className="flex flex-col items-end gap-1">
                            <Skeleton className="h-2 w-10" />
                            <Skeleton className="h-5 w-20" />
                        </div>
                        <Skeleton className="h-5 w-5 rounded-full" />
                    </div>
                }
            />
            <EntityCardBody className="flex items-start justify-between gap-4 pt-2 border-t border-border/30 mt-1">
                <div className="flex flex-wrap gap-x-4 gap-y-2 flex-1">
                    <Skeleton className="h-3 w-32" />
                    <Skeleton className="h-3 w-40" />
                </div>
                <div className="flex flex-col items-end gap-1">
                    <Skeleton className="h-2 w-10" />
                    <Skeleton className="h-4 w-16" />
                </div>
            </EntityCardBody>
        </EntityCardRoot>
    )
}

// ─── Composite export ─────────────────────────────────────────────────────────

export const EntityCard = Object.assign(EntityCardRoot, {
    Header: EntityCardHeader,
    Body: EntityCardBody,
    Field: EntityCardField,
    Footer: EntityCardFooter,
    Badge: EntityCardBadge,
    Skeleton: EntityCardSkeleton,
})

export type {
    EntityCardRootProps,
    EntityCardHeaderProps,
    EntityCardBodyProps,
    EntityCardFieldProps,
    EntityCardFooterProps,
    EntityCardBadgeProps,
}
