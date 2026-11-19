"use client"

import { Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { FiscalMatchSearchOrdering } from "../types/fiscalMatch"

export interface FiscalMatchSearchToolbarProps {
    search: string
    onSearchChange: (value: string) => void
    ordering: FiscalMatchSearchOrdering
    onOrderingChange: (value: FiscalMatchSearchOrdering) => void
    placeholder?: string
    className?: string
    disabled?: boolean
    ariaLabel?: string
}

export function FiscalMatchSearchToolbar({
    search,
    onSearchChange,
    ordering,
    onOrderingChange,
    placeholder = "Buscar por folio, RUT, monto…",
    className,
    disabled = false,
    ariaLabel,
}: FiscalMatchSearchToolbarProps) {
    return (
        <div className={`flex flex-col sm:flex-row gap-2 items-center justify-between ${className ?? ""}`}>
            <div className="relative w-full sm:w-72">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden />
                <Input
                    type="search"
                    aria-label={ariaLabel || placeholder}
                    placeholder={placeholder}
                    value={search}
                    onChange={(e) => onSearchChange(e.target.value)}
                    disabled={disabled}
                    className="pl-8 text-sm"
                />
            </div>
            <div className="flex items-center gap-1.5 self-end text-xs text-muted-foreground">
                <span>Ordenar por:</span>
                <Button
                    type="button"
                    size="sm"
                    variant={ordering === "score" ? "secondary" : "ghost"}
                    className="h-7 text-xs"
                    onClick={() => onOrderingChange("score")}
                    disabled={disabled}
                >
                    Coincidencia
                </Button>
                <Button
                    type="button"
                    size="sm"
                    variant={ordering === "recent" ? "secondary" : "ghost"}
                    className="h-7 text-xs"
                    onClick={() => onOrderingChange("recent")}
                    disabled={disabled}
                >
                    Recientes
                </Button>
            </div>
        </div>
    )
}
