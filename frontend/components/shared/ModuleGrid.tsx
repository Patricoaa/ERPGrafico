import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * ModuleGrid — shared container for module/card navigation grids (dashboard, settings).
 * Owned by ADR-0074: single card-base token, single documented height, v1 ships pill-free
 * (per-card status is not guessed from literals).
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
                            className="card-base group relative flex flex-col justify-between p-5 h-28 bg-background">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-md bg-muted/50 flex items-center justify-center text-muted-foreground group-hover:text-primary transition-colors shrink-0">
                                    <Icon className="w-4 h-4" />
                                </div>
                                <div className="flex flex-col min-w-0">
                                    <span className="font-bold tracking-tight text-sm text-foreground">{mod.label}</span>
                                    {mod.description && (
                                        <span className="text-2xs text-muted-foreground line-clamp-1">{mod.description}</span>
                                    )}
                                </div>
                            </div>

                            {meta && (
                                <div className="flex items-center gap-2 mt-auto">
                                    <div className={`px-2 py-0.5 rounded-full text-2xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${meta.className}`}>
                                        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
                                        {meta.label}
                                    </div>
                                </div>
                            )}
                        </Link>
                    </li>
                )
            })}
        </ul>
    )
}