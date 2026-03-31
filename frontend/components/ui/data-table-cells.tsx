import { Badge } from "@/components/ui/badge"
import { cn, formatCurrency, translateStatus, formatPlainDate, formatDocumentId } from "@/lib/utils"
import { ExternalLink, LucideIcon } from "lucide-react"
import Link from "next/link"
import { ReactNode, HTMLAttributes } from "react"

import { MoneyDisplay } from "@/components/shared/MoneyDisplay"

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
        <div className={cn("font-medium truncate", className)} {...props}>{children}</div>
    ),

    /** Secondary text for categories, descriptions, or subtitles */
    Secondary: ({ children, className, ...props }: BaseCellProps) => (
        <div className={cn("text-xs text-muted-foreground truncate", className)} {...props}>{children}</div>
    ),

    /** Standard text for identifiers (simple font as per request) */
    Code: ({ children, className, ...props }: BaseCellProps) => (
        <div className={cn("text-xs font-mono font-medium text-foreground/90", className)} {...props}>
            {children || "-"}
        </div>
    ),

    /** Standardized Document ID with prefix and padding */
    DocumentId: ({ type, number, className, ...props }: { type?: string, number: string | number | null | undefined, className?: string }) => (
        <div className={cn("text-sm font-mono font-medium", className)} {...props}>
            {formatDocumentId(type, number)}
        </div>
    ),

    /** Clickable link, often used for document codes (e.g. NV-123) */
    Link: ({ children, href, onClick, className, external, ...props }: HTMLAttributes<HTMLElement> & { href?: string, onClick?: () => void, external?: boolean }) => {
        if (href) {
            return (
                <Link
                    href={href}
                    target={external ? "_blank" : undefined}
                    className={cn("font-medium text-primary hover:underline hover:text-primary/80 flex items-center gap-1 w-fit", className)}
                    {...(props as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
                >
                    {children}
                    {external && <ExternalLink className="h-3 w-3" />}
                </Link>
            )
        }
        return (
            <button
                onClick={onClick}
                className={cn("font-medium text-primary hover:underline hover:text-primary/80 text-left w-fit", className)}
                {...(props as React.ButtonHTMLAttributes<HTMLButtonElement>)}
            >
                {children}
            </button>
        )
    },

    // --- Numeric Cells ---

    /** Right-aligned number with tabular figures */
    Number: ({ value, suffix, prefix, className, decimals = 0, ...props }: ValueCellProps<number | string> & { suffix?: string, prefix?: string, decimals?: number }) => {
        if (value === null || value === undefined) return <div className={cn("text-right text-muted-foreground", className)} {...props}>-</div>
        const num = typeof value === 'string' ? parseFloat(value) : value
        return (
            <div className={cn("text-right font-medium tabular-nums", className)} {...props}>
                {prefix}{num.toLocaleString('es-CL', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })} {suffix && <span className="text-[10px] text-muted-foreground font-normal ml-0.5">{suffix}</span>}
            </div>
        )
    },

    /** Currency formatted cell */
    Currency: ({ value, currency = "CLP", className, digits = 0, ...props }: ValueCellProps<number | string> & { currency?: string, digits?: number }) => {
        return (
            <div className={cn("text-right", className)} {...props}>
                <MoneyDisplay amount={value} currency={currency} digits={digits} />
            </div>
        )
    },

    /** Variance cell that colors red/green based on value */
    Variance: ({ value, currency = "CLP", className, digits = 0, ...props }: ValueCellProps<number> & { currency?: string | boolean, digits?: number }) => {
        return (
            <div className={cn("text-right", className)} {...props}>
                <MoneyDisplay 
                    amount={value} 
                    currency={typeof currency === "string" ? currency : "CLP"} 
                    digits={digits} 
                    showColor={true} 
                />
            </div>
        )
    },

    /** Progress bar cell */
    Progress: ({ value, max = 100, className }: ValueCellProps<number> & { max?: number }) => {
        const percentage = Math.min(100, Math.max(0, ((value || 0) / max) * 100))
        return (
            <div className={cn("w-full bg-secondary/30 rounded-full h-1.5 overflow-hidden", className)}>
                <div
                    className={cn("h-full transition-all", percentage > 100 ? "bg-destructive" : "bg-primary")}
                    style={{ width: `${percentage}%` }}
                />
            </div>
        )
    },

    // --- Date Cells ---

    /** Standard date format */
    Date: ({ value, className, showTime = false, ...props }: ValueCellProps<string | Date> & { showTime?: boolean }) => {
        if (!value) return <div className={cn("text-muted-foreground text-xs", className)} {...props}>-</div>
        return (
            <div className={cn("text-sm", className)} {...props}>
                {formatPlainDate(value)}
                {showTime && (() => {
                    const date = new Date(value)
                    return <span className="text-xs text-muted-foreground ml-1">{date.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}</span>
                })()}
            </div>
        )
    },

    // --- Status & Badges ---

    /** Mapped status badge */
    Status: ({ status, map, variant = "outline", className }: { status: string, map?: Record<string, "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info" | "indigo">, variant?: "default" | "outline" | "secondary", className?: string }) => {
        const intent = map ? map[status] || "secondary" : "secondary"
        return (
            <Badge variant={intent as "default" | "secondary" | "destructive" | "outline"} className={cn("whitespace-nowrap", className)}>
                {translateStatus(status)}
            </Badge>
        )
    },

    /** Generic Badge wrapper */
    Badge: ({ children, variant = "secondary", className, ...props }: { children: ReactNode, variant?: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info" | "indigo", className?: string } & HTMLAttributes<HTMLDivElement>) => (
        <Badge variant={variant as "default" | "secondary" | "destructive" | "outline"} className={className} {...props}>
            {children}
        </Badge>
    ),

    /** Icon with optional tooltip (wrapper needed in parent for tooltip provider usually, but here just the icon structure) */
    Icon: ({ icon: Icon, className, color, ...props }: { icon: LucideIcon, className?: string, color?: string } & HTMLAttributes<HTMLDivElement>) => (
        <div className={cn("p-1 rounded-full bg-secondary/50", className)} {...props}>
            <Icon className={cn("h-3.5 w-3.5", color)} />
        </div>
    )
}
