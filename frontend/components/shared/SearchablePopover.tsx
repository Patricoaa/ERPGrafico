"use client"

import { type ReactNode, type KeyboardEvent, useState } from "react"
import { Search } from "lucide-react"
import { cn } from "@/lib/utils"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { CardSkeleton, EmptyState } from '@/components/shared'

export interface SearchablePopoverProps<TItem> {
    open: boolean
    onOpenChange: (open: boolean) => void
    trigger: ReactNode
    searchPlaceholder?: string
    searchValue: string
    onSearchChange: (value: string) => void
    /** Element rendered to the right of the search input (e.g. a create button) */
    searchRightAction?: ReactNode
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
                        {searchRightAction}
                    </div>

                    {children}

                    {beforeItems && (
                        <div className="space-y-1 mb-1">
                            {beforeItems}
                        </div>
                    )}

                    <div className="max-h-[300px] overflow-y-auto space-y-1">
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
