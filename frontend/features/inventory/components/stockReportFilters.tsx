"use client"

import { useCallback } from 'react'
import { useQueryState, parseAsString } from 'nuqs'
import { ChevronDown, Warehouse, Tag } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useCategories, useWarehouses } from '@/features/inventory'

export function StockReportCategoryFilter() {
    const [categoryParam, setCategoryParam] = useQueryState('category', parseAsString)
    const { categories, isLoading } = useCategories()

    const selected = categories.find((c) => String(c.id) === categoryParam)

    const handleChange = useCallback(
        (value: string) => {
            setCategoryParam(value || null)
        },
        [setCategoryParam],
    )

    return (
        <div className="flex items-center shrink-0 bg-background rounded-sm px-1 h-9">
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="ghost"
                        size="sm"
                        className={cn(
                            'h-7 px-2 text-[10px] uppercase font-bold tracking-widest gap-1 rounded-sm shrink-0',
                            categoryParam
                                ? 'bg-accent/50 text-foreground'
                                : 'text-muted-foreground hover:text-foreground',
                        )}
                    >
                        <Tag className="h-3 w-3" />
                        <span className="truncate max-w-[80px]">
                            {selected?.name ?? 'Categoría'}
                        </span>
                        <ChevronDown className="h-3 w-3 shrink-0" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-[200px] p-1">
                    <DropdownMenuRadioGroup
                        value={categoryParam ?? ''}
                        onValueChange={handleChange}
                    >
                        <DropdownMenuRadioItem value="" className="text-[10px] uppercase tracking-widest">
                            Todas
                        </DropdownMenuRadioItem>
                        {!isLoading && categories.map((cat) => (
                            <DropdownMenuRadioItem
                                key={cat.id}
                                value={String(cat.id)}
                                className="text-[10px] uppercase tracking-widest"
                            >
                                {cat.name}
                            </DropdownMenuRadioItem>
                        ))}
                    </DropdownMenuRadioGroup>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    )
}

export function StockReportWarehouseFilter() {
    const [warehouseParam, setWarehouseParam] = useQueryState('warehouse_id', parseAsString)
    const { warehouses, isLoading } = useWarehouses()

    const selected = warehouses.find((w) => String(w.id) === warehouseParam)

    const handleChange = useCallback(
        (value: string) => {
            setWarehouseParam(value || null)
        },
        [setWarehouseParam],
    )

    return (
        <div className="flex items-center shrink-0 bg-background rounded-sm px-1 h-9">
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="ghost"
                        size="sm"
                        className={cn(
                            'h-7 px-2 text-[10px] uppercase font-bold tracking-widest gap-1 rounded-sm shrink-0',
                            warehouseParam
                                ? 'bg-accent/50 text-foreground'
                                : 'text-muted-foreground hover:text-foreground',
                        )}
                    >
                        <Warehouse className="h-3 w-3" />
                        <span className="truncate max-w-[80px]">
                            {selected?.name ?? 'Bodega'}
                        </span>
                        <ChevronDown className="h-3 w-3 shrink-0" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-[200px] p-1">
                    <DropdownMenuRadioGroup
                        value={warehouseParam ?? ''}
                        onValueChange={handleChange}
                    >
                        <DropdownMenuRadioItem value="" className="text-[10px] uppercase tracking-widest">
                            Todas
                        </DropdownMenuRadioItem>
                        {!isLoading && warehouses.map((wh) => (
                            <DropdownMenuRadioItem
                                key={wh.id}
                                value={String(wh.id)}
                                className="text-[10px] uppercase tracking-widest"
                            >
                                {wh.name}
                            </DropdownMenuRadioItem>
                        ))}
                    </DropdownMenuRadioGroup>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    )
}
