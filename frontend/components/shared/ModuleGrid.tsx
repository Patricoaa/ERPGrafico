import Link from "next/link"
import { ChevronRight, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { CardLead } from "./CardLead"
import { cardAnatomy } from "./card-anatomy"

/**
 * ModuleGrid — shared container for module/card navigation grids (dashboard, settings).
 * Owned by ADR-0074 (pill-free v1: per-card status is not guessed from literals) and ADR-0097:
 * role `nav` of the card family — `card-flat` row, CardLead + title/description + chevron glyph.
 */

export type RuntimeStatus =
    | { kind: "connected" }
    | { kind: "pending" }
    | { kind: "offline" }
    | { kind: "info"; label: string }

export interface ModuleGridItem {
    id: string
    label: string
    description?: string
    url: string
    icon: LucideIcon
    /** System-derived runtime status. v1 of both grids passes no status. */
    status?: RuntimeStatus
}

interface ModuleGridProps {
    items: ModuleGridItem[]
    className?: string
}

interface StatusMeta {
    label: string
    className: string
}

function statusMeta(status: RuntimeStatus): StatusMeta {
    switch (status.kind) {
        case "connected":
            return { label: "Conectado", className: "text-success bg-success/10" }
        case "pending":
            return { label: "Pendiente", className: "text-warning bg-warning/10" }
        case "offline":
            return { label: "Offline", className: "text-destructive bg-destructive/10" }
        case "info":
            return { label: status.label, className: "text-muted-foreground bg-muted" }
    }
}

export function ModuleGrid({ items, className }: ModuleGridProps) {
    return (
        <ul className={cn("grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4", className)}>
            {items.map((mod) => {
                const Icon = mod.icon
                const meta = mod.status ? statusMeta(mod.status) : null
                return (
                    <li key={mod.id} className="min-w-0">
                        <Link
                            href={mod.url}
                            className="card-flat group flex h-full items-center gap-3 p-3">
                            <CardLead className="bg-muted/50 transition-colors group-hover:text-primary">
                                <Icon className="size-4" aria-hidden />
                            </CardLead>
                            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                                <span className={cardAnatomy.title}>{mod.label}</span>
                                {mod.description && (
                                    <span className={cn(cardAnatomy.description, "line-clamp-1")}>{mod.description}</span>
                                )}
                                {meta && (
                                    <div className={`mt-1 flex w-fit items-center gap-1.5 rounded-full px-2 py-0.5 text-2xs font-bold uppercase tracking-wider ${meta.className}`}>
                                        <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
                                        {meta.label}
                                    </div>
                                )}
                            </div>
                            <ChevronRight className={cardAnatomy.glyph} aria-hidden />
                        </Link>
                    </li>
                )
            })}
        </ul>
    )
}