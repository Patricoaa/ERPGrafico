"use client"

/**
 * Badge — Unified visual primitive for all badge-style elements.
 *
 * Architecture:
 *   Badge (this file)    ← single source of visual truth
 *     └── StatusBadge   ← thin wrapper: resolveStatus() → Badge
 *     └── Chip          ← thin wrapper: Badge with tracking="wide"
 *     └── EntityBadge   ← thin wrapper: resolveEntity() → Badge + optional Link
 *
 * Contract: docs/20-contracts/component-badge.md
 *
 * Typography invariants (never override in consumers):
 *   font-mono + font-black + uppercase + border
 *   tracking controlled by `tracking` prop (see contract rationale)
 *
 * DO NOT import Badge directly in features or pages.
 * Use StatusBadge, Chip, or EntityBadge instead.
 */

import React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'
import { type LucideIcon } from 'lucide-react'
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip'

// ─── CVA Definition ────────────────────────────────────────────────────────────

const badgeVariants = cva(
    // Base — invariant across all uses
    'inline-flex items-center justify-center font-mono font-black uppercase border transition-all duration-200 leading-none shrink-0',
    {
        variants: {
            /**
             * intent — semantic color. Maps to design token pairs (bg/text/border).
             * Never pass raw colors to Badge — use intent.
             */
            intent: {
                neutral:     'bg-muted/60 text-muted-foreground border-border/40',
                info:        'bg-info/10 text-info border-info/20',
                success:     'bg-success/10 text-success border-success/20',
                warning:     'bg-warning/10 text-warning border-warning/20',
                destructive: 'bg-destructive/10 text-destructive border-destructive/20',
                primary:     'bg-primary/10 text-primary border-primary/20',
            },

            /**
             * size — controls height, padding, font-size and icon size.
             * xs/sm follow Chip scale. md/lg follow StatusBadge scale.
             */
            size: {
                xs: 'h-[18px] px-2 text-[9px] gap-1',
                sm: 'h-[22px] px-2.5 text-[10px] gap-1',
                md: 'h-6 px-3 text-[12px] gap-1.5',
                lg: 'h-8 px-4 text-[14px] gap-2',
                xl: 'h-10 px-6 text-base gap-2.5',
            },

            /**
             * tracking — letter spacing variant.
             * "wide"  (tracking-widest) → Chip: short tags at 9-11px need max spacing.
             * "tight" (tracking-tight)  → Status/Entity: longer labels, prevents overflow.
             * This distinction is load-bearing — see component-badge.md §typography.
             */
            tracking: {
                wide:  'tracking-widest',
                tight: 'tracking-tight',
            },

            /**
             * shape — pill (default) or square.
             * hub and dot are separate render paths (see below).
             */
            shape: {
                pill:   'rounded-full',
                square: 'rounded-sm',
            },
        },
        defaultVariants: {
            intent:   'neutral',
            size:     'md',
            tracking: 'tight',
            shape:    'pill',
        },
    }
)

// ─── Icon size map ─────────────────────────────────────────────────────────────

const ICON_SIZES: Record<string, string> = {
    xs: 'h-2.5 w-2.5',
    sm: 'h-3 w-3',
    md: 'h-3.5 w-3.5',
    lg: 'h-4 w-4',
    xl: 'h-5 w-5',
}

// ─── Props ─────────────────────────────────────────────────────────────────────

export interface BadgeProps extends VariantProps<typeof badgeVariants> {
    children?: React.ReactNode
    /** Leading icon — same color as text, size controlled by `size` */
    icon?: LucideIcon
    /** layout/position only — never override typography or colors */
    className?: string
}

// ─── Dot variant props ─────────────────────────────────────────────────────────

export interface BadgeDotProps
    extends Pick<BadgeProps, 'intent' | 'size' | 'className'> {
    children: React.ReactNode
}

// ─── Hub variant props ─────────────────────────────────────────────────────────

export interface BadgeHubProps
    extends Pick<BadgeProps, 'intent' | 'className'> {
    icon: LucideIcon
    /** Tooltip shown on hover */
    tooltip?: string
    size?: 'sm' | 'md'
    /** Progress percentage (0-100). When set, renders an SVG ring overlay */
    progress?: number
}

// ─── Main Badge component ──────────────────────────────────────────────────────

/**
 * Badge — pill visual primitive.
 * Use via StatusBadge, Chip, or EntityBadge — not directly in features.
 */
