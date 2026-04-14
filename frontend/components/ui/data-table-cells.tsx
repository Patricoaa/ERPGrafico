import { Badge } from "@/components/ui/badge"
import { cn, formatCurrency, translateStatus, formatPlainDate, formatDocumentId } from "@/lib/utils"
import { ExternalLink, LucideIcon } from "lucide-react"
import Link from "next/link"
import { ReactNode, HTMLAttributes } from "react"
import type { ColumnDef } from "@tanstack/react-table"

import { MoneyDisplay } from "@/components/shared/MoneyDisplay"
import { useGlobalModals } from "@/components/providers/GlobalModalProvider"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { CropFrame } from "@/components/shared/CropFrame"
import { Button } from "@/components/ui/button"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"

interface BaseCellProps extends HTMLAttributes<HTMLDivElement> {
    children?: ReactNode
}

interface ValueCellProps<T> extends BaseCellProps {
    value: T | null | undefined
}

// --- Text Cells ---

export const DataCell = {
    /** Standard text cell for primary information */
    Text: ({ children, className, ...props }: BaseCellProps) => (
        <div className={cn("font-medium truncate flex justify-center items-center", className)} {...props}>{children}</div>
    ),

    /** Secondary text for categories, descriptions, or subtitles */
    Secondary: ({ children, className, ...props }: BaseCellProps) => (
        <div className={cn("text-xs text-muted-foreground truncate flex justify-center items-center", className)} {...props}>{children}</div>
    ),

    /** Standard text for identifiers (simple font as per request) */
    Code: ({ children, className, ...props }: BaseCellProps) => (
        <div className={cn("text-xs font-mono font-medium text-foreground/90 flex justify-center items-center", className)} {...props}>
            {children || "-"}
        </div>
    ),

    /** Standardized Document ID with prefix and padding */
    DocumentId: ({ type, number, className, ...props }: { type?: string, number: string | number | null | undefined, className?: string }) => (
        <div className={cn("text-sm font-mono font-medium uppercase tracking-wider text-muted-foreground hover:text-primary transition-colors flex justify-center items-center", className)} {...props}>
            {formatDocumentId(type, number)}
        </div>
    ),

    /** Clickable contact/human identifier */
    ContactLink: ({ children, contactId, onClick, className, ...props }: HTMLAttributes<HTMLButtonElement> & { contactId?: number | string, onClick?: (e: React.MouseEvent) => void }) => {
        const { openContact } = useGlobalModals();
        return (
            <div className={cn("flex items-center justify-center w-full group", className)}>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        if (onClick) onClick(e);
                        else if (contactId) openContact(Number(contactId));
                    }}
                    className={cn("flex items-center justify-center gap-1.5 font-medium text-primary hover:underline hover:text-primary/80 transition-colors text-sm")}
                    {...props}
                >
                    <span className="truncate">{children}</span>
                    <ExternalLink className="h-3 w-3 text-primary/50 group-hover:text-primary transition-colors flex-shrink-0" />
                </button>
            </div>
        )
    },

    /** Clickable link, often used for document codes (e.g. NV-123) */
    Link: ({ children, href, onClick, className, external, ...props }: HTMLAttributes<HTMLElement> & { href?: string, onClick?: () => void, external?: boolean }) => {
        if (href) {
            return (
                <div className={cn("flex items-center justify-center w-full", className)}>
                    <Link
                        href={href}
                        target={external ? "_blank" : undefined}
                        className={cn("font-medium text-primary hover:underline hover:text-primary/80 flex items-center gap-1 w-fit")}
                        {...(props as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
                    >
                        {children}
                        {external && <ExternalLink className="h-3 w-3" />}
                    </Link>
                </div>
            )
        }
        return (
            <div className={cn("flex items-center justify-center w-full", className)}>
                <button
                    onClick={onClick}
                    className={cn("font-medium text-primary hover:underline hover:text-primary/80 text-center w-fit")}
                    {...(props as React.ButtonHTMLAttributes<HTMLButtonElement>)}
                >
                    {children}
                </button>
            </div>
        )
    },

    // --- Numeric Cells ---

    /** Right-aligned number with tabular figures */
    Number: ({ value, suffix, prefix, className, decimals = 0, ...props }: ValueCellProps<number | string> & { suffix?: string, prefix?: string, decimals?: number }) => {
        if (value === null || value === undefined) return <div className={cn("flex justify-center items-center text-muted-foreground", className)} {...props}>-</div>
        const num = typeof value === 'string' ? parseFloat(value) : value
        return (
            <div className={cn("flex justify-center items-center font-medium tabular-nums", className)} {...props}>
                {prefix}{num.toLocaleString('es-CL', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })} {suffix && <span className="text-[10px] text-muted-foreground font-normal ml-0.5">{suffix}</span>}
            </div>
        )
    },

    /** Currency formatted cell */
    Currency: ({ value, currency = "CLP", className, digits = 0, ...props }: ValueCellProps<number | string> & { currency?: string, digits?: number }) => {
        return (
            <div className={cn("flex justify-center items-center w-full", className)} {...props}>
                <MoneyDisplay amount={value} currency={currency} digits={digits} />
            </div>
        )
    },

    /** Variance cell that colors red/green based on value */
    Variance: ({ value, currency = "CLP", className, digits = 0, ...props }: ValueCellProps<number> & { currency?: string | boolean, digits?: number }) => {
        return (
            <div className={cn("flex justify-center items-center w-full", className)} {...props}>
                <MoneyDisplay 
                    amount={value} 
                    currency={typeof currency === "string" ? currency : "CLP"} 
                    digits={digits} 
                    showColor={true} 
                />
            </div>
        )
    },

    /**
     * Flow/Polarity number display for stock or accounting movements (e.g. +100, -50).
     * Uses semantic colors from globals.css (text-success, text-destructive, text-muted-foreground)
     */
    NumericFlow: ({ value, unit, className, showSign = true, ...props }: HTMLAttributes<HTMLDivElement> & { value: number | string | null | undefined, unit?: string, showSign?: boolean }) => {
        if (value === null || value === undefined || value === "") return <div className="flex justify-center text-muted-foreground text-xs">-</div>
        
        const numValue = Number(value)
        if (isNaN(numValue)) return <div className="flex justify-center text-muted-foreground text-xs">-</div>
        
        const isPositive = numValue > 0;
        const isNegative = numValue < 0;

        const colorClass = isPositive ? "text-success" : isNegative ? "text-destructive" : "text-muted-foreground";
        const sign = showSign ? (isPositive ? "+" : "") : "";

        return (
            <div className={cn("flex flex-col items-center justify-center group w-full", className)} {...props}>
                <span className={cn(
                    "font-mono font-black text-[14px] tracking-tighter transition-all group-hover:scale-110",
                    colorClass
                )}>
                    {sign}{numValue.toFixed(2)}
                </span>
                {unit && (
                    <span className="text-[8px] font-black uppercase tracking-widest opacity-40 group-hover:opacity-100 text-muted-foreground mt-0.5">
                        {unit}
                    </span>
                )}
            </div>
        )
    },

    /** Progress bar cell */
    Progress: ({ value, max = 100, label, subLabel, className, ...props }: ValueCellProps<number> & { max?: number, label?: string, subLabel?: string }) => {
        const percentage = Math.min(100, Math.max(0, ((value || 0) / max) * 100))
        return (
            <div className={cn("space-y-1 w-full", className)} {...props}>
                {(label || subLabel) && (
                    <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-wider mb-0.5 px-0.5">
                        <span className="text-foreground/80">{label}</span>
                        <span className="text-muted-foreground/60">{subLabel}</span>
                    </div>
                )}
                <div className="w-full bg-secondary/30 rounded-full h-1 overflow-hidden">
                    <div
                        className={cn("h-full transition-all", percentage >= 100 ? "bg-success shadow-[0_0_8px_var(--success)]" : "bg-primary")}
                        style={{ width: `${percentage}%` }}
                    />
                </div>
            </div>
        )
    },

    // --- Date Cells ---

    /** Standard date format */
    Date: ({ value, className, showTime = false, ...props }: ValueCellProps<string | Date> & { showTime?: boolean }) => {
        if (!value) return <div className={cn("text-muted-foreground text-xs flex justify-center items-center", className)} {...props}>-</div>
        return (
            <div className={cn("text-sm text-foreground/80 flex justify-center items-center tabular-nums", className)} {...props}>
                {formatPlainDate(value)}
                {showTime && (() => {
                    const date = new Date(value)
                    return <span className="text-xs text-muted-foreground ml-1">{date.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}</span>
                })()}
            </div>
        )
    },

    // --- Status & Badges ---

    /** Mapped status badge - Internally uses the standardized StatusBadge */
    Status: ({ status, label, map, variant = "subtle", className }: { status: string, label?: string, map?: Record<string, any>, variant?: "default" | "hub" | "dot" | "subtle", className?: string }) => {
        return (
            <div className="flex justify-center items-center w-full">
                <StatusBadge 
                    status={status} 
                    label={label || translateStatus(status)} 
                    variant={variant}
                    className={className}
                />
            </div>
        )
    },

    /** 
     * Industrial Informational Label (formerly Generic Badge)
     * Follows the text-contract for non-state information: minimalist, sharp, and muted.
     */
    Badge: ({ children, variant, className, ...props }: { children: ReactNode, variant?: string, className?: string } & HTMLAttributes<HTMLSpanElement>) => (
        <div className="flex justify-center items-center w-full">
            <span 
                className={cn(
                    "text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-[0.25rem] border border-border bg-muted/50 text-muted-foreground whitespace-nowrap",
                    className
                )} 
                {...props}
            >
                {children}
            </span>
        </div>
    ),

    /** Icon with optional tooltip (wrapper needed in parent for tooltip provider usually, but here just the icon structure) */
    Icon: ({ icon: Icon, className, color, ...props }: { icon: LucideIcon, className?: string, color?: string } & HTMLAttributes<HTMLDivElement>) => (
        <div className={cn("p-1 rounded-full bg-secondary/50 flex flex-col justify-center items-center", className)} {...props}>
            <Icon className={cn("h-3.5 w-3.5", color)} />
        </div>
    ),

    /** 
     * Standardized Row Action 
     * Incorporates CropFrame and a Ghost Button.
     * - hover:bg-transparent overrides ghost default accent fill; CropFrame is the sole hover feedback.
     * - Tooltip uses the dark sidebar palette for visual consistency.
     * Enforces rounded-none for Industrial Premium compliance.
     */
    Action: ({ 
        icon: Icon, 
        onClick, 
        title, 
        className, 
        color, 
        variant = "ghost", 
        compact = false, // New prop
        ...props 
    }: { 
        icon: any, 
        onClick?: (e: React.MouseEvent) => void, 
        title?: string, 
        className?: string, 
        color?: string, 
        variant?: any,
        compact?: boolean
    } & HTMLAttributes<HTMLButtonElement>) => (
        <TooltipProvider delayDuration={400}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <div className="flex justify-center items-center">
                        <CropFrame variant={compact ? "compact" : "default"} thickness={1}>
                            <Button
                                variant={variant}
                                size="icon"
                                className={cn("h-7 w-7 rounded-none transition-all duration-300 hover:bg-transparent hover:scale-105 active:scale-95", className)}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onClick?.(e);
                                }}
                                {...props}
                            >
                                <Icon className={cn("h-4 w-4", color)} />
                            </Button>
                        </CropFrame>
                    </div>
                </TooltipTrigger>
                {title && (
                    <TooltipContent 
                        side="top" 
                        className="text-[9px] font-black uppercase tracking-[0.2em] bg-sidebar text-sidebar-foreground border-sidebar-border px-2 py-1 shadow-xl rounded-none animate-in fade-in zoom-in-95 duration-200"
                    >
                        {title}
                    </TooltipContent>
                )}
            </Tooltip>
        </TooltipProvider>
    ),

    /** Container for multiple row actions to ensure proper spacing and alignment */
    ActionGroup: ({ children, className, ...props }: { children: ReactNode, className?: string } & HTMLAttributes<HTMLDivElement>) => (
        <div className={cn("flex justify-center items-center gap-1.5", className)} onClick={(e) => e.stopPropagation()} {...props}>
            {children}
        </div>
    )
}

