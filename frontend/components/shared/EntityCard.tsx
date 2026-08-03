"use client"

import * as React from "react"
import Image from "next/image"
import { cn, formatPlainDate } from "@/lib/utils"
import { MoneyDisplay } from "./MoneyDisplay"
import { Badge } from "@/components/ui/badge"
import { type VariantProps } from "class-variance-authority"
import { type badgeVariants } from "@/components/ui/badge"
import { type LucideIcon, ArrowRight, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Checkbox } from "@/components/ui/checkbox"

// ─── Base props ───────────────────────────────────────────────────────────────

interface EntityCardSelectionContextValue {
    selectable?: boolean
    checked?: boolean
    onCheckedChange?: (checked: boolean) => void
    isAnySelected?: boolean
}

const EntityCardSelectionContext = React.createContext<EntityCardSelectionContextValue>({
    selectable: false,
    checked: false,
    isAnySelected: false,
})

interface EntityCardRootProps {
    /** Compact removes footer and reduces padding — ideal for dense grids */
    variant?: "compact" | "full"
    isSelected?: boolean
    onClick?: () => void
    /**
     * Per-card default action handler. When provided, clicking the card fires
     * this instead of `onClick`. Pass `null` to fall back to `onClick`.
     * Use `createEntityActions().defaultAction(ctx)?.(item)` to derive this.
     */
    defaultAction?: ((e: React.MouseEvent) => void) | null
    className?: string
    children: React.ReactNode
    selectable?: boolean
    checked?: boolean
    onCheckedChange?: (checked: boolean) => void
    isAnySelected?: boolean
}

