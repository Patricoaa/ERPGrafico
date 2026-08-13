
import { cn, formatPlainDate, parseDateOnly } from "@/lib/utils"
import { ArrowRight, ArrowUpRight, ArrowDownLeft, History, ExternalLink, User, type LucideIcon, MoreVertical, ChevronDown, ChevronRight } from "lucide-react"
import Link from "next/link"
import { type ReactNode, type HTMLAttributes } from "react"
import type { ColumnDef } from "@tanstack/react-table"

import { MoneyDisplay, WEIGHT_MAP, type DataCellWeight } from "./MoneyDisplay"

export type { DataCellWeight } from "./MoneyDisplay"
import type { CategoryDomain } from "@/lib/badge-resolvers"
import { StatusBadge } from "./StatusBadge"
import { EntityBadge } from "./EntityBadge"
import { Chip as ChipComponent } from "./Chip"
import { DataTableColumnHeader } from "./DataTableColumnHeader"
import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/lib/money"
import { useGlobalModals } from "@/components/providers/GlobalModalProvider"
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

// ─── DataCell style token maps ───────────────────────────────────────────────

export type DataCellSize = 'xs' | 'sm' | 'md' | 'lg'
export type DataCellIntent = 'default' | 'primary' | 'success' | 'warning' | 'destructive' | 'info' | 'muted'
type DataCellTextTransform = 'uppercase' | 'lowercase' | 'capitalize' | 'none'
type DataCellLetterSpacing = 'tighter' | 'tight' | 'normal' | 'wide' | 'wider' | 'widest'

const SIZE_MAP: Record<DataCellSize, string> = {
    xs: 'text-xs',
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
}

const INTENT_MAP: Record<DataCellIntent, string> = {
    default: 'text-foreground',
    primary: 'text-primary',
    success: 'text-success',
    warning: 'text-warning',
    destructive: 'text-destructive',
    info: 'text-info',
    muted: 'text-muted-foreground',
}

const TEXT_TRANSFORM_MAP: Record<DataCellTextTransform, string> = {
    uppercase: 'uppercase',
    lowercase: 'lowercase',
    capitalize: 'capitalize',
    none: '',
}

