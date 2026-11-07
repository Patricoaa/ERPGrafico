"use client"

import { type ReactNode, type KeyboardEvent, useState, useRef, useEffect } from "react"
import { Search, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { CardSkeleton, EmptyState } from '@/components/shared'

export interface SearchablePopoverProps<TItem> {
    open: boolean
    onOpenChange: (open: boolean) => void
    trigger: ReactNode
    searchPlaceholder?: string
    searchValue: string
    onSearchChange: (value: string) => void
    /** Custom element rendered to the right of the search input */
    searchRightAction?: ReactNode
    /** Standard create button — renders a + icon to the right of the search */
    onCreate?: () => void
    /** Tooltip label for the create button. Default: "Nuevo…" */
    createLabel?: string
    items: TItem[]
    isLoading?: boolean
    loadingCount?: number
    emptyTitle?: string
    emptyContext?: 'search' | 'generic'
    renderItem: (item: TItem) => ReactNode
    onSelect: (item: TItem) => void
    selectedId?: string | number | null
    getId: (item: TItem) => string | number
    children?: ReactNode
    /** Slot rendered before the items list (e.g. action buttons, special entries) */
    beforeItems?: ReactNode
    className?: string
}

export function SearchablePopover<TItem>({
    open,
    onOpenChange,
    trigger,
    searchPlaceholder,
    searchValue,
    onSearchChange,
    searchRightAction,
    onCreate,
    createLabel,
    items,
    isLoading = false,
    loadingCount = 3,
    emptyTitle,
    emptyContext = "search",
    renderItem,
    onSelect,
    selectedId,
    getId,
    children,
    beforeItems,
    className,
}: SearchablePopoverProps<TItem>) {
    const [searchFocused, setSearchFocused] = useState(false)
    const listRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const el = listRef.current
        if (!el) return
        const stop = (e: WheelEvent) => e.stopPropagation()
        el.addEventListener('wheel', stop, { capture: true, passive: true })
        return () => el.removeEventListener('wheel', stop, { capture: true })
    }, [])

    return (
        <Popover open={open} onOpenChange={onOpenChange}>
            <PopoverTrigger asChild>
                {trigger}
            </PopoverTrigger>
            <PopoverContent
                className={cn("w-[var(--radix-popover-trigger-width)] p-0", className)}
                align="start"
            >
                <div className="p-2">
                    <div className="flex items-center gap-2 mb-2">
                        <div
                            className={cn(
                                "flex items-center flex-1 px-3 border rounded-md bg-background transition-colors",
                                searchFocused && "border-primary ring-1 ring-primary/20"
                            )}
                        >
                            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                            <input
                                className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
                                placeholder={searchPlaceholder}
                                value={searchValue}
                                onChange={(e) => onSearchChange(e.target.value)}
                                onFocus={() => setSearchFocused(true)}
                                onBlur={() => setSearchFocused(false)}
                                onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                                    if (e.key === "Escape") {
                                        onOpenChange(false)
                                    }
                                }}
                                autoFocus
                            />
                        </div>
                        {searchRightAction ?? (onCreate ? (
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="icon"
                                            className="h-10 w-10 shrink-0 border-dashed border-primary/50 text-primary hover:bg-primary/10 hover:border-primary transition-colors"
                                            onClick={onCreate}
                                        >
                                            <Plus className="h-4 w-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent><p>{createLabel ?? "Nuevo…"}</p></TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        ) : null)}
                    </div>

                    {children}

                    {beforeItems && (
                        <div className="space-y-1 mb-1">
                            {beforeItems}
                        </div>
                    )}

                    <div ref={listRef} className="max-h-[300px] overflow-y-auto space-y-1">
                        {isLoading ? (
                            <CardSkeleton count={loadingCount} variant="compact" />
                        ) : items.length === 0 ? (
                            <EmptyState
                                context={emptyContext}
                                variant="compact"
                                title={emptyTitle}
                            />
                        ) : (
                            items.map((item) => {
                                const id = getId(item)
                                const isSelected = selectedId != null && id === selectedId
                                return (
                                    <div
                                        key={id}
                                        className={cn(
                                            "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
                                            isSelected && "bg-accent"
                                        )}
                                        onClick={() => onSelect(item)}
                                    >
                                        {renderItem(item)}
                                    </div>
                                )
                            })
                        )}
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    )
}
