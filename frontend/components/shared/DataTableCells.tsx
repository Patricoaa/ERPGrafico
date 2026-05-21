
import { cn, translateStatus, formatPlainDate } from "@/lib/utils"
import { ExternalLink, LucideIcon, MoreVertical } from "lucide-react"
import Link from "next/link"
import { ReactNode, HTMLAttributes } from "react"
import type { ColumnDef } from "@tanstack/react-table"

import { MoneyDisplay, StatusBadge, EntityBadge } from "@/components/shared"
import { useGlobalModals } from "@/components/providers/GlobalModalProvider"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { ROW_ACTIONS, type RowActionKey } from "@/lib/row-actions"

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
        <div className={cn("flex justify-center items-center text-center w-full text-[13px] font-bold text-foreground", className)} {...props}>{children}</div>
    ),

    /** Secondary text for categories, descriptions, or subtitles */
    Secondary: ({ children, className, ...props }: BaseCellProps) => (
        <div className={cn("flex justify-center items-center text-center w-full text-[11px] font-medium text-muted-foreground uppercase tracking-wider", className)} {...props}>{children}</div>
    ),

    /** Standard text for identifiers (simple font as per request) */
    Code: ({ children, className, ...props }: BaseCellProps) => (
        <div className={cn("flex justify-center items-center text-center w-full text-[11px] font-mono font-medium text-muted-foreground uppercase tracking-widest", className)} {...props}>
            {children || "-"}
        </div>
    ),

    /** Standardized Entity ID with prefix and padding (Uses EntityBadge, matches Status badge typography/size) */
    Entity: ({ entityLabel, type, number, label, data, className, size = "sm", ...props }: { entityLabel?: string, type?: string, number?: string | number | null | undefined, label?: string, data?: any, className?: string, size?: 'sm' | 'md' | 'lg' | 'xl' }) => {
        // Resolve label: prefer entityLabel > label > legacy type mapping
        let resolvedLabel = entityLabel || label;

        if (!resolvedLabel && type) {
            const TYPE_TO_LABEL: Record<string, string> = {
                'sale_order': 'sales.saleorder',
                'purchase_order': 'purchasing.purchaseorder',
                'invoice': 'billing.invoice',
                'payment': 'treasury.treasurymovement',
                'journal_entry': 'accounting.journalentry',
                'inventory': 'inventory.stockmove',
                'stock_move': 'inventory.stockmove',
                'work_order': 'production.workorder',
                'sale_delivery': 'sales.saledelivery',
                'purchase_receipt': 'inventory.warehouse',
                'sale_return': 'sales.salereturn',
                'purchase_return': 'sales.salereturn',
                'cash_movement': 'treasury.treasurymovement',
                'terminal_batch': 'treasury.treasurymovement',
            };
            resolvedLabel = TYPE_TO_LABEL[type];
        }

        const finalData = data || { id: number, number, display_id: number };

        return (
            <div className={cn("flex justify-center items-center w-full", className)} {...props}>
                <EntityBadge label={resolvedLabel || 'sales.saleorder'} data={finalData} size={size} />
            </div>
        );
    },

    /** Clickable contact/human identifier */
    ContactLink: ({ children, contactId, onClick, className, ...props }: HTMLAttributes<HTMLButtonElement> & { contactId?: number | string, onClick?: (e: React.MouseEvent) => void }) => {
        const { openContact } = useGlobalModals();
        return (
            <div className={cn("flex justify-center items-center w-full group", className)}>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        if (onClick) onClick(e);
                        else if (contactId) openContact(Number(contactId));
                    }}
                    className={cn("flex justify-center items-center gap-1.5 text-[13px] font-bold hover:underline hover:text-primary/80 transition-colors text-foreground")}
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
                <div className={cn("ftext-xs font-mono font-medium text-foreground/90 flex justify-center items-center", className)}>
                    <Link
                        href={href}
                        target={external ? "_blank" : undefined}
                        className={cn("text-xs font-mono font-medium text-foreground/90 flex justify-center items-center hover:underline hover:text-primary/80 flex items-center gap-1 w-fit")}
                        {...(props as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
                    >
                        {children}
                        {external && <ExternalLink className="h-3 w-3" />}
                    </Link>
                </div>
            )
        }
        return (
            <div className={cn("text-xs font-mono font-medium text-foreground/90 flex justify-center items-center", className)}>
                <button
                    onClick={onClick}
                    className={cn("text-xs font-mono font-medium text-foreground/90 flex justify-center items-center hover:underline hover:text-primary/80 text-center w-fit")}
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
        if (value === null || value === undefined) return <div className={cn("text-xs font-mono font-medium text-foreground/90 flex justify-center items-center", className)} {...props}>-</div>
        const num = typeof value === 'string' ? parseFloat(value) : value
        return (
            <div className={cn("text-xs font-mono font-medium text-foreground/90 flex justify-center items-center", className)} {...props}>
                {prefix}{num.toLocaleString('es-CL', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })} {suffix && <span className="text-xs font-mono font-medium text-foreground/90 flex justify-center items-center">{suffix}</span>}
            </div>
        )
    },

    /** Currency formatted cell */
    Currency: ({ value, currency = "CLP", className, digits = 0, ...props }: ValueCellProps<number | string> & { currency?: string, digits?: number }) => {
        return (
            <div className={cn("text-xs font-mono font-medium text-foreground/90 flex justify-center items-center w-full", className)} {...props}>
                <MoneyDisplay amount={value} currency={currency} digits={digits} />
            </div>
        )
    },

    /** Variance cell that colors red/green based on value */
    Variance: ({ value, currency = "CLP", className, digits = 0, ...props }: ValueCellProps<number> & { currency?: string | boolean, digits?: number }) => {
        return (
            <div className={cn("text-xs font-mono font-medium text-foreground/90 flex justify-center items-center", className)} {...props}>
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
        if (isNaN(numValue)) return <div className="text-xs font-mono font-medium text-foreground/90 flex justify-center items-center">-</div>

        const isPositive = numValue > 0;
        const isNegative = numValue < 0;

        const colorClass = isPositive ? "text-success" : isNegative ? "text-destructive" : "text-muted-foreground";
        const sign = showSign ? (isPositive ? "+" : "") : "";

        return (
            <div className={cn("text-xs font-mono font-medium text-foreground/90 flex justify-center items-center", className)} {...props}>
                <span className={cn(
                    "text-xs font-mono font-medium text-foreground/90 flex justify-center items-center-hover:scale-110",
                    colorClass
                )}>
                    {sign}{numValue.toFixed(2)}
                </span>
                {unit && (
                    <span className="text-xs font-mono font-medium text-foreground/90 flex justify-center items-center-hover:opacity-100 text-muted-foreground mt-0.5">
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
        if (!value) return <div className={cn("flex justify-center items-center w-full text-[12px] font-mono text-muted-foreground/50", className)} {...props}>-</div>
        return (
            <div className={cn("flex justify-center items-center w-full text-[12px] font-mono font-medium text-muted-foreground whitespace-nowrap", className)} {...props}>
                {formatPlainDate(value)}
                {showTime && (() => {
                    const date = new Date(value)
                    return <span className="text-[11px] text-muted-foreground/60 ml-1.5">{date.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}</span>
                })()}
            </div>
        )
    },

    // --- Status & Badges ---

    /** Mapped status badge - Internally uses the standardized StatusBadge */
    Status: ({ status, label, map, variant = "default", className }: { status: string, label?: string, map?: Record<string, { label: string, className: string }>, variant?: "default" | "hub" | "dot", className?: string }) => {
        return (
            <div className={cn("flex justify-center items-center w-full", className)}>
                <StatusBadge
                    status={status}
                    label={label || translateStatus(status)}
                    variant={variant}
                    className={className}
                />
            </div>
        )
    },

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
     * Enforces rounded-none for design system compliance.
     *
     * Two forms:
     * - Registry form (preferred): <DataCell.Action action="edit" onClick={...} />
     *   Resolves icon + title + color from ROW_ACTIONS (lib/row-actions.ts).
     * - Inline form (module-specific actions only):
     *   <DataCell.Action icon={Pencil} title="Editar" onClick={...} />
     *
     * @contract docs/20-contracts/component-row-actions.md
     */
    Action: ({
        action,
        icon: iconProp,
        onClick,
        title: titleProp,
        className,
        color,
        variant = "ghost",
        compact = false,
        ...props
    }: {
        action?: RowActionKey,
        icon?: LucideIcon,
        onClick?: (e: React.MouseEvent) => void,
        title?: string,
        className?: string,
        color?: string,
        variant?: "ghost" | "outline" | "default" | "secondary",
        compact?: boolean
    } & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'title'>) => {
        const def = action ? ROW_ACTIONS[action] : undefined
        const Icon = iconProp ?? def?.icon
        const title = titleProp ?? def?.label
        const resolvedColor = color ?? def?.iconColorClass

        if (!Icon) {
            // Misuse: neither `action` nor `icon` provided.
            return null
        }

        return (
            <TooltipProvider delayDuration={400}>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <div className="flex justify-center items-center">
                            <Button
                                variant={variant}
                                size="icon"
                                className={cn("h-7 w-7 rounded-full transition-all duration-200 hover:scale-105 active:scale-95 hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50", className)}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onClick?.(e);
                                }}
                                type={props.type || "button"}
                                {...props}
                            >
                                <Icon className={cn("h-4 w-4", resolvedColor)} />
                            </Button>
                        </div>
                    </TooltipTrigger>
                    {title && (
                        <TooltipContent side="top" className="text-[9px] font-black uppercase tracking-[0.2em] px-2 py-1 shadow-xl rounded-none animate-in fade-in zoom-in-95 duration-200">
                            {title}
                        </TooltipContent>
                    )}
                </Tooltip>
            </TooltipProvider>
        )
    },

    /** Container for multiple row actions to ensure proper spacing and alignment */
    ActionGroup: ({ children, className, ...props }: { children: ReactNode, className?: string } & HTMLAttributes<HTMLDivElement>) => (
        <div className={cn("flex justify-center items-center gap-1.5", className)} onClick={(e) => e.stopPropagation()} {...props}>
            {children}
        </div>
    ),

    /**
     * Overflow / kebab menu for row & card actions.
     *
     * Use when the row has 4+ actions, or when secondary/destructive actions
     * should be one tap away rather than always visible.
     *
     * Items can be:
     *  - Registry actions:    { action: "duplicate", onClick }
     *  - Module-specific:     { icon: Recalc, label: "Recalcular", onClick }
     *  - Separators:          { separator: true }
     *
     * @contract docs/20-contracts/component-row-actions.md §4
     */
    ActionMenu: ({
        items,
        title = "Más acciones",
        className,
        align = "end",
        compact = false,
    }: {
        items: ActionMenuItem[],
        title?: string,
        className?: string,
        align?: "start" | "center" | "end",
        compact?: boolean,
    }) => (
        <TooltipProvider delayDuration={400}>
            <Tooltip>
                <DropdownMenu>
                    <TooltipTrigger asChild>
                        <DropdownMenuTrigger asChild>
                            <div className="flex justify-center items-center">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className={cn("h-7 w-7 rounded-md transition-all duration-200 hover:scale-105 active:scale-95", className)}
                                    onClick={(e) => e.stopPropagation()}
                                    aria-label={title}
                                >
                                    <MoreVertical className="h-4 w-4" />
                                </Button>
                            </div>
                        </DropdownMenuTrigger>
                    </TooltipTrigger>
                    <DropdownMenuContent
                        align={align}
                        className="rounded-none border-sidebar-border min-w-[10rem]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {items.map((item, idx) => {
                            if ('separator' in item && item.separator) {
                                return <DropdownMenuSeparator key={`sep-${idx}`} />
                            }
                            const def = 'action' in item && item.action ? ROW_ACTIONS[item.action] : undefined
                            const Icon = ('icon' in item && item.icon) ? item.icon : def?.icon
                            const label = ('label' in item && item.label) ? item.label : def?.label
                            const isDestructive = ('action' in item && item.action === 'delete') || def?.intent === 'destructive'

                            if (!Icon || !label) return null

                            return (
                                <DropdownMenuItem
                                    key={('action' in item && item.action) ? item.action : idx}
                                    variant={isDestructive ? 'destructive' : 'default'}
                                    disabled={'disabled' in item ? item.disabled : false}
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        if ('onClick' in item && item.onClick) item.onClick(e as unknown as React.MouseEvent)
                                    }}
                                    className="text-[11px] font-medium uppercase tracking-wider rounded-none cursor-pointer"
                                >
                                    <Icon className="h-3.5 w-3.5" />
                                    {label}
                                </DropdownMenuItem>
                            )
                        })}
                    </DropdownMenuContent>
                </DropdownMenu>
                <TooltipContent side="top" className="text-[9px] font-black uppercase tracking-[0.2em] px-2 py-1 shadow-xl rounded-none animate-in fade-in zoom-in-95 duration-200">
                    {title}
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    ),
}

// ─── ActionMenu item types ────────────────────────────────────────────────────

export type ActionMenuItem =
    | { separator: true }
    | {
        action: RowActionKey
        onClick: (e: React.MouseEvent) => void
        disabled?: boolean
        /** Override label from registry */
        label?: string
        /** Override icon from registry */
        icon?: LucideIcon
    }
    | {
        icon: LucideIcon
        label: string
        onClick: (e: React.MouseEvent) => void
        disabled?: boolean
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
            <div className="text-center text-[10px] font-black uppercase tracking-widest text-muted-foreground">
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
