import * as React from "react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { type VariantProps } from "class-variance-authority"
import { type badgeVariants } from "@/components/ui/badge"
import { type LucideIcon } from "lucide-react"
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
                "card-interactive card-accent-cmyk group flex flex-col rounded-md",
                "bg-background text-foreground",
                variant === "compact" ? "gap-1.5 p-3" : "gap-3 p-4",
                isSelected
                    ? "border-primary/60 ring-1 ring-primary/20 shadow-primary/10 hover:border-primary/60"
                    : "hover:border-border/50",
                onClick && "cursor-pointer select-none",
                className
            )}
        >
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
    /** Optional centered slot between title and trailing */
    center?: React.ReactNode
    /** Optional icon rendered in a 32×32 rounded container before the title */
    icon?: LucideIcon
    /** Image URL — renders an <img> in the icon slot, taking precedence over `icon` */
    imageSrc?: string
    /** Styling for the icon container (e.g. "text-success bg-success/10") */
    iconClassName?: string
    className?: string
}

function EntityCardHeader({ title, subtitle, trailing, center, icon: Icon, imageSrc, iconClassName, className }: EntityCardHeaderProps) {
    if (center) {
        return (
            <div className={cn("grid grid-cols-[1fr_auto_1fr] items-start gap-2", className)}>
                <div className="flex items-start gap-3 min-w-0">
                    {imageSrc ? (
                        <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-md overflow-hidden", iconClassName ?? "bg-muted text-muted-foreground")}>
                            <img src={imageSrc} alt="" className="h-full w-full object-cover" />
                        </div>
                    ) : Icon ? (
                        <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-md", iconClassName ?? "bg-muted text-muted-foreground")}>
                            <Icon className="h-4 w-4" />
                        </div>
                    ) : null}
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
                </div>
                <div className="flex items-center justify-center self-center">
                    {center}
                </div>
                <div className="justify-self-end">
                    {trailing}
                </div>
            </div>
        )
    }

    return (
        <div className={cn("flex items-start justify-between gap-2", className)}>
            <div className="flex items-start gap-3 min-w-0 flex-1">
                {imageSrc ? (
                    <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-md overflow-hidden", iconClassName ?? "bg-muted text-muted-foreground")}>
                        <img src={imageSrc} alt="" className="h-full w-full object-cover" />
                    </div>
                ) : Icon ? (
                    <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-md", iconClassName ?? "bg-muted text-muted-foreground")}>
                        <Icon className="h-4 w-4" />
                    </div>
                ) : null}
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
            </div>
            {trailing && <div className="shrink-0">{trailing}</div>}
        </div>
    )
}

// ─── Body ─────────────────────────────────────────────────────────────────────

interface EntityCardBodyProps {
    /** Override grid columns via className. Default: auto-fit responsive grid */
    className?: string
    children?: React.ReactNode
    /**
     * Action buttons rendered at the top-right of the body.
     * Uses stopPropagation so they don't trigger onClick on the card itself.
     */
    actions?: React.ReactNode
}

function EntityCardBody({ children, className, actions }: EntityCardBodyProps) {
    if (!actions) {
        return (
            <div className={cn("grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-x-4 gap-y-2", className)}>
                {children}
            </div>
        )
    }

    return (
        <div className={cn("flex items-start justify-between gap-4", className)}>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-x-4 gap-y-2 flex-1 min-w-0">
                {children}
            </div>
            <div
                className="shrink-0 flex items-center gap-1 pt-0.5"
                onClick={(e) => e.stopPropagation()}
            >
                {actions}
            </div>
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
            className={cn("h-5 gap-1 rounded-sm px-1.5 text-[10px] font-semibold uppercase tracking-wide", className)}
            {...props}
        >
            {dot && <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />}
            {label}
        </Badge>
    )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

interface EntityCardSkeletonProps {
    className?: string
    variant?: "full" | "compact"
    showHeader?: boolean
    showBody?: boolean
    showFooter?: boolean
}

function EntityCardSkeleton({
    className,
    variant = "full",
    showHeader = true,
    showBody = true,
    showFooter = false,
}: EntityCardSkeletonProps) {
    if (variant === "compact") {
        return (
            <EntityCardRoot variant="compact" className={cn("animate-in fade-in duration-500", className)}>
                {showHeader && (
                    <div className="flex flex-col gap-2 p-1">
                        <div className="flex items-center gap-3">
                            <Skeleton className="h-8 w-8 rounded-sm shrink-0" />
                            <div className="flex flex-col gap-1.5 flex-1">
                                <Skeleton className="h-4 w-3/4" />
                                <Skeleton className="h-3 w-1/2 opacity-60" />
                            </div>
                        </div>
                    </div>
                )}
            </EntityCardRoot>
        )
    }

    return (
        <EntityCardRoot className={cn("animate-in fade-in duration-500", className)}>
            {showHeader && (
                <EntityCardHeader
                    title={
                        <div className="flex items-center gap-3 min-w-0">
                            <Skeleton className="h-8 w-8 rounded-md shrink-0" />
                            <Skeleton className="h-5 w-48 shrink-0" />
                        </div>
                    }
                    subtitle={
                        <div className="flex items-center gap-2.5">
                            <Skeleton className="h-4 w-20 rounded-sm" />
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
            )}
            {showBody && (
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
            )}
            {showFooter && (
                <EntityCardFooter className="pt-2">
                    <Skeleton className="h-8 w-24 rounded-md" />
                    <Skeleton className="h-8 w-20 rounded-md" />
                </EntityCardFooter>
            )}
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
    EntityCardSkeletonProps,
    EntityCardBodyProps,
    EntityCardFieldProps,
    EntityCardFooterProps,
    EntityCardBadgeProps,
}
