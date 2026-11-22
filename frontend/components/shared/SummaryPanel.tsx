"use client"

import type { ReactNode } from "react"
import { ChevronDown, MoreVertical, type LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

/**
 * Panel derecho de resumen (carrito del POS, lista de la calculadora de costos).
 * Una sola superficie: encabezado · líneas · total · acciones. Pensado para uso táctil:
 * todos los controles son visibles siempre y miden al menos `control-touch`.
 * Ver docs/20-contracts/component-summary-panel.md.
 */

/* ───────────────────────── Superficie ───────────────────────── */

export function SummaryPanel({ children, className }: { children: ReactNode; className?: string }) {
    return (
        <section className={cn("flex min-h-0 flex-1 flex-col overflow-hidden rounded-sm border border-border bg-card", className)}>
            {children}
        </section>
    )
}

/* ───────────────────────── Menú ⋮ ───────────────────────── */

export interface SummaryMenuItem {
    id: string
    label: string
    icon?: LucideIcon
    onSelect: () => void
    /** Texto a la derecha (p. ej. el descuento ya aplicado). */
    detail?: ReactNode
    destructive?: boolean
    /** Oculta la entrada (permiso, estado). Si no queda ninguna, el menú no se dibuja. */
    hidden?: boolean
}

export function SummaryMenu({ items, label = "Más acciones" }: { items: SummaryMenuItem[]; label?: string }) {
    const visible = items.filter(item => !item.hidden)
    if (visible.length === 0) return null

    const regular = visible.filter(item => !item.destructive)
    const destructive = visible.filter(item => item.destructive)

    const renderItem = (item: SummaryMenuItem) => (
        <DropdownMenuItem
            key={item.id}
            onSelect={item.onSelect}
            className={cn("h-control-touch cursor-pointer gap-3 text-base", item.destructive && "text-destructive focus:text-destructive")}
        >
            {item.icon && <item.icon className="size-5" aria-hidden />}
            <span>{item.label}</span>
            {item.detail && <span className="ml-auto text-sm font-bold">{item.detail}</span>}
        </DropdownMenuItem>
    )

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" type="button" aria-label={label} className="size-control-touch shrink-0 text-muted-foreground hover:text-foreground">
                    <MoreVertical className="size-5" aria-hidden />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-56">
                {regular.map(renderItem)}
                {regular.length > 0 && destructive.length > 0 && <DropdownMenuSeparator />}
                {destructive.map(renderItem)}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

/* ───────────────────────── Encabezado ───────────────────────── */

interface SummaryPanelHeaderProps {
    title?: string
    /** Cantidad de ítems; se muestra como "N ítems". */
    count?: number
    /** Acción a la izquierda (p. ej. "Editar carrito"), en lugar del título. */
    leading?: ReactNode
    /** Estado de guardado automático u otro indicador. */
    status?: ReactNode
    menu?: ReactNode
}

export function SummaryPanelHeader({ title, count, leading, status, menu }: SummaryPanelHeaderProps) {
    return (
        <header className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-1.5">
            {leading ?? (
                <h2 className="truncate text-base font-bold tracking-tight">{title}</h2>
            )}
            {count !== undefined && (
                <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-xs font-bold tabular-nums text-muted-foreground">
                    {count} {count === 1 ? "ítem" : "ítems"}
                </span>
            )}
            <span className="flex-1" />
            {status}
            {menu}
        </header>
    )
}

/* ───────────────────────── Líneas ───────────────────────── */

interface SummaryLineListProps {
    children?: ReactNode
    isEmpty?: boolean
    /** Contenido del estado vacío (icono + mensaje). */
    empty?: ReactNode
    /** Esqueleto mientras carga. */
    loading?: ReactNode
    isLoading?: boolean
}

export function SummaryLineList({ children, isEmpty = false, empty, loading, isLoading = false }: SummaryLineListProps) {
    return (
        <div className="relative min-h-0 flex-1 overflow-auto px-2 py-1 scrollbar-thin">
            {isLoading ? loading : isEmpty ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-8 text-center text-muted-foreground">
                    {empty}
                </div>
            ) : (
                <div className="divide-y divide-border/60">{children}</div>
            )}
        </div>
    )
}

interface SummaryLineProps {
    name: ReactNode
    /** Total de la línea, ya formateado. */
    total: ReactNode
    /** Precio unitario "× …" que precede al stepper. */
    unit?: ReactNode
    stepper?: ReactNode
    /** Unidad de medida (texto o selector). */
    uom?: ReactNode
    /** Insignias: descuento aplicado, máximo disponible, advertencias. */
    badges?: ReactNode
    /** Botones de la línea (descuento, eliminar). Siempre visibles. */
    actions?: ReactNode
}

/** Línea de 2 filas: nombre + total, y debajo precio × cantidad · unidad · insignias · acciones. */
export function SummaryLine({ name, total, unit, stepper, uom, badges, actions }: SummaryLineProps) {
    return (
        <div className="grid gap-1.5 px-1 py-2.5">
            <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-base font-medium text-foreground/90">{name}</span>
                <span className="shrink-0 font-mono text-base font-bold tabular-nums text-foreground">{total}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                {unit && <span className="font-mono tabular-nums">{unit}</span>}
                {stepper}
                {uom}
                {badges}
                {actions && <span className="ml-auto flex items-center gap-1">{actions}</span>}
            </div>
        </div>
    )
}

/* ───────────────────────── Total ───────────────────────── */

export interface SummaryBreakdownRow {
    label: string
    value: ReactNode
    /** `discount` pinta el valor como descuento. */
    tone?: "default" | "discount"
}

interface SummaryTotalProps {
    label?: string
    total: ReactNode
    breakdown?: SummaryBreakdownRow[]
    /** Aviso corto bajo el total (p. ej. "Simulación, no mueve stock"). */
    note?: ReactNode
}

export function SummaryTotal({ label = "Total", total, breakdown, note }: SummaryTotalProps) {
    return (
        <div className="grid shrink-0 gap-2 border-t border-border px-3 py-3">
            <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
                <strong className="font-mono text-3xl font-black leading-none tracking-tighter tabular-nums">{total}</strong>
            </div>
            {breakdown && breakdown.length > 0 && (
                <details className="group text-sm text-muted-foreground">
                    <summary className="flex h-control-sm w-max cursor-pointer list-none items-center gap-1 [&::-webkit-details-marker]:hidden">
                        Desglose
                        <ChevronDown className="size-4 transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden />
                    </summary>
                    <dl className="grid gap-0.5 pb-1">
                        {breakdown.map(row => (
                            <div key={row.label} className="flex justify-between gap-3">
                                <dt>{row.label}</dt>
                                <dd className={cn("font-mono tabular-nums", row.tone === "discount" && "text-destructive")}>{row.value}</dd>
                            </div>
                        ))}
                    </dl>
                </details>
            )}
            {note && <p className="flex items-start gap-1.5 text-xs text-muted-foreground">{note}</p>}
        </div>
    )
}

/* ───────────────────────── Acciones ───────────────────────── */

export function SummaryActions({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
    return (
        <footer className="grid shrink-0 gap-2 border-t border-border bg-card px-3 pb-3 pt-3">
            {children}
            {hint && <p role="status" className="text-xs text-muted-foreground">{hint}</p>}
        </footer>
    )
}

/** Fila de botones de igual alto. `ratio` reparte el ancho (p. ej. "1:2" para Atrás / Siguiente). */
export function SummaryActionRow({ children, ratio = "1:1" }: { children: ReactNode; ratio?: "1:1" | "1:2" }) {
    return (
        <div className={cn("grid gap-2", ratio === "1:2" ? "grid-cols-[1fr_2fr]" : "grid-cols-2")}>{children}</div>
    )
}
