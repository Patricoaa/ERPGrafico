"use client"

import * as React from "react"
import Image from "next/image"
import { cn, formatPlainDate } from "@/lib/utils"
import { MoneyDisplay } from "./MoneyDisplay"
import { Badge } from "@/components/shared"
import type { BadgeIntent } from "@/lib/badge-resolvers"
import type { LucideIcon } from "lucide-react"
import { ArrowRight, ArrowLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { SelectionRing } from "@/components/shared"
import { CardSurface, CardLead, Chip, cardAnatomy } from "@/components/shared"

// ─── Base props ───────────────────────────────────────────────────────────────

interface EntityCardSelectionContextValue {
    selectable?: boolean
    checked?: boolean
    onCheckedChange?: (checked: boolean) => void
    isAnySelected?: boolean
    selectionLabel?: string
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
    /**
     * The whole card opens the record through a stretched link: the title button (marked
     * `data-card-open`) covers the card, while actions, the checkbox and links in the meta pairs
     * stay above it. Siblings, never nested interactive containers (AX-4).
     */
    openable?: boolean
    /** Archived/inactive: the card is muted and its images desaturated. */
    muted?: boolean
    /** State/document rail (`CardRail`) holding the entity icon. Its side comes from the layout; the padding moves to an inner column so the rail is full height. */
    rail?: React.ReactNode
    selectable?: boolean
    checked?: boolean
    onCheckedChange?: (checked: boolean) => void
    isAnySelected?: boolean
    /** Accessible name of the selection checkbox, e.g. "Seleccionar OV-0012" (ADR-0087 R4). */
    selectionLabel?: string
}

function EntityCardRoot({
    variant = "full",
    isSelected = false,
    onClick,
    defaultAction,
    className,
    children,
    openable = false,
    muted = false,
    rail,
    selectable = false,
    checked = false,
    onCheckedChange,
    isAnySelected = false,
    selectionLabel,
}: EntityCardRootProps) {
    const padding = variant === "compact" ? "gap-1.5 p-3" : "gap-3 p-4"
    return (
        <EntityCardSelectionContext.Provider value={{ selectable, checked, onCheckedChange, isAnySelected, selectionLabel }}>
            <CardSurface
                layout={rail ? "inline" : "stacked"}
                // Same selection language as the POS product grid: CMYK ribbon on hover and once open/checked.
                kind="choice"
                pressable={openable || selectable}
                selected={isSelected || checked ? true : undefined}
                unavailable={false}
                role={onClick || defaultAction ? "button" : undefined}
                onClick={onClick}
                className={cn(
                    "group relative transition-all duration-300",
                    rail ? "flex-row" : cn("flex flex-col", padding),
                    (onClick || defaultAction) && "cursor-pointer select-none",
                    muted && "opacity-70 [&_img]:grayscale",
                    // The stretched link covers the card: without its own cursor, the button's default
                    // cursor wins over the surface's pointer (the POS grid has no overlay to fight).
                    openable && "cursor-pointer [&_[data-card-open]]:cursor-pointer hover:border-foreground/30 has-[[data-card-open]:focus-visible]:ring-2 has-[[data-card-open]:focus-visible]:ring-ring",
                    className
                )}
            >
                {rail}
                {rail ? <div className={cn("flex min-w-0 flex-1 flex-col", padding)}>{children}</div> : children}
            </CardSurface>
        </EntityCardSelectionContext.Provider>
    )
}

// ─── Media (top strip) ────────────────────────────────────────────────────────

interface EntityCardMediaProps {
    icon?: LucideIcon
    /** Image URL — takes precedence over `icon`. */
    imageSrc?: string
    /** Custom node (e.g. avatar) — takes precedence over everything. */
    avatar?: React.ReactNode
    /** Tone of the strip and its icon (e.g. "text-success bg-success/10"). */
    iconClassName?: string
    /** Chip(s) over the top-left corner, always above the centred icon/photo. Arrays render separate stacked badges. */
    badge?: string | readonly string[]
    /** Secondary chip stacked below the badge at the top-left (small gap). */
    footnote?: string
    footnoteIcon?: LucideIcon
    className?: string
}

/** Full-bleed strip above the header (ProductCard anatomy). Bleeds over the card's padding. */
function EntityCardMedia({ icon: Icon, imageSrc, avatar, iconClassName, badge, footnote, footnoteIcon, className }: EntityCardMediaProps) {
    const { selectable, checked, onCheckedChange, isAnySelected, selectionLabel } = React.useContext(EntityCardSelectionContext)
    const badges = (typeof badge === "string" ? [badge] : badge ?? []).filter(Boolean)
    return (
        <div className={cn("relative -mx-3 -mt-3 mb-1 flex h-20 items-center justify-center overflow-hidden rounded-t-sm", iconClassName ?? "bg-muted text-muted-foreground", className)}>
            {avatar ?? (imageSrc ? (
                <Image src={imageSrc} alt="" fill unoptimized={imageSrc.startsWith("data:")} className="object-cover" />
            ) : Icon ? (
                <Icon className="size-6" aria-hidden />
            ) : null)}
            {(badges.length > 0 || footnote) && (
                <div data-media-chips className="absolute left-2 top-2 z-10 flex max-w-[calc(100%-3rem)] flex-col items-start gap-1">
                    {badges.map((text, index) => (
                        <Badge key={`${text}-${index}`} intent="neutral" size="xs" className="max-w-full truncate border border-border bg-background text-3xs font-normal">
                            {text}
                        </Badge>
                    ))}
                    {footnote && (
                        <Chip size="xs" icon={footnoteIcon} className="max-w-full truncate border border-border bg-background text-3xs font-normal">
                            {footnote}
                        </Chip>
                    )}
                </div>
            )}
            {/* Bulk checkbox in the corner of the strip (catalog cards): above the stretched link. */}
            {selectable && (
                <span
                    className={cn(
                        "absolute right-2 top-2 z-10 flex rounded-full bg-background/90 p-1 shadow-xs transition-opacity",
                        !isAnySelected && "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
                    )}
                >
                    <SelectionRing
                        aria-label={selectionLabel ?? "Seleccionar"}
                        checked={checked}
                        onCheckedChange={onCheckedChange}
                        size="sm"
                    />
                </span>
            )}
        </div>
    )
}

// ─── Header ───────────────────────────────────────────────────────────────────

interface EntityCardHeaderProps {
    /** The title may take two lines (catalog cards) instead of one with an ellipsis. */
    wrapTitle?: boolean
    /** `corner`: the bulk checkbox lives on the media strip (`EntityCard.Media`), not beside the title. */
    selection?: "inline" | "corner"
    /** Monospace identifier above the title (folio, SKU) — the kit's `code` line. */
    code?: React.ReactNode
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
    /** Optional React node rendered in the icon slot — takes precedence over `imageSrc` and `icon` */
    avatar?: React.ReactNode
    /** Styling for the icon container (e.g. "text-success bg-success/10") */
    iconClassName?: string
    className?: string
}

function EntityCardHeader({ selection = "inline", wrapTitle = false, code, title, subtitle, trailing, actions, center, icon: Icon, imageSrc, avatar, iconClassName, className }: EntityCardHeaderProps) {
    const { selectable, checked, onCheckedChange, isAnySelected, selectionLabel } = React.useContext(EntityCardSelectionContext)

    const checkboxNode = selectable && selection === "inline" && (
        <SelectionRing
            aria-label={selectionLabel ?? "Seleccionar"}
            checked={checked}
            onCheckedChange={onCheckedChange}
            size="sm"
            className={cn(
                "relative z-10 shrink-0 self-center flex items-center justify-center transition-all duration-300",
                isAnySelected
                    ? "opacity-100 w-5 mr-1"
                    : "opacity-0 w-0 pointer-events-none group-hover:opacity-100 group-hover:w-5 group-hover:pointer-events-auto group-hover:mr-1 group-focus-within:opacity-100 group-focus-within:w-5 group-focus-within:pointer-events-auto group-focus-within:mr-1 overflow-hidden"
            )}
        />
    )

    // Avatar (custom node) > image > icon. The same lead for the plain and the centered header.
    const leadNode = avatar ?? (imageSrc ? (
        <CardLead stretch className={imageSrc.startsWith("data:") ? "bg-transparent" : iconClassName}>
            <Image src={imageSrc} alt="" fill unoptimized={imageSrc.startsWith("data:")} className="object-cover" />
        </CardLead>
    ) : Icon ? (
        <CardLead stretch className={iconClassName}>
            <Icon className="h-5 w-5" />
        </CardLead>
    ) : null)

    const identity = (
        <div className="flex items-stretch gap-3 min-w-0 flex-1">
            {checkboxNode}
            {leadNode}
            <div className="min-w-0 flex-1">
                {code && <div className={cardAnatomy.code}>{code}</div>}
                <div className={cn(cardAnatomy.entityTitle, wrapTitle && "line-clamp-2 whitespace-normal", "[&>div]:w-auto [&>div]:justify-start [&>div]:text-left")}>
                    {title}
                </div>
                {subtitle && <div className={cardAnatomy.entitySubtitle}>{subtitle}</div>}
            </div>
        </div>
    )

    const trailingNode = (trailing || actions) && (
        <div className="flex items-center gap-2 shrink-0">
            {trailing}
            {actions && <div className="relative z-10 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>{actions}</div>}
        </div>
    )

    if (center) {
        return (
            <div className={cn("grid grid-cols-[1fr_minmax(auto,3fr)_auto] items-start gap-2", className)}>
                {identity}
                <div className="flex items-center justify-center self-center min-w-0">
                    {center}
                </div>
                <div className="justify-self-end">{trailingNode}</div>
            </div>
        )
    }

    return (
        <div className={cn("flex items-start justify-between gap-2", className)}>
            {identity}
            {trailingNode}
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

// ─── Field ─────────────────────────────────────────────────────────────────────

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
            <span className={cardAnatomy.eyebrow}>
                {label}
            </span>
            <span className={cn("flex items-center gap-1", cardAnatomy.fieldValue)}>
                {Icon && <Icon className="h-3 w-3 shrink-0 text-muted-foreground/50" />}
                {value ?? <span className="text-muted-foreground/40">—</span>}
            </span>
        </div>
    )
}

// ─── Footer ────────────────────────────────────────────────────────────────────

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

// ─── Status Badge ──────────────────────────────────────────────────────────────

interface EntityCardBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
    label: string
    dot?: boolean
    intent?: BadgeIntent
}

function EntityCardBadge({ label, dot = false, intent = "neutral", className, ...props }: EntityCardBadgeProps) {
    return (
        <Badge
            intent={intent}
            size="sm"
            className={cn("gap-1", className)}
            {...props}
        >
            {dot && <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />}
            {label}
        </Badge>
    )
}

// ─── Skeleton ──────────────────────────────────────────────────────────────────

interface EntityCardSkeletonProps {
    className?: string
    variant?: "full" | "compact"
    showHeader?: boolean
    showBody?: boolean
    showFooter?: boolean
    /** Número de campos (label + valor) que se pintan en el body. Default 3. */
    fields?: number
    /** Header: línea de código (code) sobre el título */
    code?: boolean
    /** Header: lead (icono/avatar) junto al título */
    lead?: boolean
    /** Header: subtítulo bajo el título */
    subtitle?: boolean
    /** Header: slot trailing (chips / acciones) */
    trailing?: boolean
    /** Header: slot centrado entre título y trailing */
    center?: boolean
    /** Strip de media superior (EntityCard.Media) */
    media?: boolean
    /** Barra/rail lateral de estado (CardRail) */
    rail?: boolean | { side?: "left" | "right" }
    /** Sección Meta (pares label/valor bajo el header) */
    meta?: boolean
    /** Número de pares label/valor en la sección Meta. Default 2. */
    metaCount?: number
    /** Fila Highlights bajo el header */
    highlights?: boolean
    /** Número de badges en la fila Highlights. Default 2. */
    highlightsCount?: number
    /** Métricas horizontales inferiores (EntityCard.Metrics / workflow) */
    metrics?: boolean | number
    /** Foot inferior (monto + glifo / acciones) */
    foot?: boolean
    /** Si el foot incluye monto/caption o solo glifo/acción */
    footAmount?: boolean
    footAlign?: "start" | "end"
}

/** Un campo del body: etiqueta + valor, espejo de EntityCard.Field. */
function EntityCardSkeletonField() {
    return (
        <div className="flex flex-col gap-0.5 min-w-0">
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-4 w-full" />
        </div>
    )
}

/** Media strip superior, espejo de EntityCard.Media. */
function EntityCardSkeletonMedia() {
    return (
        <div className="relative -mx-3 -mt-3 mb-1 flex h-20 items-center justify-center overflow-hidden rounded-t-sm bg-muted text-muted-foreground">
            <Skeleton className="size-10 shrink-0 rounded-sm" />
        </div>
    )
}

/** Meta: pares label/valor bajo el header, espejo de EntityCard.Meta. */
function EntityCardSkeletonMeta({ count = 2 }: { count?: number }) {
    return (
        <dl className="grid min-w-0 grid-cols-1 @[18rem]:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] items-start gap-x-4 gap-y-1.5">
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="flex min-w-0 flex-col items-start">
                    <dt className={cardAnatomy.eyebrow}>
                        <Skeleton className="h-3 w-1/3" />
                    </dt>
                    <dd className="min-w-0 max-w-full [overflow-wrap:anywhere]">
                        <Skeleton className={i % 2 === 0 ? "h-4 w-full" : "h-4 w-3/4"} />
                    </dd>
                </div>
            ))}
        </dl>
    )
}