// ─── Reusable Actions Column Factory ──────────────────────────────────────────
// Generates a standardized actions column for DataTable.
// Tables only provide a renderActions function; all boilerplate is encapsulated.
// ──────────────────────────────────────────────────────────────────────────────

interface ActionsColumnConfig<TData> {
    /** Function receiving the row data, must return DataCell.Action elements */
    renderActions: (item: TData) => ReactNode
    /** Override the column header label. Default: "Acciones" */
    headerLabel?: string
}

/**
 * createActionsColumn — Standard factory for the actions column.
 * 
 * @contract component-contracts.md §14
 * 
 * Usage:
 * ```tsx
 * const columns = [
 *   // ...data columns,
 *   createActionsColumn<Product>({
 *     renderActions: (item) => (
 *       <>
 *         <DataCell.Action icon={Pencil} title="Editar" onClick={() => edit(item)} />
 *         <DataCell.Action icon={Trash2} title="Eliminar" onClick={() => del(item)} />
 *       </>
 *     ),
 *   }),
 * ]
 * ```
 */
export function createActionsColumn<TData>({
    renderActions,
    headerLabel = "Acciones",
}: ActionsColumnConfig<TData>): ColumnDef<TData, unknown> {
    return {
        id: "actions",
        header: () => (
            <div className="text-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                {headerLabel}
            </div>
        ),
        cell: ({ row }) => (
            <DataCell.ActionGroup>
                {renderActions(row.original)}
            </DataCell.ActionGroup>
        ),
        enableSorting: false,
        enableHiding: false,
    }
}
