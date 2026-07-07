
import { cn, translateStatus, formatPlainDate, parseDateOnly } from "@/lib/utils"
import { ExternalLink, type LucideIcon, MoreVertical } from "lucide-react"
import Link from "next/link"
import { type ReactNode, type HTMLAttributes } from "react"
import type { ColumnDef, Row } from "@tanstack/react-table"

import { MoneyDisplay, StatusBadge, EntityBadge, Chip as ChipComponent, DataTableColumnHeader } from "@/components/shared"
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

/** Maps snake_case type identifiers to ENTITY_REGISTRY labels. */
const TYPE_TO_LABEL: Record<string, string> = {
  sale_order: 'sales.saleorder',
  purchase_order: 'purchasing.purchaseorder',
  invoice: 'billing.invoice',
  sale_delivery: 'sales.saledelivery',
  sale_return: 'sales.salereturn',
  purchase_receipt: 'purchasing.purchasereceipt',
  purchase_return: 'purchasing.purchasereturn',
  stock_move: 'inventory.stockmove',
  inventory: 'inventory.stockmove',
  cash_movement: 'treasury.treasurymovement',
  bank_statement: 'treasury.bankstatement',
  bank_loan: 'treasury.bankloan',
  credit_line: 'treasury.creditline',
  check: 'treasury.check',
  credit_card_statement: 'treasury.creditcardstatement',
  terminal_batch: 'treasury.terminalbatch',
  treasury_account: 'treasury.treasuryaccount',
  terminal: 'treasury.terminal',
  terminal_provider: 'treasury.terminalprovider',
  terminal_device: 'treasury.terminaldevice',
  work_order: 'production.workorder',
  payment: 'treasury.treasurymovement',
  journal_entry: 'accounting.journalentry',
  pos_session: 'pos.session',
  f29_declaration: 'tax.f29declaration',
  accounting_period: 'tax.accountingperiod',
  category: 'inventory.category',
  uom: 'inventory.uom',
  pricing_rule: 'inventory.pricingrule',
  partner_transaction: 'contacts.partnertransaction',
};

function findEntityLabel(type: string): string | undefined {
  return TYPE_TO_LABEL[type];
}

// --- Text Cells ---