/** Highlights: fila de etiquetas de estado bajo el header. */
function EntityCardSkeletonHighlights({ count = 2 }: { count?: number }) {
    return (
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            {Array.from({ length: count }).map((_, i) => (
                <Skeleton key={i} className={cn("h-6 rounded-md", i % 2 === 0 ? "w-24" : "w-20")} />
            ))}
        </div>
    )
}

/** Métricas horizontales inferiores (EntityCard.Metrics / Workflow). */
function EntityCardSkeletonMetrics({ count = 2 }: { count?: number }) {
    return (
        <div className="flex items-stretch justify-start border-t border-border mt-1">
            {Array.from({ length: count }).map((_, idx) => (
                <div key={idx} className="flex shrink-0 flex-col gap-0.5 py-2 pl-1 pr-6">
                    <Skeleton className="h-2.5 w-12 mb-0.5" />
                    <Skeleton className="h-4 w-16" />
                </div>
            ))}
        </div>
    )
}

/** Foot inferior: caption + monto + glifo, espejo de EntityCard.Foot. */
function EntityCardSkeletonFoot({ amount = true, align = "start" }: { amount?: boolean; align?: "start" | "end" }) {
    const isEnd = align === "end"
    return (
        <div className={cn(cardAnatomy.footer, "flex items-end gap-2", isEnd ? "justify-end" : "justify-between")}>
            {amount ? (
                <div className={cn("min-w-0", isEnd && "flex flex-col items-end")}>
                    <div className={cardAnatomy.caption}>
                        <Skeleton className="h-2.5 w-14 mb-1" />
                    </div>
                    <div className={cardAnatomy.amountSlot}>
                        <Skeleton className="h-5 w-20 tabular-nums" />
                    </div>
                </div>
            ) : (
                <div />
            )}
            <ChevronRight className={cardAnatomy.glyph} aria-hidden />
        </div>
    )
}