const LETTER_SPACING_MAP: Record<DataCellLetterSpacing, string> = {
    tighter: 'tracking-tighter',
    tight: 'tracking-tight',
    normal: 'tracking-normal',
    wide: 'tracking-wide',
    wider: 'tracking-wider',
    widest: 'tracking-widest',
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
    Text: ({ children, className, size, intent, weight, uppercase, color, textTransform, letterSpacing, ...props }: BaseCellProps & { size?: DataCellSize, intent?: DataCellIntent, weight?: DataCellWeight, uppercase?: boolean, color?: string, textTransform?: DataCellTextTransform, letterSpacing?: DataCellLetterSpacing }) => (
        <div className={cn("flex justify-center items-center text-center w-full text-xs font-sans font-medium text-foreground", size && SIZE_MAP[size], intent && INTENT_MAP[intent], weight && WEIGHT_MAP[weight], uppercase && "uppercase tracking-tight", color, textTransform && TEXT_TRANSFORM_MAP[textTransform], letterSpacing && LETTER_SPACING_MAP[letterSpacing], className)} {...props}>{children}</div>
    ),

    /**
     * Texto secundario: Todo dato complementario que se muestre junto a o debajo de un texto primario,
     * entidad, contacto, moneda, estado, metadato, etc., aportando contexto adicional (ej. categorías, notas, descripciones secundarias).
     */
    Secondary: ({ children, className, size, intent, weight, color, textTransform, letterSpacing, ...props }: BaseCellProps & { size?: DataCellSize, intent?: DataCellIntent, weight?: DataCellWeight, color?: string, textTransform?: DataCellTextTransform, letterSpacing?: DataCellLetterSpacing }) => (
        <div className={cn("flex justify-center items-center text-center w-full text-xs font-sans font-medium text-muted-foreground tracking-tight", size && SIZE_MAP[size], intent && INTENT_MAP[intent], weight && WEIGHT_MAP[weight], color, textTransform && TEXT_TRANSFORM_MAP[textTransform], letterSpacing && LETTER_SPACING_MAP[letterSpacing], className)} {...props}>{children}</div>
    ),

    /** Standard text for identifiers (simple font as per request) */
    Code: ({ children, className, size, intent, weight, color, textTransform, letterSpacing, ...props }: BaseCellProps & { size?: DataCellSize, intent?: DataCellIntent, weight?: DataCellWeight, color?: string, textTransform?: DataCellTextTransform, letterSpacing?: DataCellLetterSpacing }) => (
        <div className={cn("flex justify-center items-center text-center w-full text-xs font-sans font-medium text-foreground uppercase tracking-tight", size && SIZE_MAP[size], intent && INTENT_MAP[intent], weight && WEIGHT_MAP[weight], color, textTransform && TEXT_TRANSFORM_MAP[textTransform], letterSpacing && LETTER_SPACING_MAP[letterSpacing], className)} {...props}>
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
                    variant="ghost"
                    onClick={(e) => {
                        e.stopPropagation();
                        if (onClick) onClick(e);
                        else if (contactId) openEntity('contacts.contact', Number(contactId));
                    }}
                    className={cn("flex justify-center items-center gap-1.5 text-xs font-sans font-medium hover:underline hover:text-cyan transition-colors text-foreground h-auto p-0 border-none bg-transparent hover:bg-transparent shadow-none")}
                    {...props}
                >
                    <User className="h-3 w-3 text-cyan/50 group-hover:text-cyan transition-colors flex-shrink-0" />
                    <span className="truncate">{children}</span>
                </Button>
            </div>
        )
    },

    /** Clickable link, often used for document codes (e.g. OV-123) */
    Link: ({ children, href, onClick, className, external, ...props }: HTMLAttributes<HTMLElement> & { href?: string, onClick?: () => void, external?: boolean }) => {
        if (href) {
            return (
                <div className={cn("text-xs font-sans font-medium text-foreground/90 flex justify-center items-center text-center", className)}>
                    <Link
                        href={href}
                        target={external ? "_blank" : undefined}
                        className={cn("text-xs font-sans font-medium text-foreground/90 flex justify-center items-center text-center hover:underline hover:text-cyan flex items-center gap-1 w-fit")}
                        {...(props as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
                    >
                        {children}
                        {external && <ExternalLink className="h-3 w-3" />}
                    </Link>
                </div>
            )
        }
        return (
                <div className={cn("text-xs font-sans font-medium text-foreground/90 flex justify-center items-center text-center", className)}>
                <Button
                    variant="ghost"
                    onClick={onClick}
                    className={cn("text-xs font-sans font-medium text-foreground/90 flex justify-center items-center text-center hover:underline hover:text-cyan text-center w-fit h-auto p-0 border-none bg-transparent hover:bg-transparent shadow-none", className)}
                    {...(props as React.ButtonHTMLAttributes<HTMLButtonElement>)}
                >
                    {children}
                </Button>
            </div>
        )
    },

    // --- Numeric Cells ---

    /** Right-aligned number */
    Number: ({ value, suffix, prefix, className, decimals = 0, suffixGap = true, size, intent, weight, color, textTransform, letterSpacing, ...props }: ValueCellProps<number | string> & { suffix?: string, prefix?: string, decimals?: number, suffixGap?: boolean, size?: DataCellSize, intent?: DataCellIntent, weight?: DataCellWeight, color?: string, textTransform?: DataCellTextTransform, letterSpacing?: DataCellLetterSpacing }) => {
        if (value === null || value === undefined) return <div className={cn("text-xs font-sans font-medium text-muted-foreground flex justify-end items-center text-right", size && SIZE_MAP[size], intent && INTENT_MAP[intent], weight && WEIGHT_MAP[weight], color, textTransform && TEXT_TRANSFORM_MAP[textTransform], letterSpacing && LETTER_SPACING_MAP[letterSpacing], className)} {...props}>-</div>
        const num = typeof value === 'string' ? parseFloat(value) : value
        return (
            <div className={cn("text-xs font-sans font-medium text-foreground flex justify-end items-center text-right", size && SIZE_MAP[size], intent && INTENT_MAP[intent], weight && WEIGHT_MAP[weight], color, textTransform && TEXT_TRANSFORM_MAP[textTransform], letterSpacing && LETTER_SPACING_MAP[letterSpacing], className)} {...props}>
                {/* eslint-disable-next-line no-restricted-syntax -- numeric quantity format, not currency; MoneyDisplay not applicable */}
                {prefix}{num.toLocaleString('es-CL', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}{suffix && <span className={cn("text-foreground flex justify-end items-center text-right", suffixGap && "ml-1")}>{suffix}</span>}
            </div>
        )
    },

    /** Currency formatted cell. Pass `showColor` to color red/green based on sign (variance use case). */
    Currency: ({ value, currency = "CLP", className, digits = 0, showColor = false, showZeroAsDash = false, size, intent, weight, interactive, color, textTransform, letterSpacing, tooltip: tooltipContent, ...props }: ValueCellProps<number | string> & { currency?: string, digits?: number, showColor?: boolean, showZeroAsDash?: boolean, size?: DataCellSize, intent?: DataCellIntent, weight?: DataCellWeight, interactive?: boolean, color?: string, textTransform?: DataCellTextTransform, letterSpacing?: DataCellLetterSpacing, tooltip?: ReactNode }) => {
        const cell = (
            <div className={cn("text-xs font-sans font-medium text-foreground flex justify-end items-center text-right w-full", size && SIZE_MAP[size], intent && INTENT_MAP[intent], weight && WEIGHT_MAP[weight], interactive && "cursor-pointer hover:underline", color, textTransform && TEXT_TRANSFORM_MAP[textTransform], letterSpacing && LETTER_SPACING_MAP[letterSpacing], className)} {...props}>
                <MoneyDisplay amount={value} currency={currency} digits={digits} showColor={showColor} showZeroAsDash={showZeroAsDash} weight={weight} />
            </div>
        )

        if (tooltipContent) {
            return (
                <Tooltip>
                    <TooltipTrigger asChild>
                        <div className="flex items-center justify-end w-full cursor-default">
                            {cell}
                        </div>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                        {tooltipContent}
                    </TooltipContent>
                </Tooltip>
            )
        }

        return cell
    },

    /**
     * Currency cell with inflow/outflow semantics.
     * Shows directional icon, sign prefix (+/-), and semantic color.
     * Use for ledgers, movement tables, and transaction histories.
     */
    CurrencyFlow: ({ value, direction, currency = "CLP", digits = 0, showIcon = true, showSign = true, className, size, intent, weight, color, textTransform, letterSpacing, ...props }: ValueCellProps<number | string> & { direction: 'inflow' | 'outflow' | 'neutral', currency?: string, digits?: number, showIcon?: boolean, showSign?: boolean, size?: DataCellSize, intent?: DataCellIntent, weight?: DataCellWeight, color?: string, textTransform?: DataCellTextTransform, letterSpacing?: DataCellLetterSpacing }) => {
        const Icon = direction === 'inflow' ? ArrowUpRight : direction === 'outflow' ? ArrowDownLeft : History
        const iconColor = direction === 'inflow' ? 'text-success' : direction === 'outflow' ? 'text-destructive' : 'text-muted-foreground'
        const badgeColor = direction === 'inflow'
            ? 'bg-success/10 text-success'
            : direction === 'outflow'
                ? 'bg-destructive/10 text-destructive'
                : 'bg-muted/60 text-muted-foreground'
        const sign = showSign ? (direction === 'inflow' ? '+' : direction === 'outflow' ? '-' : '') : ''

        return (
            <div className={cn("flex items-center justify-center gap-1 font-sans text-xs font-medium text-center", size && SIZE_MAP[size], intent && INTENT_MAP[intent], weight && WEIGHT_MAP[weight], color, textTransform && TEXT_TRANSFORM_MAP[textTransform], letterSpacing && LETTER_SPACING_MAP[letterSpacing], className)} {...props}>
                <span className={cn("inline-flex items-center gap-1 rounded-sm px-2 py-0.5 leading-none", badgeColor)}>
                    {showIcon && <Icon className={cn("h-3.5 w-3.5", iconColor)} />}
                    <span>{sign}{formatCurrency(value, currency, { maximumFractionDigits: digits })}</span>
                </span>
            </div>
        )
    },

    Variance: ({ value, currency = "CLP", className, digits = 0, size, intent, weight, color, textTransform, letterSpacing, ...props }: ValueCellProps<number> & { currency?: string, digits?: number, size?: DataCellSize, intent?: DataCellIntent, weight?: DataCellWeight, color?: string, textTransform?: DataCellTextTransform, letterSpacing?: DataCellLetterSpacing }) => {
        return (
            <div className={cn("text-xs font-sans font-medium text-foreground flex justify-end items-center text-right", size && SIZE_MAP[size], intent && INTENT_MAP[intent], weight && WEIGHT_MAP[weight], color, textTransform && TEXT_TRANSFORM_MAP[textTransform], letterSpacing && LETTER_SPACING_MAP[letterSpacing], className)} {...props}>
                <MoneyDisplay amount={value} currency={currency} digits={digits} showColor={true} weight={weight} />
            </div>
        )
    },

    /**
     * Flow/Polarity number display for stock or accounting movements (e.g. +100, -50).
     * Directional icons + semantic colors. Mirrors CurrencyFlow for quantities.
     * When `direction` is omitted, infers from sign (backward compatible).
     */
    NumericFlow: ({ value, unit, uom, direction: dirProp, showIcon = true, showSign = true, className, size, intent, weight, color, textTransform, letterSpacing, ...props }: HTMLAttributes<HTMLDivElement> & { value: number | string | null | undefined, unit?: string, uom?: string, direction?: 'inflow' | 'outflow' | 'neutral', showIcon?: boolean, showSign?: boolean, size?: DataCellSize, intent?: DataCellIntent, weight?: DataCellWeight, color?: string, textTransform?: DataCellTextTransform, letterSpacing?: DataCellLetterSpacing }) => {
        if (value === null || value === undefined || value === "") return <div className="flex justify-center items-center text-center font-medium text-muted-foreground text-xs">-</div>

        const numValue = Number(value)
        if (isNaN(numValue)) return <div className="text-xs font-medium text-foreground flex justify-center items-center text-center">-</div>

        const direction = dirProp ?? (numValue > 0 ? 'inflow' : numValue < 0 ? 'outflow' : 'neutral')

        const Icon = direction === 'inflow' ? ArrowUpRight : direction === 'outflow' ? ArrowDownLeft : History
        const iconColor = direction === 'inflow' ? 'text-success' : direction === 'outflow' ? 'text-destructive' : 'text-muted-foreground'
        const badgeColor = direction === 'inflow'
            ? 'bg-success/10 text-success'
            : direction === 'outflow'
                ? 'bg-destructive/10 text-destructive'
                : 'bg-muted/60 text-muted-foreground'
        const sign = showSign ? (direction === 'inflow' ? '+' : direction === 'outflow' ? '-' : '') : ''

        // eslint-disable-next-line no-restricted-syntax -- flow/polarity quantity format, not currency
        const formatted = Math.abs(numValue).toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
        
        const displayUnit = uom || unit

        return (
            <div className={cn("flex items-center justify-center gap-1 font-sans text-xs font-medium text-center", size && SIZE_MAP[size], intent && INTENT_MAP[intent], weight && WEIGHT_MAP[weight], color, textTransform && TEXT_TRANSFORM_MAP[textTransform], letterSpacing && LETTER_SPACING_MAP[letterSpacing], className)} {...props}>
                <span className={cn("inline-flex items-center gap-1 rounded-sm px-2 py-0.5 leading-none", badgeColor)}>
                    {showIcon && <Icon className={cn("h-3.5 w-3.5", iconColor)} />}
                    <span>{sign}{formatted}{displayUnit && ` ${displayUnit}`}</span>
                </span>
            </div>
        )
    },

    /** Progress bar cell */
    Progress: ({ value, max = 100, label, subLabel, className, ...props }: ValueCellProps<number> & { max?: number, label?: string, subLabel?: string }) => {
        const percentage = Math.min(100, Math.max(0, ((value || 0) / max) * 100))
        return (
            <div className={cn("space-y-1 w-full", className)} {...props}>
                {(label || subLabel) && (
                    <div className="flex justify-between items-center text-xs font-medium uppercase tracking-wider mb-0.5 px-0.5">
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
    Date: ({ value, className, showTime = false, size, intent, weight, dateWeight, timeWeight, color, textTransform, letterSpacing, ...props }: ValueCellProps<string | Date> & { showTime?: boolean, size?: DataCellSize, intent?: DataCellIntent, weight?: DataCellWeight, dateWeight?: DataCellWeight, timeWeight?: DataCellWeight, color?: string, textTransform?: DataCellTextTransform, letterSpacing?: DataCellLetterSpacing }) => {
        if (!value) return <div className={cn("flex justify-center items-center w-full text-center text-xs font-medium text-muted-foreground/50", className)} {...props}>-</div>
        return (
            <div className={cn("flex justify-center items-center w-full text-center text-xs font-sans font-medium text-foreground whitespace-nowrap", size && SIZE_MAP[size], intent && INTENT_MAP[intent], weight && WEIGHT_MAP[weight], dateWeight && WEIGHT_MAP[dateWeight], color, textTransform && TEXT_TRANSFORM_MAP[textTransform], letterSpacing && LETTER_SPACING_MAP[letterSpacing], className)} {...props}>
                {formatPlainDate(value)}
                {showTime && (() => {
                    const date = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
                        ? parseDateOnly(value)
                        : new Date(value)
                    return <span className={cn("text-xs text-muted-foreground/60 ml-1.5", WEIGHT_MAP[timeWeight ?? 'normal'])}>{date.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}</span>
                })()}
            </div>
        )
    },

    // --- Status & Badges ---

    /** Mapped status badge — tinted square badge. Internally uses the standardized StatusBadge (ADR-0065 / ADR-0066). */
    Status: ({ status, label, size = "md", className }: { status: string, label?: string, size?: "xs" | "sm" | "md" | "lg" | "xl", className?: string }) => {
        return (
            <div className={cn("flex justify-center items-center w-full", className)}>
                <StatusBadge
                    status={status}
                    label={label}
                    variant="badge"
                    size={size}
                />
            </div>
        )
    },

    /** Chip for intent-based labels within table cells (wraps shared Chip component) */
    Chip: ({ children, intent = "neutral", size = "md", icon, className, ...props }: { children: ReactNode, intent?: "neutral" | "primary" | "success" | "warning" | "destructive" | "info", size?: "xs" | "sm" | "md", icon?: LucideIcon, className?: string } & HTMLAttributes<HTMLDivElement>) => (
        <div className={cn("flex justify-center items-center w-full", className)} {...props}>
            <ChipComponent intent={intent} size={size} icon={icon}>{children}</ChipComponent>
        </div>
    ),

    /** One or more domain-resolved category chips (wraps shared Chip.Category). Empty renders the unified null dash. */
    Category: ({ value, domain, size = "md", className, ...props }: { value: string | string[] | null | undefined, domain?: CategoryDomain, size?: "xs" | "sm" | "md", className?: string } & HTMLAttributes<HTMLDivElement>) => {
        const values = (Array.isArray(value) ? value : value ? [value] : []) as string[]
        if (values.length === 0 || !domain) {
            return (
                <div className={cn("flex justify-center items-center w-full text-xs font-medium text-muted-foreground/50", className)} {...props}>-</div>
            )
        }
        return (
            <div className={cn("flex justify-center items-center flex-wrap gap-1 w-full", className)} {...props}>
                {values.map((v, i) => (
                    <ChipComponent.Category key={`${v}-${i}`} domain={domain} value={v} size={size} />
                ))}
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
                        <TooltipContent side="top" className="text-xs font-semibold uppercase tracking-looser px-2 py-1 shadow-floating rounded-sm animate-in fade-in zoom-in-95 duration-200">
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
     * Single-action hover-reveal button for DataTable rows.
     * Renders an ArrowRight icon hidden by default, appearing on row hover
     * (parent must have the `group` class — DataTable rows add it automatically).
     * Executes the provided onClick when clicked.
     *
     * @contract docs/20-contracts/component-row-actions.md §4
     */
    ActionSingle: ({
        onClick,
        title = "Abrir",
        className,
    }: {
        onClick?: (e: React.MouseEvent) => void
        title?: string
        className?: string
    }) => (
        <TooltipProvider delayDuration={400}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <div className="flex justify-center items-center">
                        <Button
                            variant="ghost"
                            size="icon"
                            className={cn(
                                "h-7 w-7 rounded-full transition-all duration-200",
                                "opacity-20 group-hover:opacity-100",
                                "hover:scale-110 active:scale-95",
                                "hover:bg-accent hover:text-accent-foreground",
                                className,
                            )}
                            onClick={(e) => {
                                e.stopPropagation()
                                onClick?.(e)
                            }}
                            type="button"
                        >
                            <ArrowRight className="h-4 w-4" />
                        </Button>
                    </div>
                </TooltipTrigger>
                {title && (
                    <TooltipContent
                        side="top"
                        className="text-xs font-semibold uppercase tracking-looser px-2 py-1 shadow-floating rounded-sm animate-in fade-in zoom-in-95 duration-200"
                    >
                        {title}
                    </TooltipContent>
                )}
            </Tooltip>
        </TooltipProvider>
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
                                    key={idx}
                                    variant={isDestructive ? 'destructive' : 'default'}
                                    disabled={'disabled' in item ? item.disabled : false}
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        if ('onClick' in item && item.onClick) item.onClick(e as unknown as React.MouseEvent)
                                    }}
                                    className="text-xs font-semibold uppercase tracking-widest rounded-sm cursor-pointer"
                                >
                                    <Icon className="h-3.5 w-3.5" />
                                    {label}
                                </DropdownMenuItem>
                            )
                        })}
                    </DropdownMenuContent>
                </DropdownMenu>
                <TooltipContent side="top" className="text-xs font-semibold uppercase tracking-looser px-2 py-1 shadow-floating rounded-sm animate-in fade-in zoom-in-95 duration-200">
                    {title}
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    ),

    /**
     * Source → Destination flow display with navigable entity links.
     * Renders two clickable chips separated by an arrow icon.
     * Each side can be a plain text or a navigable entity link (via entityLabel + id).
     */
    SourceDest: ({
        source,
        dest,
        sourceEntity,
        destEntity,
        className,
        size,
        ...props
    }: HTMLAttributes<HTMLDivElement> & {
        source: string
        dest: string
        sourceEntity?: { label: string; entityLabel: string; id: number }
        destEntity?: { label: string; entityLabel: string; id: number }
        size?: DataCellSize
    }) => {
        const { openEntity } = useGlobalModals()

        const EntityLink = ({ label, entityLabel, id }: { label: string; entityLabel?: string; id?: number }) => {
            if (!entityLabel || !id) {
                return <span className="text-xs font-medium text-foreground">{label}</span>
            }
            return (
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                        e.stopPropagation()
                        openEntity(entityLabel, id)
                    }}
                    className="h-auto px-1.5 py-0.5 rounded bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors cursor-pointer"
                >
                    {label}
                </Button>
            )
        }

        return (
            <div className={cn("flex items-center justify-center gap-1.5", size && SIZE_MAP[size], className)} {...props}>
                <EntityLink label={source} entityLabel={sourceEntity?.entityLabel} id={sourceEntity?.id} />
                <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground/40" />
                <EntityLink label={dest} entityLabel={destEntity?.entityLabel} id={destEntity?.id} />
            </div>
        )
    },

    /**
     * Compact summary for workflow-based entities (orders, etc.) in table views.
     * Replicates the essential data of EntityCardWorkflowBody in a space-efficient cell.
     */
    WorkflowSummary: ({
        lines,
        total,
        pending,
        deliveryDate,
        dateLabel = "Entrega",
        className,
        ...props
    }: HTMLAttributes<HTMLDivElement> & {
        lines?: Array<{ quantity: number | string; product_name?: string }>
        total: number
        pending?: number
        deliveryDate?: string
        dateLabel?: string
    }) => {
        return (
            <div className={cn("flex flex-col items-end justify-center gap-0.5", className)} {...props}>
                <div className="flex items-center gap-1.5 min-w-0">
                    {lines && lines.length > 0 && (
                        <span className="text-4xs uppercase font-medium tracking-wider text-muted-foreground/60">{lines.length} {lines.length === 1 ? 'item' : 'items'}</span>
                    )}
                    <span className="text-xs font-medium tracking-tight">{formatCurrency(total)}</span>
                </div>
                {(pending != null && pending > 0) && (
                    <span className="text-4xs text-warning font-medium uppercase tracking-widest leading-none">Pend.: {formatCurrency(pending)}</span>
                )}
                {deliveryDate && (
                    <span className="text-4xs font-medium text-muted-foreground whitespace-nowrap overflow-hidden text-ellipsis max-w-full leading-none">
                        {dateLabel}: {formatPlainDate(deliveryDate)}
                    </span>
                )}
            </div>
        )
    },
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
    /** Function receiving the row data, must return DataCell.Action or DataCell.ActionSingle elements */
    renderActions: (item: TData) => ReactNode
    /** Column header label. Omit for no header (default for DataTableViews). */
    headerLabel?: string
}

