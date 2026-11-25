"use client"

import { useMemo, useState } from "react"
import { ChevronRight, Search, type LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { BaseModal, Chip, EmptyState } from "@/components/shared"
import { cn } from "@/lib/utils"

/** Desde esta cantidad de opciones se muestra el buscador (igual que el selector de variantes del POS). */
const SEARCH_THRESHOLD = 8

export interface PayrollPickerOption {
    id: number
    title: string
    chips?: string[]
    /** Cifra destacada a la derecha (saldo, cuota sugerida…). */
    value?: string
    /** Texto bajo la cifra. */
    valueHint?: string
}

interface PayrollPickerModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    icon: LucideIcon
    title: string
    description: string
    options: PayrollPickerOption[]
    isLoading?: boolean
    emptyTitle: string
    emptyDescription?: string
    onSelect: (id: number) => void
}

/**
 * Lista de selección de la ficha de liquidación (conceptos, anticipos y préstamos), con el mismo
 * lenguaje que `VariantSelectorModal` del POS: filas completas pulsables, chips, cifra a la
 * derecha y buscador cuando la lista es larga. Elegir cierra el modal.
 */
export function PayrollPickerModal({
    open, onOpenChange, icon: Icon, title, description, options, isLoading, emptyTitle, emptyDescription, onSelect,
}: PayrollPickerModalProps) {
    const [query, setQuery] = useState("")
    const visible = useMemo(() => {
        const q = query.trim().toLowerCase()
        if (!q) return options
        return options.filter((o) => o.title.toLowerCase().includes(q) || o.chips?.some((c) => c.toLowerCase().includes(q)))
    }, [options, query])

    const close = (next: boolean) => {
        if (!next) setQuery("")
        onOpenChange(next)
    }

    return (
        <BaseModal asDialog open={open} onOpenChange={close} icon={Icon} title={title} description={description} size="md" hideScrollArea>
            <div className="flex flex-col gap-3 p-4">
                {options.length > SEARCH_THRESHOLD && (
                    <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                        <Input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Filtrar…"
                            aria-label={`Filtrar ${title.toLowerCase()}`}
                            className="h-control-lg pl-9"
                        />
                    </div>
                )}

                {isLoading ? (
                    <div className="grid gap-px overflow-hidden rounded-sm border border-border" aria-busy>
                        {[0, 1, 2].map((i) => <div key={i} className="h-16 animate-pulse bg-muted motion-reduce:animate-none" />)}
                    </div>
                ) : visible.length === 0 ? (
                    <EmptyState
                        context="search"
                        variant="compact"
                        title={query ? "Sin coincidencias" : emptyTitle}
                        description={query ? "Ninguna opción coincide con el filtro." : emptyDescription}
                    />
                ) : (
                    <div className="max-h-[55vh] w-full overflow-y-auto rounded-sm border border-border">
                        <ul className="w-full divide-y divide-border">
                            {visible.map((o) => (
                                <li key={o.id}>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        onClick={() => { onSelect(o.id); close(false) }}
                                        className={cn(
                                            "h-auto min-h-16 w-full justify-start gap-3 rounded-none px-3 py-2.5 text-left font-normal whitespace-normal",
                                            "hover:bg-muted active:bg-muted/70",
                                        )}
                                    >
                                        <span className="flex size-12 shrink-0 items-center justify-center rounded-sm bg-muted text-muted-foreground">
                                            <Icon className="size-6" aria-hidden />
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-base font-medium">{o.title}</span>
                                            {!!o.chips?.length && (
                                                <span className="mt-1 flex flex-wrap gap-1">
                                                    {o.chips.map((c) => <Chip key={c} size="xs" intent="neutral">{c}</Chip>)}
                                                </span>
                                            )}
                                        </span>
                                        {o.value && (
                                            <span className="flex shrink-0 flex-col items-end gap-1">
                                                <span className="font-mono text-base font-black tabular-nums">{o.value}</span>
                                                {o.valueHint && <span className="text-2xs text-muted-foreground">{o.valueHint}</span>}
                                            </span>
                                        )}
                                        <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                                    </Button>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </BaseModal>
    )
}