function EntityCardSkeleton({
    className,
    variant = "full",
    showHeader = true,
    showBody = false,
    showFooter = false,
    fields = 3,
    code = false,
    lead = true,
    subtitle = true,
    trailing = true,
    center = false,
    media = false,
    rail = false,
    meta = false,
    metaCount = 2,
    highlights = false,
    highlightsCount = 2,
    metrics = false,
    foot = false,
    footAmount = true,
    footAlign = "start",
}: EntityCardSkeletonProps) {
    const fieldCount = Math.max(0, fields)
    const metricsCount = typeof metrics === "number" ? metrics : metrics ? 2 : 0

    const railSide = typeof rail === "object" ? (rail.side ?? "left") : "left"
    const railNode = rail ? (
        <div
            className={cn(
                cardAnatomy.rail,
                cardAnatomy.railSize.md,
                "border-border/60 bg-muted/20 text-muted-foreground",
                railSide === "left" ? "border-l-0 border-r" : "order-last"
            )}
            aria-hidden
        >
            <Skeleton className="size-5 rounded-sm" />
        </div>
    ) : undefined

    // ── Compact: catálogo denso, header mínimo en línea ──
    if (variant === "compact") {
        return (
            <EntityCardRoot variant="compact" rail={railNode} className={cn(className)}>
                {media && <EntityCardSkeletonMedia />}
                {showHeader && (
                    <EntityCardHeader
                        avatar={lead ? <Skeleton className="h-8 w-8 rounded-sm shrink-0" /> : undefined}
                        code={code ? <Skeleton className="h-2.5 w-16 mb-1" /> : undefined}
                        title={<Skeleton className="h-4 w-3/4" />}
                        subtitle={subtitle ? <Skeleton className="h-3 w-1/2 opacity-60" /> : undefined}
                        trailing={trailing ? <Skeleton className="h-5 w-16 rounded-full shrink-0" /> : undefined}
                        center={center ? <Skeleton className="h-5 w-24 rounded-md" /> : undefined}
                    />
                )}
                {highlights && <EntityCardSkeletonHighlights count={highlightsCount} />}
                {meta && <EntityCardSkeletonMeta count={metaCount} />}
                {metricsCount > 0 && <EntityCardSkeletonMetrics count={metricsCount} />}
                {showBody && (
                    <EntityCardBody className="gap-4 pt-2 border-t border-border mt-1">
                        <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-x-4 gap-y-2">
                            {Array.from({ length: fieldCount }).map((_, i) => (
                                <EntityCardSkeletonField key={i} />
                            ))}
                        </div>
                    </EntityCardBody>
                )}
                {foot && <EntityCardSkeletonFoot amount={footAmount} align={footAlign} />}
                {showFooter && (
                    <EntityCardFooter className="pt-2">
                        <Skeleton className="h-8 w-24 rounded-md" />
                        <Skeleton className="h-8 w-20 rounded-md" />
                    </EntityCardFooter>
                )}
            </EntityCardRoot>
        )
    }

    // ── Full: esqueleto completo con todas las secciones opcionales ──
    return (
        <EntityCardRoot rail={railNode} className={cn(className)}>
            {media && <EntityCardSkeletonMedia />}
            {showHeader && (
                <EntityCardHeader
                    avatar={lead ? <Skeleton className="h-8 w-8 rounded-md shrink-0" /> : undefined}
                    code={code ? <Skeleton className="h-2.5 w-20 mb-1" /> : undefined}
                    title={<Skeleton className="h-5 w-48 shrink-0" />}
                    subtitle={
                        subtitle ? (
                            <div className="flex items-center gap-2.5">
                                <Skeleton className="h-4 w-20 rounded-sm" />
                                <Skeleton className="h-4 w-24" />
                            </div>
                        ) : undefined
                    }
                    trailing={
                        trailing ? (
                            <div className="flex items-center gap-2 shrink-0">
                                <Skeleton className="h-6 w-20 rounded-full" />
                            </div>
                        ) : undefined
                    }
                    center={center ? <Skeleton className="h-6 w-32 rounded-md" /> : undefined}
                />
            )}
            {highlights && <EntityCardSkeletonHighlights count={highlightsCount} />}
            {meta && <EntityCardSkeletonMeta count={metaCount} />}
            {metricsCount > 0 && <EntityCardSkeletonMetrics count={metricsCount} />}
            {showBody && (
                <EntityCardBody className="gap-x-4 gap-y-2 pt-2 border-t border-border mt-1">
                    {Array.from({ length: fieldCount }).map((_, i) => (
                        <EntityCardSkeletonField key={i} />
                    ))}
                </EntityCardBody>
            )}
            {foot && <EntityCardSkeletonFoot amount={footAmount} align={footAlign} />}
            {showFooter && (
                <EntityCardFooter className="pt-2">
                    <Skeleton className="h-8 w-24 rounded-md" />
                    <Skeleton className="h-8 w-20 rounded-md" />
                </EntityCardFooter>
            )}
        </EntityCardRoot>
    )
}