/**
 * createActionsColumn — Standard factory for the actions column.
 *
 * By default renders no header (empty). Pass `headerLabel` to restore one.
 * Column size is fixed at 40px to keep the actions column minimal.
 *
 * @contract component-row-actions.md §5.1
 *
 * Usage:
 * ```tsx
 * // 1 action — single hover-reveal arrow
 * createActionsColumn<Product>({
 *   renderActions: (item) => (
 *     <DataCell.ActionSingle onClick={() => edit(item)} />
 *   ),
 * })
 *
 * // 2+ actions — kebab menu
 * createActionsColumn<Product>({
 *   renderActions: (item) => (
 *     <DataCell.ActionMenu items={[
 *       { action: "edit", onClick: () => edit(item) },
 *       { action: "delete", onClick: () => del(item) },
 *     ]} />
 *   ),
 * })
 * ```
 */
export function createActionsColumn<TData>({
    renderActions,
    headerLabel,
}: ActionsColumnConfig<TData>): ColumnDef<TData, unknown> {
    return {
        id: "actions",
        header: headerLabel ? () => (
            <div className="text-center text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {headerLabel}
            </div>
        ) : undefined,
        cell: ({ row }) => (
            <DataCell.ActionGroup>
                {renderActions(row.original)}
            </DataCell.ActionGroup>
        ),
        size: 40,
        enableSorting: false,
        enableHiding: false,
    }
}