function EntityCardRoot({
    variant = "full",
    isSelected = false,
    onClick,
    defaultAction,
    className,
    children,
    selectable = false,
    checked = false,
    onCheckedChange,
    isAnySelected = false,
}: EntityCardRootProps) {
    return (
        <EntityCardSelectionContext.Provider value={{ selectable, checked, onCheckedChange, isAnySelected }}>
            <div
                role={onClick || defaultAction ? "button" : undefined}
                tabIndex={onClick || defaultAction ? 0 : undefined}
                onClick={(e) => {
                    if (defaultAction) {
                        defaultAction(e)
                    } else {
                        onClick?.()
                    }
                }}
                onKeyDown={(e) => {
                    if ((onClick || defaultAction) && (e.key === "Enter" || e.key === " ")) {
                        e.preventDefault()
                        if (defaultAction) {
                            defaultAction(e as unknown as React.MouseEvent)
                        } else {
                            onClick?.()
                        }
                    }
                }}
                className={cn(
                    "card-base group flex flex-col relative transition-all duration-300",
                    "bg-background text-foreground",
                    variant === "compact" ? "gap-1.5 p-3" : "gap-3 p-4",
                    isSelected && "accent-visible",
                    checked && "border-primary/40 bg-primary/5 shadow-sm",
                    (onClick || defaultAction) && "cursor-pointer select-none",
                    className
                )}
            >
                {children}
            </div>
        </EntityCardSelectionContext.Provider>
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
    /** Action buttons rendered at the top-right of the header (DataCell.Action). Always stops propagation. */
    actions?: React.ReactNode
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

function EntityCardHeader({ title, subtitle, trailing, actions, center, icon: Icon, imageSrc, iconClassName, className }: EntityCardHeaderProps) {
    const { selectable, checked, onCheckedChange, isAnySelected } = React.useContext(EntityCardSelectionContext)

    const checkboxNode = selectable && (
        <div
            className={cn(
                "shrink-0 z-10 self-center flex items-center justify-center transition-all duration-300",
                isAnySelected
                    ? "opacity-100 w-5 mr-1"
                    : "opacity-0 w-0 pointer-events-none group-hover:opacity-100 group-hover:w-5 group-hover:pointer-events-auto group-hover:mr-1 group-focus-within:opacity-100 group-focus-within:w-5 group-focus-within:pointer-events-auto group-focus-within:mr-1 overflow-hidden"
            )}
            onClick={(e) => e.stopPropagation()}
        >
            <Checkbox
                variant="circle"
                checked={checked}
                onCheckedChange={onCheckedChange}
            />
        </div>
    )

    if (center) {
        return (
            <div className={cn("grid grid-cols-[1fr_minmax(auto,3fr)_auto] items-start gap-2", className)}>
                <div className="flex items-stretch gap-3 min-w-0">
                    {checkboxNode}
                    {imageSrc ? (
                        <div className={cn("flex w-10 shrink-0 items-center justify-center rounded-md overflow-hidden", iconClassName ?? "bg-accent text-muted-foreground")}>
                            <Image src={imageSrc} alt="" fill className="object-cover" />
                        </div>
                    ) : Icon ? (
                        <div className={cn("flex w-10 shrink-0 items-center justify-center rounded-md", iconClassName ?? "bg-accent text-muted-foreground")}>
                            <Icon className="h-5 w-5" />
                        </div>
                    ) : null}
                    <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-bold leading-tight tracking-tight [&>div]:w-auto [&>div]:justify-start [&>div]:text-left">
                            {title}
                        </div>
                        {subtitle && (
                            <div className="mt-0.5 truncate text-xs text-muted-foreground">
                                {subtitle}
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex items-center justify-center self-center min-w-0">
                    {center}
                </div>
                <div className="flex items-center gap-2 justify-self-end">
                    {trailing}
                    {actions && <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>{actions}</div>}
                </div>
            </div>
        )
    }

    return (
        <div className={cn("flex items-start justify-between gap-2", className)}>
            <div className="flex items-stretch gap-3 min-w-0 flex-1">
                {checkboxNode}
                {imageSrc ? (
                    <div className={cn("flex w-10 shrink-0 items-center justify-center rounded-md overflow-hidden", iconClassName ?? "bg-accent text-muted-foreground")}>
                        <Image src={imageSrc} alt="" fill className="object-cover" />
                    </div>
                ) : Icon ? (
                    <div className={cn("flex w-10 shrink-0 items-center justify-center rounded-md", iconClassName ?? "bg-accent text-muted-foreground")}>
                        <Icon className="h-5 w-5" />
                    </div>
                ) : null}
                <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold leading-tight tracking-tight [&>div]:w-auto [&>div]:justify-start [&>div]:text-left">
                        {title}
                    </div>
                    {subtitle && (
                        <div className="mt-0.5 truncate text-xs text-muted-foreground">
                            {subtitle}
                        </div>
                    )}
                </div>
            </div>
            {(trailing || actions) && (
                <div className="flex items-center gap-2 shrink-0">
                    {trailing}
                    {actions && <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>{actions}</div>}
                </div>
            )}
        </div>
    )
}

// ─── Body ─────────────────────────────────────────────────────────────────────

interface EntityCardBodyProps {
    /** Override grid columns via className. Default: auto-fit responsive grid */
    className?: string
    children?: React.ReactNode
    /**
     * @deprecated Move actions to EntityCard.Header `actions` prop instead.
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
            <span className="flex items-center gap-1 text-xs font-medium text-foreground/80">
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
                "flex items-center justify-end gap-1.5 border-t border-border pt-2.5",
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
                            <Skeleton className="h-10 w-10 rounded-sm shrink-0" />
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
                <EntityCardBody className="flex items-start justify-between gap-4 pt-2 border-t border-border mt-1">
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

// ─── Workflow Body ────────────────────────────────────────────────────────────

interface EntityCardWorkflowLine {
    quantity: number | string
    product_name?: string
}

interface EntityCardWorkflowBodyProps {
    /** Order/invoice line items to display as qty × product */
    lines: EntityCardWorkflowLine[]
    /** Document total amount */
    total: number
    /** Pending amount — omitted from display when undefined */
    pending?: number
    /** Raw date string for delivery/receipt — omitted when undefined */
    deliveryDate?: string
    /** Label above the delivery date column (default: "Entrega") */
    dateLabel?: string
    className?: string
}

function EntityCardWorkflowBody({ lines, total, pending, deliveryDate, dateLabel = "Entrega", className }: EntityCardWorkflowBodyProps) {
    if (lines.length === 0) return null

    return (
        <EntityCardBody className={cn("flex items-start justify-between gap-4 pt-2 border-t border-border/30 mt-1", className)}>
            <div className="flex flex-wrap gap-x-6 gap-y-1.5 flex-1">
                {lines.map((line, idx) => (
                    <div key={idx} className="text-sm text-foreground/70 flex flex-col leading-tight min-w-0">
                        <span>
                            <span className="font-medium text-foreground">{Math.round(parseFloat(String(line.quantity || 0)))}</span>
                            <span className="text-muted-foreground/40 mx-1">×</span>
                        </span>
                        <span className="text-xs text-muted-foreground truncate max-w-[220px]">{line.product_name || 'Producto'}</span>
                    </div>
                ))}
            </div>
            <div className="flex items-start gap-4 shrink-0 pr-9">
                {deliveryDate ? (
                    <div className="flex flex-col items-end min-w-[80px]">
                        <span className="text-[9px] text-muted-foreground uppercase tracking-widest font-extrabold mb-0.5">{dateLabel}</span>
                        <span className="text-sm tracking-tight whitespace-nowrap">{formatPlainDate(deliveryDate)}</span>
                    </div>
                ) : null}
                {pending != null && pending > 0 && (
                    <div className="flex flex-col items-end min-w-[80px]">
                        <span className="text-[9px] text-warning/80 uppercase tracking-widest font-extrabold mb-0.5">Pendiente</span>
                        <MoneyDisplay amount={pending} showColor={false} className="text-sm tracking-tight text-warning" />
                    </div>
                )}
                <div className="flex flex-col items-end min-w-[80px]">
                    <span className="text-[9px] text-muted-foreground uppercase tracking-widest font-extrabold mb-0.5">Total</span>
                    <MoneyDisplay amount={total} showColor={false} className="text-sm tracking-tight" />
                </div>
            </div>
        </EntityCardBody>
    )
}

// ─── List Item ────────────────────────────────────────────────────────────────

interface EntityCardListItemProps {
    /** Icon rendered without background (left side) */
    icon?: LucideIcon
    /** Styling for the icon (e.g. "text-success") */
    iconClassName?: string
    /** Primary label text */
    label: React.ReactNode
    /** Optional sublabel below the label */
    sublabel?: React.ReactNode
    /** Right-side value content */
    value?: React.ReactNode
    /** Alternative right-side slot (replaces value) */
    trailing?: React.ReactNode
    /** Click handler */
    onClick?: () => void
    className?: string
}

function EntityCardListItem({ icon: Icon, iconClassName, label, sublabel, value, trailing, onClick, className }: EntityCardListItemProps) {
    return (
        <Button
            variant="ghost"
            onClick={onClick}
            className={cn(
                "w-full flex items-center gap-3 py-2 px-2 text-left justify-start",
                "card-base",
                "transition-all group",
                onClick && "cursor-pointer",
                className
            )}
        >
            {Icon && (
                <Icon className={cn("h-3.5 w-3.5 shrink-0", iconClassName ?? "text-muted-foreground")} />
            )}
            <div className="flex-1 min-w-0">
                <span className="text-xs font-medium truncate block">{label}</span>
                {sublabel && (
                    <span className="text-[10px] text-muted-foreground truncate block">{sublabel}</span>
                )}
            </div>
            {trailing ?? (value != null && (
                <span className="text-xs font-bold tabular-nums shrink-0">{value}</span>
            ))}
            {onClick && (
                <ArrowRight className="h-3 w-3 text-muted-foreground/0 group-hover:text-muted-foreground transition-all shrink-0" />
            )}
        </Button>
    )
}

// ─── List Item Skeleton ───────────────────────────────────────────────────────

interface EntityCardListItemSkeletonProps {
    count?: number
    className?: string
}

function EntityCardListItemSkeleton({ count = 3, className }: EntityCardListItemSkeletonProps) {
    return (
        <div className={cn("divide-y divide-border/40", className)}>
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 py-2 px-1 animate-in fade-in duration-500">
                    <Skeleton className="h-3.5 w-3.5 rounded-sm shrink-0" />
                    <div className="flex-1 min-w-0">
                        <Skeleton className="h-3 w-3/4" />
                        <Skeleton className="h-2.5 w-1/2 mt-1 opacity-60" />
                    </div>
                    <Skeleton className="h-3 w-16 shrink-0" />
                </div>
            ))}
        </div>
    )
}

// ─── Metrics ────────────────────────────────────────────────────────────────

type MetricVariant = 'default' | 'primary' | 'success' | 'warning'

interface EntityCardMetricItem {
    /** Label above the value (e.g. "Cupo", "Utilizado", "Disponible") */
    label: string
    /** Value content — prefer DataCell.Currency or DataCell.Number for formatting */
    value: React.ReactNode
    /** Optional leading icon in the metric column */
    icon?: LucideIcon
    /** Semantic color intent — maps to Tailwind token colors */
    variant?: MetricVariant
}

interface EntityCardMetricsProps {
    /** Array of metric items to display as equal-width columns */
    metrics: EntityCardMetricItem[]
    /** Default variant applied to all items (overridden per-item) */
    defaultVariant?: MetricVariant
    className?: string
}

const METRIC_VARIANT_CLASSES: Record<MetricVariant, string> = {
    default: 'text-foreground',
    primary: 'text-primary',
    success: 'text-success',
    warning: 'text-warning',
}

function EntityCardMetrics({ metrics, defaultVariant = 'default', className }: EntityCardMetricsProps) {
    return (
        <div className={cn("flex items-stretch gap-px border-t border-border/30 mt-1", className)}>
            {metrics.map((item, idx) => {
                const variant = item.variant ?? defaultVariant
                return (
                    <div
                        key={idx}
                        className={cn(
                            "flex-1 flex flex-col gap-0.5 px-4 py-2",
                            "relative after:absolute after:inset-y-1 after:right-0 after:w-px after:bg-border/20 last:after:hidden"
                        )}
                    >
                        {item.icon && (
                            <item.icon className={cn("h-3 w-3 mb-0.5", METRIC_VARIANT_CLASSES[variant])} />
                        )}
                        <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/60">
                            {item.label}
                        </span>
                        <span className={cn("text-sm font-bold tabular-nums tracking-tight", METRIC_VARIANT_CLASSES[variant])}>
                            {item.value}
                        </span>
                    </div>
                )
            })}
        </div>
    )
}

// ─── Dashboard ──────────────────────────────────────────────────────────────

interface EntityCardDashboardProps {
    /** Rich custom content — typically a grid of sub-cards or complex widgets */
    children: React.ReactNode
    /** Optional title rendered above the content with section styling */
    title?: React.ReactNode
    className?: string
}

function EntityCardDashboard({ children, title, className }: EntityCardDashboardProps) {
    return (
        <div className={cn("border-t border-border/50 mt-1", className)}>
            {title && (
                <div className="px-4 pt-3 pb-1">
                    {title}
                </div>
            )}
            <div className="p-4 bg-muted/5">
                {children}
            </div>
        </div>
    )
}

// ─── Hero ───────────────────────────────────────────────────────────────────

interface EntityCardHeroProps extends Pick<EntityCardHeaderProps, 'title' | 'subtitle' | 'actions'> {
    /** Primary image — renders in a larger 64×64 icon slot */
    imageSrc?: string
    /** Fallback icon when no image is present */
    icon?: LucideIcon
    /** Styling for the icon container */
    iconClassName?: string
    /** Prominent accent element rendered as the trailing slot (e.g. price, status) */
    accent?: React.ReactNode
    className?: string
}

function EntityCardHero({ imageSrc, icon, iconClassName, accent, title, subtitle, actions, className }: EntityCardHeroProps) {
    return (
        <EntityCardHeader
            imageSrc={imageSrc}
            icon={icon}
            iconClassName={cn("h-16 w-16 rounded-lg", iconClassName ?? "bg-accent text-muted-foreground")}
            title={title}
            subtitle={subtitle}
            trailing={accent}
            actions={actions}
            className={className}
        />
    )
}

// ─── Hub Trigger ──────────────────────────────────────────────────────────────

interface EntityCardHubTriggerProps {
    /** Whether the hub is currently open for this card */
    isSelected: boolean
    /** Toggle handler — called when the hub trigger button is clicked */
    onToggle: () => void
    className?: string
}

/**
 * Renders a hub-trigger button inside an EntityCard header.
 * Mirrors the visual feedback of `createHubTriggerColumn` for DataTable rows:
 * - Selected: ArrowLeft icon, `text-primary`, slide-in animation
 * - Not selected: ArrowRight icon, `text-muted-foreground/30`, hover translate
 */
function EntityCardHubTrigger({ isSelected, onToggle, className }: EntityCardHubTriggerProps) {
    return (
        <div className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
            <Button
                variant="ghost"
                size="icon"
                onClick={onToggle}
                className={cn(
                    "h-7 w-7 rounded-full transition-all duration-200",
                    "hover:scale-105 active:scale-95 hover:bg-accent hover:text-accent-foreground",
                    isSelected
                        ? "text-primary animate-in fade-in slide-in-from-right-1 duration-300"
                        : "text-muted-foreground/30 hover:text-primary hover:translate-x-0.5",
                    className,
                )}
            >
                {isSelected ? (
                    <ArrowLeft className="h-4 w-4" />
                ) : (
                    <ArrowRight className="h-4 w-4" />
                )}
            </Button>
        </div>
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
    ListItem: EntityCardListItem,
    ListItemSkeleton: EntityCardListItemSkeleton,
    WorkflowBody: EntityCardWorkflowBody,
    Metrics: EntityCardMetrics,
    Dashboard: EntityCardDashboard,
    Hero: EntityCardHero,
    HubTrigger: EntityCardHubTrigger,
})

export type {
    EntityCardRootProps,
    EntityCardHeaderProps,
    EntityCardSkeletonProps,
    EntityCardBodyProps,
    EntityCardFieldProps,
    EntityCardFooterProps,
    EntityCardBadgeProps,
    EntityCardListItemProps,
    EntityCardListItemSkeletonProps,
    EntityCardWorkflowBodyProps,
    EntityCardWorkflowLine,
    EntityCardMetricsProps,
    EntityCardMetricItem,
    EntityCardDashboardProps,
    EntityCardHeroProps,
    EntityCardHubTriggerProps,
}