// ─── Workflow Body ─────────────────────────────────────────────────────────────

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
                    <div key={idx} className="text-xs text-foreground/70 flex flex-col leading-tight min-w-0">
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
                        <span className={cn(cardAnatomy.eyebrow, "mb-0.5")}>{dateLabel}</span>
                        <span className="text-xs font-medium tracking-tight whitespace-nowrap">{formatPlainDate(deliveryDate)}</span>
                    </div>
                ) : null}
                {pending != null && pending > 0 && (
                    <div className="flex flex-col items-end min-w-[80px]">
                        <span className={cn(cardAnatomy.eyebrow, "mb-0.5 text-warning")}>Pendiente</span>
                        <MoneyDisplay amount={pending} showColor={false} className="text-xs font-medium tracking-tight text-warning" />
                    </div>
                )}
                <div className="flex flex-col items-end min-w-[80px]">
                    <span className={cn(cardAnatomy.eyebrow, "mb-0.5")}>Total</span>
                    <MoneyDisplay amount={total} showColor={false} className="text-xs font-medium tracking-tight" />
                </div>
            </div>
        </EntityCardBody>
    )
}

// ─── List Item ──────────────────────────────────────────────────────────────────

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
                "card-flat",
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
                    <span className="text-3xs text-muted-foreground truncate block">{sublabel}</span>
                )}
            </div>
            {trailing ?? (value != null && (
                <span className="text-xs font-medium tabular-nums shrink-0">{value}</span>
            ))}
            {onClick && (
                <ArrowRight className="h-3 w-3 text-muted-foreground/0 group-hover:text-muted-foreground transition-all shrink-0" />
            )}
        </Button>
    )
}