export const DataCell = {
    /**
     * Texto primario: Todo texto que no encaje en las definiciones restantes
     * (identificadores, fechas, números, badges, etc.). Es el contenedor de texto principal por defecto.
     */
    Text: ({ children, className, ...props }: BaseCellProps) => (
        <div className={cn("flex justify-center items-center text-center w-full text-sm font-medium text-foreground", className)} {...props}>{children}</div>
    ),

    /**
     * Texto secundario: Todo dato complementario que se muestre junto a o debajo de un texto primario,
     * entidad, contacto, moneda, estado, metadato, etc., aportando contexto adicional (ej. categorías, notas, descripciones secundarias).
     */
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
    Entity: ({ entityLabel, type, number, label, data, className, size = "sm", ...props }: { entityLabel?: string, type?: string, number?: string | number | null | undefined, label?: string, data?: object, className?: string, size?: 'sm' | 'md' | 'lg' | 'xl' }) => {
        // Resolve label: prefer entityLabel > label > legacy type mapping (see entity-registry.ts)
        const resolvedLabel = entityLabel || label || (type ? findEntityLabel(type) : undefined);

        const finalData: Record<string, unknown> = (data as Record<string, unknown>) || { id: number, number, display_id: number };

        return (
            <div className={cn("flex justify-center items-center w-full", className)} {...props}>
                <EntityBadge label={resolvedLabel || 'sales.saleorder'} data={finalData} size={size} />
            </div>
        );
    },

    /** Clickable contact/human identifier */
    ContactLink: ({ children, contactId, onClick, className, ...props }: HTMLAttributes<HTMLButtonElement> & { contactId?: number | string, onClick?: (e: React.MouseEvent) => void }) => {
        const { openEntity } = useGlobalModals();
        return (
            <div className={cn("flex justify-center items-center w-full group", className)}>
                <Button
                    onClick={(e) => {
                        e.stopPropagation();
                        if (onClick) onClick(e);
                        else if (contactId) openEntity('contacts.contact', Number(contactId));
                    }}
                    className={cn("flex justify-center items-center gap-1.5 text-sm font-bold hover:underline hover:text-primary/80 transition-colors text-foreground")}
                    {...props}
                >
                    <span className="truncate">{children}</span>
                    <ExternalLink className="h-3 w-3 text-primary/50 group-hover:text-primary transition-colors flex-shrink-0" />
                </Button>
            </div>
        )
    },

    /** Clickable link, often used for document codes (e.g. NV-123) */
    Link: ({ children, href, onClick, className, external, ...props }: HTMLAttributes<HTMLElement> & { href?: string, onClick?: () => void, external?: boolean }) => {
        if (href) {
            return (
                <div className={cn("text-xs font-mono font-medium text-foreground/90 flex justify-center items-center", className)}>
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
                <Button
                    onClick={onClick}
                    className={cn("text-xs font-mono font-medium text-foreground/90 flex justify-center items-center hover:underline hover:text-primary/80 text-center w-fit")}
                    {...(props as React.ButtonHTMLAttributes<HTMLButtonElement>)}
                >
                    {children}
                </Button>
            </div>
        )
    },

    // --- Numeric Cells ---

    /** Right-aligned number with tabular figures */
    Number: ({ value, suffix, prefix, className, decimals = 0, ...props }: ValueCellProps<number | string> & { suffix?: string, prefix?: string, decimals?: number }) => {
        if (value === null || value === undefined) return <div className={cn("text-xs font-medium tabular-nums text-foreground flex justify-center items-center", className)} {...props}>-</div>
        const num = typeof value === 'string' ? parseFloat(value) : value
        return (
            <div className={cn("text-xs font-medium tabular-nums text-foreground flex justify-center items-center", className)} {...props}>
                {prefix}{num.toLocaleString('es-CL', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })} {suffix && <span className="text-xs font-medium text-foreground flex justify-center items-center">{suffix}</span>}
            </div>
        )
    },

    /** Currency formatted cell. Pass `showColor` to color red/green based on sign (variance use case). */
    Currency: ({ value, currency = "CLP", className, digits = 0, showColor = false, showZeroAsDash = false, ...props }: ValueCellProps<number | string> & { currency?: string, digits?: number, showColor?: boolean, showZeroAsDash?: boolean }) => {
        return (
            <div className={cn("text-xs font-medium text-foreground flex justify-center items-center w-full", className)} {...props}>
                <MoneyDisplay amount={value} currency={currency} digits={digits} showColor={showColor} showZeroAsDash={showZeroAsDash} />
            </div>
        )
    },

    Variance: ({ value, currency = "CLP", className, digits = 0, ...props }: ValueCellProps<number> & { currency?: string, digits?: number }) => {
        return (
            <div className={cn("text-xs font-medium text-foreground flex justify-center items-center", className)} {...props}>
                <MoneyDisplay amount={value} currency={currency} digits={digits} showColor={true} />
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
        if (isNaN(numValue)) return <div className="text-xs font-medium text-foreground flex justify-center items-center">-</div>

        const isPositive = numValue > 0;
        const isNegative = numValue < 0;

        const colorClass = isPositive ? "text-income" : isNegative ? "text-expense" : "text-muted-foreground";
        const sign = showSign ? (isPositive ? "+" : "") : "";

        return (
            <div className={cn("text-xs font-medium tabular-nums text-foreground flex justify-center items-center", className)} {...props}>
                <span className={cn(
                    "text-xs font-medium tabular-nums flex justify-center items-center",
                    colorClass
                )}>
                    {sign}{Math.abs(numValue).toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </span>
                {unit && (
                    <span className="text-xs text-muted-foreground mt-0.5 ml-1">
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
        if (!value) return <div className={cn("flex justify-center items-center w-full text-[12px] text-muted-foreground/50", className)} {...props}>-</div>
        return (
            <div className={cn("flex justify-center items-center w-full text-sm font-medium text-foreground whitespace-nowrap", className)} {...props}>
                {formatPlainDate(value)}
                {showTime && (() => {
                    const date = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
                        ? parseDateOnly(value)
                        : new Date(value)
                    return <span className="text-[11px] text-muted-foreground/60 ml-1.5">{date.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}</span>
                })()}
            </div>
        )
    },

    // --- Status & Badges ---

    /** Mapped status badge - Internally uses the standardized StatusBadge */
    Status: ({ status, label, variant = "default", className }: { status: string, label?: string, variant?: "default" | "hub" | "dot", className?: string }) => {
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

    /** Chip for intent-based labels within table cells (wraps shared Chip component) */
    Chip: ({ children, intent = "neutral", size = "xs", className, ...props }: { children: ReactNode, intent?: "neutral" | "primary" | "success" | "warning" | "destructive" | "info", size?: "xs" | "sm" | "md", className?: string } & HTMLAttributes<HTMLDivElement>) => (
        <div className={cn("flex justify-center items-center w-full", className)} {...props}>
            <ChipComponent intent={intent} size={size}>{children}</ChipComponent>
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
     * Ghost Button with hover feedback.
     * - hover:bg-transparent overrides ghost default accent fill.
     * - Tooltip uses the dark sidebar palette for visual consistency.
     * Tooltip uses rounded-sm (atomic), DropdownMenuContent uses rounded-lg (overlay).
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
        ...props
    }: {
        action?: RowActionKey,
        icon?: LucideIcon,
        onClick?: (e: React.MouseEvent) => void,
        title?: string,
        className?: string,
        color?: string,
        variant?: "ghost" | "outline" | "default" | "secondary",
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
                        <TooltipContent side="top" className="text-[9px] font-black uppercase tracking-[0.2em] px-2 py-1 shadow-floating rounded-sm animate-in fade-in zoom-in-95 duration-200">
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
    }: {
        items: ActionMenuItem[],
        title?: string,
        className?: string,
        align?: "start" | "center" | "end",
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
                        className="rounded-lg border-sidebar-border min-w-[10rem]"
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
                                    className="text-[11px] font-black uppercase tracking-widest rounded-sm cursor-pointer"
                                >
                                    <Icon className="h-3.5 w-3.5" />
                                    {label}
                                </DropdownMenuItem>
                            )
                        })}
                    </DropdownMenuContent>
                </DropdownMenu>
                <TooltipContent side="top" className="text-[9px] font-black uppercase tracking-[0.2em] px-2 py-1 shadow-floating rounded-sm animate-in fade-in zoom-in-95 duration-200">
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
 * @contract component-row-actions.md §5.1
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

// ─── Standard Column Factories ─────────────────────────────────────────────────
// Eliminate the 5-line `header: ({column}) => <DataTableColumnHeader ...>` + cell
// boilerplate that repeats identically across every DataTable definition.
// ───────────────────────────────────────────────────────────────────────────────

interface ColOpts<TData> {
    /** Override the default cell renderer */
    cell?: (row: TData) => ReactNode
    /** Additional class for the header wrapper */
    headerClassName?: string
    /** Disable column sorting (default: true) */
    enableSorting?: boolean
}

/** Cell content renderer — returns only the inner content, not the DataCell.* wrapper. */
type CellContent<TData> = (row: TData) => ReactNode

/**
 * Creates a Code/identifier column.
 * Default cell: `<DataCell.Code>{row.getValue(accessorKey)}</DataCell.Code>`
 * Pass `render` to provide custom inner content while keeping the DataCell.Code wrapper.
 */
export function createCodeColumn<TData>(
    accessorKey: string,
    title: string,
    opts?: ColOpts<TData> & { render?: CellContent<TData> }
): ColumnDef<TData> {
    return {
        accessorKey,
        header: ({ column }) => <DataTableColumnHeader column={column} title={title} className={cn("justify-center", opts?.headerClassName)} />,
        cell: ({ row }) => (
            <DataCell.Code>
                {opts?.render ? opts.render(row.original) : ((row.getValue(accessorKey) as string) ?? "-")}
            </DataCell.Code>
        ),
        enableSorting: opts?.enableSorting ?? true,
    }
}

/**
 * Creates a Date column.
 * Default cell: `<DataCell.Date value={row.getValue(accessorKey)} />`
 * Pass `{ showTime: true }` to display hours/minutes.
 */
export function createDateColumn<TData>(
    accessorKey: string,
    title: string,
    opts?: ColOpts<TData> & { showTime?: boolean }
): ColumnDef<TData> {
    return {
        accessorKey,
        header: ({ column }) => <DataTableColumnHeader column={column} title={title} className={cn("justify-center", opts?.headerClassName)} />,
        cell: ({ row }) => <DataCell.Date value={row.getValue(accessorKey) as string | Date} showTime={opts?.showTime} />,
        enableSorting: opts?.enableSorting ?? true,
    }
}

/**
 * Creates a Currency column.
 * Default cell: `<DataCell.Currency value={row.getValue(accessorKey)} />`
 */
export function createCurrencyColumn<TData>(
    accessorKey: string,
    title: string,
    opts?: ColOpts<TData> & { digits?: number }
): ColumnDef<TData> {
    return {
        accessorKey,
        header: ({ column }) => <DataTableColumnHeader column={column} title={title} className={cn("justify-center", opts?.headerClassName)} />,
        cell: ({ row }) => <DataCell.Currency value={row.getValue(accessorKey) as number | string} digits={opts?.digits} />,
        enableSorting: opts?.enableSorting ?? true,
    }
}

/**
 * Creates a Secondary text column.
 * Default cell: `<DataCell.Secondary>{row.getValue(accessorKey)}</DataCell.Secondary>`
 */
export function createSecondaryColumn<TData>(
    accessorKey: string,
    title: string,
    opts?: ColOpts<TData>
): ColumnDef<TData> {
    return {
        accessorKey,
        header: ({ column }) => <DataTableColumnHeader column={column} title={title} className={cn("justify-center", opts?.headerClassName)} />,
        cell: ({ row }) => <DataCell.Secondary>{(row.getValue(accessorKey) as string) ?? "-"}</DataCell.Secondary>,
        enableSorting: opts?.enableSorting ?? true,
    }
}

/**
 * Creates a Contact link column.
 * Default cell: `<DataCell.ContactLink contactId={row.original[contactIdAccessor]}>{row.getValue(accessorKey)}</DataCell.ContactLink>`
 * @param contactIdAccessor — field on the row data that holds the contact ID (default: "partner")
 */
export function createContactColumn<TData>(
    accessorKey: string,
    title: string,
    contactIdAccessor?: string,
    opts?: ColOpts<TData>
): ColumnDef<TData> {
    const idField = contactIdAccessor ?? "partner"
    return {
        accessorKey,
        header: ({ column }) => <DataTableColumnHeader column={column} title={title} className={cn("justify-center", opts?.headerClassName)} />,
        cell: ({ row }) => {
            const original = row.original as Record<string, unknown>
            return <DataCell.ContactLink contactId={original[idField] as number | undefined}>{row.getValue(accessorKey) as string}</DataCell.ContactLink>
        },
        enableSorting: opts?.enableSorting ?? true,
    }
}

/**
 * Creates a Status badge column.
 * Default cell: `<DataCell.Status status={row.getValue(accessorKey)} />`
 * Use `opts.variant` for dot/hub variants, `opts.label` to override display text.
 */
export function createStatusColumn<TData>(
    accessorKey: string,
    title: string,
    opts?: ColOpts<TData> & { variant?: "default" | "hub" | "dot"; label?: string }
): ColumnDef<TData> {
    return {
        accessorKey,
        header: ({ column }) => <DataTableColumnHeader column={column} title={title} className={cn("justify-center", opts?.headerClassName)} />,
        cell: ({ row }) => <DataCell.Status status={row.getValue(accessorKey) as string} variant={opts?.variant} label={opts?.label} />,
        enableSorting: opts?.enableSorting ?? true,
    }
}
