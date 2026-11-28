"use client"

import { Button } from "@/components/ui/button"
import { useEffect, useRef, useState, useMemo, type ReactNode } from "react"
import { Search } from "lucide-react"
import { DynamicIcon, SheetCloseButton } from "@/components/shared"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useDebounce } from "@/hooks/useDebounce"
import { useUniversalSearch, type SearchResult } from "@/features/search"
import { useGlobalModals } from "@/components/providers/GlobalModalProvider"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"

interface UniversalSearchProps {
    /** Disparador personalizado (p. ej. ítem "Buscar" del sidebar). Por defecto: botón ícono. */
    renderTrigger?: (open: () => void) => ReactNode
}

export function UniversalSearch({ renderTrigger }: UniversalSearchProps = {}) {
    const [open, setOpen] = useState(false)
    const [query, setQuery] = useState("")
    const [activeIndex, setActiveIndex] = useState(0)
    const [selectedType, setSelectedType] = useState<string | null>(null)
    const debouncedQuery = useDebounce(query, 200)
    const { results, isLoading } = useUniversalSearch(debouncedQuery)
    const { openEntity } = useGlobalModals()
    const inputRef = useRef<HTMLInputElement>(null)

    // keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "k") {
                e.preventDefault()
                setOpen((prev) => !prev)
            }
        }
        document.addEventListener("keydown", handleKeyDown)
        return () => document.removeEventListener("keydown", handleKeyDown)
    }, [])

    // Cada apertura parte limpia. Se ajusta solo en la transición cerrado → abierto:
    // limpiar mientras está abierto borraba cada tecla apenas se escribía.
    const [prevOpen, setPrevOpen] = useState(open)
    if (open !== prevOpen) {
        setPrevOpen(open)
        if (open) {
            setQuery("")
            setActiveIndex(0)
            setSelectedType(null)
        }
    }

    useEffect(() => {
        if (!open) return
        const id = setTimeout(() => inputRef.current?.focus(), 50)
        return () => clearTimeout(id)
    }, [open])

    // Derived data: unique types for segmenters
    const entityTypes = useMemo(() => {
        const types = new Map<string, { label: string; title_plural: string; icon: string }>()
        results.forEach((r) => {
            if (!types.has(r.label)) {
                types.set(r.label, {
                    label: r.label,
                    title_plural: r.title_plural,
                    icon: r.icon,
                })
            }
        })
        return Array.from(types.values())
    }, [results])

    // Filtered results by selected type
    const filteredResults = useMemo(() => {
        if (!selectedType) return results
        return results.filter((r) => r.label === selectedType)
    }, [results, selectedType])

    useEffect(() => {
        requestAnimationFrame(() => setActiveIndex(0))
    }, [filteredResults, selectedType])

    // El resultado se abre como pestaña de registro (ADR-0152), sin abandonar la página.
    function openResult(result: SearchResult) {
        setOpen(false)
        openEntity(result.label, result.id, undefined, undefined, { display: result.display })
    }

    function handleKeyDown(e: React.KeyboardEvent) {
        if (e.key === "ArrowDown") {
            e.preventDefault()
            setActiveIndex((i) => Math.min(i + 1, filteredResults.length - 1))
        } else if (e.key === "ArrowUp") {
            e.preventDefault()
            setActiveIndex((i) => Math.max(i - 1, 0))
        } else if (e.key === "Enter" && filteredResults[activeIndex]) {
            openResult(filteredResults[activeIndex])
        } else if (e.key === "Escape") {
            if (query) {
                setQuery("")
            } else {
                setOpen(false)
            }
        }
    }

    const ALL = "__all__"

    return (
        <>
            {renderTrigger ? renderTrigger(() => setOpen(true)) : (
                <Button
                    variant="ghost"
                    size="icon"
                    type="button"
                    onClick={() => setOpen(true)}
                    aria-label="Búsqueda universal (Ctrl+K)"
                    className="size-control-sm text-muted-foreground hover:text-foreground"
                >
                    <Search className="size-4" aria-hidden />
                </Button>
            )}

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent
                    size="md"
                    showCloseButton={false}
                    className="gap-0 overflow-hidden p-0"
                    aria-label="Búsqueda universal"
                >
                    <DialogTitle className="sr-only">Búsqueda universal</DialogTitle>

                    {/* Campo de búsqueda */}
                    <div className="flex h-14 items-center gap-2 border-b border-border px-4">
                        <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                        <input
                            ref={inputRef}
                            role="combobox"
                            aria-expanded={filteredResults.length > 0}
                            aria-controls="search-results"
                            aria-activedescendant={filteredResults[activeIndex] ? `search-result-${activeIndex}` : undefined}
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Busca por número, nombre, RUT o código…"
                            className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                            autoComplete="off"
                            spellCheck={false}
                        />
                        <SheetCloseButton onClick={() => setOpen(false)} label="Cerrar búsqueda" />
                    </div>

                    {/* Filtro por tipo de entidad */}
                    {entityTypes.length > 1 && (
                        <div className="overflow-x-auto border-b border-border px-4 py-2 [scrollbar-width:none]">
                            <ToggleGroup
                                type="single"
                                size="sm"
                                value={selectedType ?? ALL}
                                onValueChange={(v) => { if (v) setSelectedType(v === ALL ? null : v) }}
                                aria-label="Filtrar por tipo"
                                className="w-max"
                            >
                                <ToggleGroupItem value={ALL} className="text-xs">Todos</ToggleGroupItem>
                                {entityTypes.map((type) => (
                                    <ToggleGroupItem key={type.label} value={type.label} className="gap-1.5 text-xs">
                                        {type.icon && <DynamicIcon name={type.icon} className="size-3.5" />}
                                        {type.title_plural}
                                    </ToggleGroupItem>
                                ))}
                            </ToggleGroup>
                        </div>
                    )}

                    {/* Resultados */}
                    <ScrollArea className="h-[320px]">
                        <ul id="search-results" role="listbox" aria-label="Resultados" className="flex flex-col p-1">
                            {isLoading && [...Array<undefined>(6)].map((_, i) => (
                                <li key={i} className="flex h-12 items-center gap-3 px-3">
                                    <Skeleton className="size-4 rounded-sm" />
                                    <div className="flex-1 space-y-1.5">
                                        <Skeleton className="h-3.5 w-2/5" />
                                        <Skeleton className="h-3 w-1/4" />
                                    </div>
                                </li>
                            ))}

                            {!isLoading && filteredResults.length === 0 && (
                                <li className="flex flex-col items-center justify-center gap-1 px-6 py-16 text-center">
                                    {debouncedQuery.length >= 2 ? (
                                        <>
                                            <p className="text-sm font-medium text-foreground">Sin coincidencias</p>
                                            <p className="text-xs text-muted-foreground">Prueba con un término más general.</p>
                                        </>
                                    ) : (
                                        <p className="text-xs text-muted-foreground">
                                            Escribe un número de documento, nombre de contacto o código de producto.
                                        </p>
                                    )}
                                </li>
                            )}

                            {!isLoading && filteredResults.map((result, index) => (
                                <li
                                    key={`${result.label}-${result.id}`}
                                    id={`search-result-${index}`}
                                    role="option"
                                    aria-selected={index === activeIndex}
                                    onMouseEnter={() => setActiveIndex(index)}
                                    onClick={() => openResult(result)}
                                    className={cn(
                                        "flex h-12 cursor-pointer items-center gap-3 rounded-sm px-3",
                                        index === activeIndex && "bg-accent text-accent-foreground",
                                    )}
                                >
                                    <DynamicIcon name={result.icon} className="size-4 shrink-0 text-muted-foreground" />
                                    <div className="flex min-w-0 flex-1 flex-col">
                                        <span className="truncate text-sm font-medium text-foreground">{result.display}</span>
                                        {(result.subtitle || result.extra_info) && (
                                            <span className="truncate text-xs text-muted-foreground">
                                                {[result.subtitle, result.extra_info].filter(Boolean).join(" · ")}
                                            </span>
                                        )}
                                    </div>
                                    <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">{result.title}</span>
                                </li>
                            ))}
                        </ul>
                    </ScrollArea>

                    {/* Atajos */}
                    <div className="flex h-9 items-center justify-between border-t border-border px-4 text-xs text-muted-foreground">
                        <div className="flex items-center gap-4">
                            <span className="flex items-center gap-1.5"><kbd className="rounded-sm bg-muted px-1 font-sans">↑↓</kbd>Navegar</span>
                            <span className="flex items-center gap-1.5"><kbd className="rounded-sm bg-muted px-1 font-sans">↵</kbd>Abrir</span>
                            <span className="flex items-center gap-1.5"><kbd className="rounded-sm bg-muted px-1 font-sans">Esc</kbd>Cerrar</span>
                        </div>
                        {filteredResults.length > 0 && (
                            <span>{filteredResults.length} resultados</span>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </>
    )
}