export function Badge({
    children,
    icon: Icon,
    intent,
    size,
    tracking,
    shape,
    className,
}: BadgeProps) {
    const iconSize = ICON_SIZES[size ?? 'md']

    return (
        <span className={cn(badgeVariants({ intent, size, tracking, shape }), className)}>
            {Icon && (
                <Icon
                    className={cn(iconSize, 'shrink-0 opacity-80 translate-y-[-0.5px]')}
                />
            )}
            <span className="translate-y-[0.5px]">{children}</span>
        </span>
    )
}

/**
 * Badge.Dot — animated dot + label. For live/real-time status indicators.
 *
 * @example
 * <Badge.Dot intent="success">En línea</Badge.Dot>
 */
Badge.Dot = function BadgeDot({ intent = 'neutral', size = 'md', children, className }: BadgeDotProps) {
    const dotColor: Record<string, string> = {
        neutral:     'bg-muted-foreground',
        info:        'bg-info',
        success:     'bg-success',
        warning:     'bg-warning',
        destructive: 'bg-destructive',
        primary:     'bg-primary',
    }

    return (
        <div className={cn('inline-flex items-center gap-1.5', className)}>
            <div className={cn('h-2 w-2 rounded-full animate-pulse', dotColor[intent ?? 'neutral'])} />
            <span className={cn(
                'font-mono font-black uppercase tracking-tight leading-none translate-y-[0.5px]',
                size === 'xs' || size === 'sm' ? 'text-[10px]' : 'text-[11px] text-muted-foreground',
            )}>
                {children}
            </span>
        </div>
    )
}

/**
 * Badge.Hub — circular icon badge for workflow dashboards.
 * Shows a tooltip on hover.
 *
 * @example
 * <Badge.Hub intent="success" icon={CheckCircle} tooltip="Pagado" />
 */
Badge.Hub = function BadgeHub({ intent = 'neutral', icon: Icon, tooltip, size = 'sm', progress, className }: BadgeHubProps) {
    const colorMap: Record<string, string> = {
        neutral:     'text-muted-foreground bg-muted border-muted-foreground/20',
        info:        'text-info bg-info/10 border-info/20',
        success:     'text-success bg-success/10 border-success/20',
        warning:     'text-warning bg-warning/10 border-warning/20',
        destructive: 'text-destructive bg-destructive/10 border-destructive/20',
        primary:     'text-primary bg-primary/10 border-primary/20',
    }

    const ringColor: Record<string, string> = {
        neutral:     'text-muted-foreground',
        info:        'text-info',
        success:     'text-success',
        warning:     'text-warning',
        destructive: 'text-destructive',
        primary:     'text-primary',
    }

    const hasProgress = progress !== undefined
    const containerSize = size === 'sm' ? 24 : 32
    const strokeWidth = size === 'sm' ? 2.5 : 3
    const radius = (containerSize - strokeWidth) / 2
    const circumference = 2 * Math.PI * radius
    const clamped = Math.min(100, Math.max(0, progress ?? 0))
    const offset = circumference * (1 - clamped / 100)

    const bgStyles = hasProgress
        ? 'text-muted-foreground bg-muted border-muted-foreground/20'
        : colorMap[intent ?? 'neutral']

    const hubEl = (
        <div className={cn(
            'relative inline-flex items-center justify-center rounded-full border transition-all duration-200',
            bgStyles,
            size === 'sm' ? 'w-6 h-6' : 'w-8 h-8',
            className,
        )}>
            <Icon className={size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'} />
            {hasProgress && (
                <svg
                    className="absolute inset-0 w-full h-full -rotate-90"
                    viewBox={`0 0 ${containerSize} ${containerSize}`}
                    aria-hidden="true"
                >
                    <circle
                        cx={containerSize / 2}
                        cy={containerSize / 2}
                        r={radius}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={strokeWidth}
                        strokeDasharray={circumference}
                        strokeDashoffset={offset}
                        strokeLinecap="round"
                        className={cn(
                            'transition-all duration-300',
                            ringColor[intent ?? 'neutral'],
                            clamped === 0 && 'opacity-0',
                        )}
                    />
                </svg>
            )}
        </div>
    )

    if (!tooltip) return hubEl

    return (
        <TooltipProvider delayDuration={0}>
            <Tooltip>
                <TooltipTrigger asChild>{hubEl}</TooltipTrigger>
                <TooltipContent
                    side="top"
                    className="font-heading font-extrabold uppercase text-[10px] tracking-tighter"
                >
                    {tooltip}
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
}

// Export variants for consumers that need to extend (e.g. EntityBadge link styles)
export { badgeVariants }