// ─── List Item Skeleton ────────────────────────────────────────────────────────

interface EntityCardListItemSkeletonProps {
    count?: number
    className?: string
}

function EntityCardListItemSkeleton({ count = 3, className }: EntityCardListItemSkeletonProps) {
    return (
        <div className={cn("divide-y divide-border/40", className)}>
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 py-2 px-1">
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

// ─── Metrics ───────────────────────────────────────────────────────────────────

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
        <div className={cn("flex items-stretch justify-start border-t border-border mt-1", className)}>
            {metrics.map((item, idx) => {
                const variant = item.variant ?? defaultVariant
                return (
                    <div
                        key={idx}
                        className="flex shrink-0 flex-col gap-0.5 py-2 pl-1 pr-6"
                    >
                        {item.icon && (
                            <item.icon className={cn("h-3 w-3 mb-0.5", METRIC_VARIANT_CLASSES[variant])} />
                        )}
                        <span className={cardAnatomy.eyebrow}>
                            {item.label}
                        </span>
                        <span className={cn("text-xs font-sans font-medium tabular-nums tracking-tight", METRIC_VARIANT_CLASSES[variant])}>
                            {item.value}
                        </span>
                    </div>
                )
            })}
        </div>
    )
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

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

// ─── Hub Trigger ───────────────────────────────────────────────────────────────

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

// ─── Highlights (unlabelled status line) ───────────────────────────────────────

/** Inline row under the header for values that speak for themselves (stock health, flags). */
function EntityCardHighlights({ children, className }: { children: React.ReactNode; className?: string }) {
    return (
        <div className={cn("flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 [&_a]:relative [&_a]:z-10 [&_button]:relative [&_button]:z-10", className)}>
            {children}
        </div>
    )
}

// ─── Foot (pinned amount + open glyph) ──────────────────────────────────────────

interface EntityCardFootProps {
    /** Small caption above the amount (the field label). */
    caption?: React.ReactNode
    /** The amount: any value cell; the slot scales it to the kit's amount size. Optional (catalog cards without a price). */
    children?: React.ReactNode
    /** Entity actions (the kebab) at the bottom-right, replacing the open glyph. */
    actions?: React.ReactNode
    /** Open glyph at the bottom-right when there are no actions (default on). */
    glyph?: boolean
    /** Action-only footer: drop the top padding when there is no amount to show. */
    compact?: boolean
    /** Alignment of the footer content: "start" (default) or "end" (bottom-right). */
    align?: "start" | "end"
    className?: string
}

/** Bottom-pinned amount like the POS ProductCard: caption, amount and a chevron. Needs a card that fills its grid cell (`h-full`). */
function EntityCardFoot({ caption, children, actions, glyph = true, compact = false, align = "start", className }: EntityCardFootProps) {
    const isEnd = align === "end"
    return (
        <div className={cn(cardAnatomy.footer, compact && "pt-0", "flex items-end gap-2", isEnd ? "justify-end" : "justify-between", className)}>
            <div className={cn("min-w-0", isEnd && "flex flex-col items-end text-right")}>
                {caption && children && <div className={cardAnatomy.caption}>{caption}</div>}
                {children && <div className={cn(cardAnatomy.amountSlot, isEnd && "text-right")}>{children}</div>}
            </div>
            {actions ? (
                <div className="relative z-10 -mb-1 -mr-1 shrink-0" onClick={(e) => e.stopPropagation()}>{actions}</div>
            ) : (
                glyph && <ChevronRight className={cardAnatomy.glyph} aria-hidden />
            )}
        </div>
    )
}

// ─── Meta ──────────────────────────────────────────────────────────────────────

interface EntityCardMetaItem {
    key: string
    label: React.ReactNode
    value: React.ReactNode
    /** Per-item classes, e.g. `@md:hidden` for a value that also lives in the header on wide cards. */
    className?: string
}

interface EntityCardMetaProps {
    items: readonly EntityCardMetaItem[]
    className?: string
}

/**
 * Label/value pairs below the header (ADR-0087 R4). In the header center they squeezed the title.
 * Two fixed columns (not flex-wrap) so the same field starts at the same x on every card of a grid.
 * The first column is wider (1.4fr): put the long value (email, tags) first, the short one (phone, state) second.
 * Cards narrower than 18rem (4-5 column catalog grids) stack the pairs in one column instead of truncating them.
 */
function EntityCardMeta({ items, className }: EntityCardMetaProps) {
    if (items.length === 0) return null
    return (
        <dl className={cn("grid min-w-0 grid-cols-1 @[18rem]:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] items-start gap-x-4 gap-y-1.5 [&_a]:relative [&_a]:z-10 [&_button]:relative [&_button]:z-10", className)}>
            {items.map((item) => (
                <div key={item.key} className={cn("flex min-w-0 flex-col items-start", item.className)}>
                    <dt className={cn(cardAnatomy.eyebrow, "max-w-full truncate")}>{item.label}</dt>
                    <dd className="min-w-0 max-w-full [overflow-wrap:anywhere]">{item.value}</dd>
                </div>
            ))}
        </dl>
    )
}

// ─── Composite export ──────────────────────────────────────────────────────────

export const EntityCard = Object.assign(EntityCardRoot, {
    Media: EntityCardMedia,
    Header: EntityCardHeader,
    Meta: EntityCardMeta,
    Body: EntityCardBody,
    Field: EntityCardField,
    Footer: EntityCardFooter,
    Foot: EntityCardFoot,
    Highlights: EntityCardHighlights,
    Badge: EntityCardBadge,
    Skeleton: EntityCardSkeleton,
    ListItem: EntityCardListItem,
    ListItemSkeleton: EntityCardListItemSkeleton,
    WorkflowBody: EntityCardWorkflowBody,
    Metrics: EntityCardMetrics,
    Dashboard: EntityCardDashboard,
    HubTrigger: EntityCardHubTrigger,
})

export type {
    EntityCardRootProps,
    EntityCardMediaProps,
    EntityCardHeaderProps,
    EntityCardMetaProps,
    EntityCardMetaItem,
    EntityCardSkeletonProps,
    EntityCardBodyProps,
    EntityCardFieldProps,
    EntityCardFooterProps,
    EntityCardFootProps,
    EntityCardBadgeProps,
    EntityCardListItemProps,
    EntityCardListItemSkeletonProps,
    EntityCardWorkflowBodyProps,
    EntityCardWorkflowLine,
    EntityCardMetricsProps,
    EntityCardMetricItem,
    EntityCardDashboardProps,
    EntityCardHubTriggerProps,
}