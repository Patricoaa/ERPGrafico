"use client"

import { useEffect, useRef, useState } from "react"
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
    type LucideIcon,
} from "lucide-react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { useDebounce } from "@/hooks/use-debounce"
import { useUniversalSearch } from "@/features/search"

const ICON_MAP: Record<string, LucideIcon> = {
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

function EntityIcon({ name }: { name: string }) {
    const Icon = ICON_MAP[name] ?? Search
    return <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
}

export function UniversalSearch() {
    const [open, setOpen] = useState(false)
    const [query, setQuery] = useState("")
    const [activeIndex, setActiveIndex] = useState(0)
    const debouncedQuery = useDebounce(query, 200)
    const { results, isLoading } = useUniversalSearch(debouncedQuery)
    const router = useRouter()
    const inputRef = useRef<HTMLInputElement>(null)

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
            setTimeout(() => inputRef.current?.focus(), 50)
        }
    }, [open])

    useEffect(() => {
        setActiveIndex(0)
    }, [results])

    function navigate(url: string) {
        setOpen(false)
        router.push(url)
    }

    function handleKeyDown(e: React.KeyboardEvent) {
        if (e.key === "ArrowDown") {
            e.preventDefault()
            setActiveIndex((i) => Math.min(i + 1, results.length - 1))
        } else if (e.key === "ArrowUp") {
            e.preventDefault()
            setActiveIndex((i) => Math.max(i - 1, 0))
        } else if (e.key === "Enter" && results[activeIndex]) {
            navigate(results[activeIndex].detail_url)
        } else if (e.key === "Escape") {
            setOpen(false)
        }
    }

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                aria-label="Búsqueda universal (Ctrl+K)"
                className="flex items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
                <Search className="size-4" aria-hidden />
                <span className="hidden sm:inline">Buscar…</span>
                <kbd className="hidden rounded border border-border bg-background px-1 py-0.5 text-xs sm:inline">
                    Ctrl+K
                </kbd>
            </button>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent
                    className="max-w-lg gap-0 overflow-hidden p-0"
                    aria-label="Búsqueda universal"
                >
                    <DialogTitle className="sr-only">Búsqueda universal</DialogTitle>
                    <div className="flex items-center border-b border-border px-4 py-3">
                        <Search className="mr-3 size-4 shrink-0 text-muted-foreground" aria-hidden />
                        <input
                            ref={inputRef}
                            role="combobox"
                            aria-expanded={results.length > 0}
                            aria-controls="search-results"
                            aria-activedescendant={
                                results[activeIndex]
                                    ? `search-result-${activeIndex}`
                                    : undefined
                            }
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Buscar clientes, órdenes, productos…"
                            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                            autoComplete="off"
                            spellCheck={false}
                        />
                        {isLoading && (
                            <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Buscando…" />
                        )}
                    </div>

                    <ul
                        id="search-results"
                        role="listbox"
                        className="max-h-80 overflow-y-auto py-2"
                    >
                        {results.length === 0 && debouncedQuery.length >= 2 && !isLoading && (
                            <li className="px-4 py-6 text-center text-sm text-muted-foreground">
                                Sin resultados para &ldquo;{debouncedQuery}&rdquo;
                            </li>
                        )}
                        {results.map((result, index) => (
                            <li
                                key={`${result.label}-${result.id}`}
                                id={`search-result-${index}`}
                                role="option"
                                aria-selected={index === activeIndex}
                                onMouseEnter={() => setActiveIndex(index)}
                                onClick={() => navigate(result.detail_url)}
                                className={`flex cursor-pointer items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                                    index === activeIndex
                                        ? "bg-accent text-accent-foreground"
                                        : "text-foreground hover:bg-accent/50"
                                }`}
                            >
                                <EntityIcon name={result.icon} />
                                <span className="flex-1 truncate">{result.display}</span>
                            </li>
                        ))}
                    </ul>

                    {debouncedQuery.length < 2 && (
                        <p className="border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
                            Escribe al menos 2 caracteres para buscar
                        </p>
                    )}
                </DialogContent>
            </Dialog>
        </>
    )
}
