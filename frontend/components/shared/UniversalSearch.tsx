"use client"

import { useEffect, useRef, useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import {
    BookOpen,
    CircleCheck,
    FileBadge,
    FileText,
    Landmark,
    Loader2,
    NotebookPen,
    Package,
    ReceiptText,
    Search,
    ShoppingCart,
    Truck,
    Undo2,
    UserCheck,
    Users,
    Wallet,
    Wrench,
    Command as CommandIcon,
    ArrowRight,
    CornerDownLeft,
    X,
} from "lucide-react"
import { Dialog, DialogContent, DialogTitle, DialogPortal, DialogOverlay } from "@/components/ui/dialog"
import { useDebounce } from "@/hooks/use-debounce"
import { useUniversalSearch } from "@/features/search"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"
import { DynamicIcon } from "@/components/ui/dynamic-icon"

const ICON_MAP: Record<string, any> = {
    "book-open": BookOpen,
    "circle-check": CircleCheck,
    "file-badge": FileBadge,
    "file-text": FileText,
    "landmark": Landmark,
    "notebook-pen": NotebookPen,
    "package": Package,
    "receipt-text": ReceiptText,
    "shopping-cart": ShoppingCart,
    "truck": Truck,
    "undo-2": Undo2,
    "user-check": UserCheck,
    "users": Users,
    "wallet": Wallet,
    "wrench": Wrench,
}

export function UniversalSearch() {
    const [open, setOpen] = useState(false)
    const [query, setQuery] = useState("")
    const [activeIndex, setActiveIndex] = useState(0)
    const [selectedType, setSelectedType] = useState<string | null>(null)
    const debouncedQuery = useDebounce(query, 200)
    const { results, isLoading } = useUniversalSearch(debouncedQuery)
    const router = useRouter()
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

    useEffect(() => {
        if (open) {
            setQuery("")
            setActiveIndex(0)
            setSelectedType(null)
            setTimeout(() => inputRef.current?.focus(), 50)
        }
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
        setActiveIndex(0)
    }, [filteredResults, selectedType])

    function navigate(url: string) {
        setOpen(false)
        router.push(url)
    }

    function handleKeyDown(e: React.KeyboardEvent) {
        if (e.key === "ArrowDown") {
            e.preventDefault()
            setActiveIndex((i) => Math.min(i + 1, filteredResults.length - 1))
        } else if (e.key === "ArrowUp") {
            e.preventDefault()
            setActiveIndex((i) => Math.max(i - 1, 0))
        } else if (e.key === "Enter" && filteredResults[activeIndex]) {
            navigate(filteredResults[activeIndex].detail_url)
        } else if (e.key === "Escape") {
            if (query) {
                setQuery("")
            } else {
                setOpen(false)
            }
        }
    }

    return (
        <>
            {/* Wider Trigger Button */}
            <button
                type="button"
                onClick={() => setOpen(true)}
                aria-label="Búsqueda universal (Ctrl+K)"
                className="group relative flex w-12 items-center gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground transition-all hover:bg-muted/50 hover:ring-2 hover:ring-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 sm:w-full sm:max-w-[600px]"
            >
                <Search className="size-4 transition-colors group-hover:text-foreground" aria-hidden />
                <span className="hidden flex-1 text-left sm:inline">Buscar clientes, productos, órdenes o cualquier documento...</span>
                <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
                    <span className="text-xs">⌘</span>K
                </kbd>
            </button>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogPortal>
                    <DialogOverlay className="bg-black/40 backdrop-blur-md" />
                    <DialogContent
                        size="xl"
                        showCloseButton={false}
                        className="gap-0 overflow-hidden border-none p-0 shadow-2xl backdrop-blur-3xl dark:bg-black/95"
                        aria-label="Búsqueda universal"
                    >
                        <DialogTitle className="sr-only">Búsqueda universal</DialogTitle>

                        {/* Progress Bar Loader */}
                        {isLoading && (
                            <div className="absolute top-0 left-0 h-[2px] w-full overflow-hidden bg-primary/20">
                                <div className="h-full bg-primary animate-pulse w-full" />
                            </div>
                        )}

                        {/* Search Input Area */}
                        <div className="relative flex items-center border-b border-white/5 px-6 py-8">
                            <Search className="mr-4 size-8 shrink-0 text-muted-foreground/60" aria-hidden />
                            <input
                                ref={inputRef}
                                role="combobox"
                                aria-expanded={filteredResults.length > 0}
                                aria-controls="search-results"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Busca por número, nombre, RUT o código..."
                                className="flex-1 bg-transparent text-3xl font-light outline-none placeholder:text-muted-foreground/30"
                                autoComplete="off"
                                spellCheck={false}
                            />
                            {isLoading ? (
                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                                    <Loader2 className="size-6 animate-spin text-primary" />
                                </div>
                            ) : (
                                <div className="flex items-center gap-3">
                                    <button onClick={() => setOpen(false)} className="rounded-full p-2 hover:bg-white/10">
                                        <X className="size-6 text-muted-foreground" />
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Segmenters (Tabs) - Horizontal Scrollable */}
                        {results.length > 0 && (
                            <div className="flex items-center border-b border-white/5 bg-black/20 px-6 py-3">
                                <div className="flex w-full items-center gap-2 overflow-x-auto flex-nowrap scrollbar-none [ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden pb-1">
                                    <button
                                        onClick={() => setSelectedType(null)}
                                        className={cn(
                                            "flex shrink-0 items-center gap-2 rounded-lg px-4 py-2 text-xs font-medium transition-all",
                                            !selectedType
                                                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                                                : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                                        )}
                                    >
                                        Todos
                                    </button>
                                    {entityTypes.map((type) => (
                                        <button
                                            key={type.label}
                                            onClick={() => setSelectedType(type.label)}
                                            className={cn(
                                                "flex shrink-0 items-center gap-2 rounded-lg px-4 py-2 text-xs font-medium transition-all",
                                                selectedType === type.label
                                                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                                                    : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                                            )}
                                        >
                                            {type.icon && <DynamicIcon name={type.icon} className="size-3" />}
                                            {type.title_plural}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Results List - Fixed Height for 5 items (5 * 64px = 320px) */}
                        <ScrollArea className="h-[320px]">
                            <ul
                                id="search-results"
                                role="listbox"
                                className="divide-y divide-white/5"
                            >
                                {isLoading && (
                                    <>
                                        {[...Array(5)].map((_, i) => (
                                            <li key={i} className="flex items-center gap-4 px-6 py-4">
                                                <Skeleton className="size-10 rounded-full" />
                                                <div className="flex-1 space-y-2">
                                                    <Skeleton className="h-4 w-[40%]" />
                                                    <Skeleton className="h-3 w-[20%]" />
                                                </div>
                                                <Skeleton className="h-6 w-20 rounded-full" />
                                            </li>
                                        ))}
                                    </>
                                )}

                                {!isLoading && filteredResults.length === 0 && debouncedQuery.length >= 2 && (
                                <li className="flex h-full flex-col items-center justify-center py-20 text-center">
                                    <div className="mb-4 rounded-full bg-muted/20 p-6">
                                        <Search className="size-10 text-muted-foreground/30" />
                                    </div>
                                    <p className="text-base font-medium text-foreground">
                                        No se encontraron coincidencias
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                        Intenta con términos más generales
                                    </p>
                                </li>
                            )}

                            {!isLoading && filteredResults.length === 0 && debouncedQuery.length < 2 && (
                                <li className="flex flex-col items-center justify-center py-24 text-center">
                                    <div className="relative mb-6 flex h-24 w-24 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 shadow-2xl">
                                        <div className="absolute inset-0 animate-pulse rounded-2xl bg-primary/5 blur-xl" />
                                        <span className="relative bg-gradient-to-br from-primary to-primary/50 bg-clip-text text-4xl font-black tracking-tighter text-transparent">
                                            EG
                                        </span>
                                    </div>
                                    <h3 className="mb-2 text-xl font-semibold tracking-tight text-foreground">
                                        ERPGrafico
                                    </h3>
                                    <p className="max-w-[300px] text-sm text-muted-foreground">
                                        Ingresa un número de documento, nombre de cliente o código de producto para comenzar.
                                    </p>
                                </li>
                            )}

                            {filteredResults.map((result, index) => (
                                <li
                                    key={`${result.label}-${result.id}`}
                                    id={`search-result-${index}`}
                                    role="option"
                                    aria-selected={index === activeIndex}
                                    onMouseEnter={() => setActiveIndex(index)}
                                    onClick={() => navigate(result.detail_url)}
                                    className={cn(
                                        "group flex cursor-pointer items-center gap-4 px-4 py-3 transition-all",
                                        index === activeIndex
                                            ? "bg-white/5"
                                            : "hover:bg-white/5"
                                    )}
                                >
                                    <div className="relative">
                                        <Avatar className="size-10 border border-white/10 transition-transform group-hover:scale-105">
                                            <AvatarFallback className="bg-muted/50 text-xs font-semibold">
                                                <DynamicIcon name={result.icon} className="size-4" />
                                            </AvatarFallback>
                                        </Avatar>
                                        {index === activeIndex && (
                                            <div className="absolute -left-1 top-1/2 h-4 w-1 -translate-y-1/2 rounded-full bg-primary" />
                                        )}
                                    </div>

                                    <div className="flex flex-1 flex-col gap-0.5 overflow-hidden">
                                        <div className="flex items-center gap-2">
                                            <span className="truncate font-semibold text-foreground">
                                                {result.display}
                                            </span>
                                            {result.extra_info && (
                                                <Badge variant="outline" className="hidden h-5 bg-primary/5 text-[10px] text-primary sm:flex">
                                                    {result.extra_info}
                                                </Badge>
                                            )}
                                        </div>
                                        <span className="truncate text-xs text-muted-foreground">
                                            {result.subtitle || result.title}
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <span className="hidden text-[10px] font-medium uppercase tracking-wider text-muted-foreground/40 sm:block">
                                            {result.title}
                                        </span>
                                        <ArrowRight className={cn(
                                            "size-4 text-muted-foreground/20 transition-all",
                                            index === activeIndex && "translate-x-1 text-primary"
                                        )} />
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </ScrollArea>

                    {/* Footer */}
                    <div className="flex items-center justify-between border-t border-white/5 bg-black/40 px-4 py-3 text-[10px]">
                        <div className="flex items-center gap-4 text-muted-foreground">
                            <span className="flex items-center gap-1.5">
                                <kbd className="rounded bg-white/10 px-1 py-0.5 text-[9px] font-medium text-foreground">↑↓</kbd>
                                Navegar
                            </span>
                            <span className="flex items-center gap-1.5">
                                <kbd className="rounded bg-white/10 px-1 py-0.5 text-[9px] font-medium text-foreground flex items-center justify-center w-5">
                                    <CornerDownLeft className="size-2.5" />
                                </kbd>
                                Seleccionar
                            </span>
                            <span className="flex items-center gap-1.5">
                                <kbd className="rounded bg-white/10 px-2 py-0.5 text-[9px] font-medium text-foreground">⌘K</kbd>
                                Cerrar
                            </span>
                        </div>

                        {filteredResults.length > 0 && (
                            <div className="text-muted-foreground">
                                <span className="font-medium text-foreground">{filteredResults.length}</span> resultados encontrados
                            </div>
                        )}
                    </div>
                    </DialogContent>
                </DialogPortal>
            </Dialog>
        </>
    )
}
