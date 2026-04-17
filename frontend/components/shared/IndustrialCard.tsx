
import React from "react"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { CARD_TOKENS } from "@/lib/styles"
import { IndustryMark } from "./IndustryMark"
import { LucideIcon } from "lucide-react"

// ─────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────

type IndustrialCardVariant = "standard" | "industrial" | "glass" | "list" | "elevated"

interface IndustrialCardProps extends React.ComponentProps<typeof Card> {
    variant?: IndustrialCardVariant
    /** Hide default IndustryMark crop marks */
    hideCropMarks?: boolean
}

interface IndustrialCardHeaderProps {
    title: string
    description?: string
    icon?: LucideIcon
    actions?: React.ReactNode
    className?: string
}

interface IndustrialCardBodyProps {
    children: React.ReactNode
    className?: string
    /** Remove default padding */
    flush?: boolean
}

interface IndustrialCardFooterProps {
    children: React.ReactNode
    className?: string
    /** Align footer content: 'start' | 'end' | 'between' */
    align?: "start" | "end" | "between"
}

// ─────────────────────────────────────────────────────────
// ELEVATED VARIANT TOKEN (extends CARD_TOKENS)
// ─────────────────────────────────────────────────────────

const ELEVATED_TOKEN = "shadow-[var(--shadow-elevated)] border-none ring-1 ring-primary/15 bg-card"

// ─────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────

function IndustrialCardHeader({
    title,
    description,
    icon: Icon,
    actions,
    className,
}: IndustrialCardHeaderProps) {
    return (
        <div className={cn(
            "flex items-start justify-between gap-4 px-6 pt-5 pb-3",
            className
        )}>
            <div className="flex items-center gap-3 min-w-0">
                {Icon && (
                    <div className="p-2 bg-primary/10 text-primary shrink-0">
                        <Icon className="h-4 w-4" />
                    </div>
                )}
                <div className="flex flex-col min-w-0">
                    <h3 className="text-sm font-heading font-black uppercase tracking-tight text-foreground truncate">
                        {title}
                    </h3>
                    {description && (
                        <p className="text-[10px] text-muted-foreground font-medium mt-0.5 leading-snug">
                            {description}
                        </p>
                    )}
                </div>
            </div>
            {actions && (
                <div className="flex items-center gap-2 shrink-0">
                    {actions}
                </div>
            )}
        </div>
    )
}

function IndustrialCardBody({
    children,
    className,
    flush = false,
}: IndustrialCardBodyProps) {
    return (
        <div className={cn(
            !flush && "px-6 py-4",
            className
        )}>
            {children}
        </div>
    )
}

function IndustrialCardFooter({
    children,
    className,
    align = "end",
}: IndustrialCardFooterProps) {
    return (
        <div className={cn(
            "px-6 py-4 border-t border-border/40",
            "flex items-center gap-3",
            align === "start" && "justify-start",
            align === "end" && "justify-end",
            align === "between" && "justify-between",
            className
        )}>
            {children}
        </div>
    )
}

// ─────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────

/**
 * IndustrialCard
 * 
 * A standardized card component that implements the project's "Industrial Premium" aesthetic.
 * Supports composable sub-components for consistent anatomy:
 * 
 * ```tsx
 * <IndustrialCard variant="industrial">
 *   <IndustrialCard.Header title="Resumen" icon={BarChart3} />
 *   <IndustrialCard.Body>
 *     {children}
 *   </IndustrialCard.Body>
 *   <IndustrialCard.Footer>
 *     <ActionSlideButton>Guardar</ActionSlideButton>
 *   </IndustrialCard.Footer>
 * </IndustrialCard>
 * ```
 * 
 * Variants:
 * - `standard` — Dashed border, subtle background. For low-emphasis containers.
 * - `industrial` — Primary top-strip, ring border, heavy shadow. Default.
 * - `elevated` — Primary ring glow, elevated shadow. For KPI cards and highlights.
 * - `glass` — Glassmorphism. For overlays on dark backgrounds.
 * - `list` — Hover-interactive row card. For clickable list items.
 */
export function IndustrialCard({ 
    variant = "industrial", 
    hideCropMarks = false,
    className, 
    children, 
    ...props 
}: IndustrialCardProps) {
    const variantClass = variant === "elevated" 
        ? ELEVATED_TOKEN 
        : CARD_TOKENS[variant]
    
    return (
        <Card 
            className={cn(CARD_TOKENS.container, "relative overflow-visible", variantClass, className)} 
            {...props}
        >
            {!hideCropMarks && <IndustryMark variant="crop" />}
            {children}
        </Card>
    )
}

// Attach sub-components for composable API
IndustrialCard.Header = IndustrialCardHeader
IndustrialCard.Body = IndustrialCardBody
IndustrialCard.Footer = IndustrialCardFooter