// ─── Hub Trigger Column Factory ────────────────────────────────────────────────

interface HubTriggerColumnConfig<TData> {
    /** Check if a row is currently selected/hub-open */
    isSelected: (row: TData) => boolean
    /** Toggle handler — called with the row data */
    onToggle: (row: TData) => void
}

/**
 * Creates a hub-trigger column for DataTable rows that open/close a side panel (HUB).
 *
 * Renders `DataCell.Action action="hub"` with visual feedback:
 * - Selected: ArrowLeft icon, `text-primary`, slide-in animation
 * - Not selected: ArrowRight icon, `text-muted-foreground/30`, hover translate
 *
 * @contract docs/20-contracts/component-row-actions.md
 */
export function createHubTriggerColumn<TData>({
    isSelected,
    onToggle,
}: HubTriggerColumnConfig<TData>): ColumnDef<TData, unknown> {
    return {
        id: "hub_trigger",
        header: () => null,
        enableHiding: false,
        cell: ({ row }) => {
            const selected = isSelected(row.original)
            return (
                <div className="flex justify-end pr-2">
                    <DataCell.Action
                        action="hub"
                        className={cn(
                            "transition-all",
                            selected
                                ? "text-primary animate-in fade-in slide-in-from-right-1 duration-300"
                                : "text-muted-foreground/30 hover:text-primary hover:translate-x-0.5",
                        )}
                        onClick={() => onToggle(row.original)}
                    />
                </div>
            )
        },
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
 * Renders the canonical ghost pill (ADR-0065). Use `opts.label` to override display text.
 */
export function createStatusColumn<TData>(
    accessorKey: string,
    title: string,
    opts?: ColOpts<TData> & { label?: string; size?: "xs" | "sm" | "md" | "lg" | "xl" }
): ColumnDef<TData> {
    return {
        accessorKey,
        header: ({ column }) => <DataTableColumnHeader column={column} title={title} className={cn("justify-center", opts?.headerClassName)} />,
        cell: ({ row }) => <DataCell.Status status={row.getValue(accessorKey) as string} label={opts?.label} size={opts?.size} />,
        enableSorting: opts?.enableSorting ?? true,
    }
}

/**
 * Creates an expander column for DataTable rows with sub-component expansion.
 * Renders a chevron toggle button with a unified visual style.
 *
 * @param opts.canExpand — Optional predicate. When it returns `false` for a row,
 *   the cell renders `null` (hidden button). Use when some rows have nothing to expand.
 */
export function createExpanderColumn<TData>(opts?: {
    canExpand?: (row: TData) => boolean
}): ColumnDef<TData> {
    return {
        id: "expander",
        header: ({ table }) => (
            <Button
                onClick={() => table.toggleAllRowsExpanded()}
                className="p-1 bg-transparent text-muted-foreground hover:bg-background transition-colors"
            >
                {table.getIsAllRowsExpanded() ? (
                    <ChevronDown className="h-4 w-4" />
                ) : (
                    <ChevronRight className="h-4 w-4" />
                )}
            </Button>
        ),
        cell: ({ row }) => {
            if (opts?.canExpand && !opts.canExpand(row.original)) return null
            return (
                <Button
                    onClick={(e) => {
                        e.stopPropagation()
                        row.toggleExpanded()
                    }}
                    className="p-1 bg-transparent text-muted-foreground hover:bg-background transition-colors"
                >
                    {row.getIsExpanded() ? (
                        <ChevronDown className="h-4 w-4" />
                    ) : (
                        <ChevronRight className="h-4 w-4" />
                    )}
                </Button>
            )
        },
        size: 40,
        enableSorting: false,
        enableHiding: false,
    }
}
