"use client"

import { useState, useMemo } from "react"
import { Check, ChevronDown, Search, Loader2, Home } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { useQuery } from "@tanstack/react-query"
import api from "@/lib/api"
import { EmptyState } from "@/components/shared/EmptyState"
import { Warehouse } from "@/types/entities"

interface WarehouseSelectorProps {
    value?: string | number | null
    onChange: (value: string | null) => void
    placeholder?: string
    disabled?: boolean
    label?: string
    error?: string
    required?: boolean
    className?: string
    icon?: React.ReactNode
}

export function WarehouseSelector({
    value,
    onChange,
    placeholder = "Seleccionar bodega...",
    disabled,
    label,
    error,
    required,
    className,
    icon
}: WarehouseSelectorProps) {
    const [open, setOpen] = useState(false)
    const [searchTerm, setSearchTerm] = useState("")

    const { data: warehouses = [], isLoading } = useQuery({
        queryKey: ['warehouses'],
        queryFn: async (): Promise<Warehouse[]> => {
            const response = await api.get('/inventory/warehouses/')
            return response.data.results || response.data
        },
    })

    const selectedWarehouse = useMemo(() => {
        if (!value) return null
        return warehouses.find(w => w.id.toString() === value.toString())
    }, [warehouses, value])

    const filteredWarehouses = useMemo(() => {
        let result = warehouses
        if (!searchTerm) return result
        const term = searchTerm.toLowerCase()
        return result.filter(w => 
            w.name.toLowerCase().includes(term) || 
            (w.code && w.code.toLowerCase().includes(term))
        )
    }, [warehouses, searchTerm])

    const handleSelect = (warehouse: Warehouse) => {
        onChange(warehouse.id.toString())
        setOpen(false)
        setSearchTerm("")
    }

    return (
        <div className={cn("relative w-full flex flex-col group", className)}>
            <fieldset 
                className={cn(
                    "notched-field w-full group transition-all",
                    open && "focused",
                    error && "error",
                    disabled && "opacity-50 cursor-not-allowed bg-muted/10"
                )}
            >
                {label && (
                    <legend className={cn("notched-legend", error && "text-destructive", disabled && "text-muted-foreground/50")}>
                        {label}
                        {required && <span className="ml-1 text-destructive">*</span>}
                    </legend>
                )}
                <Popover open={open} onOpenChange={setOpen}>
                    <PopoverTrigger asChild>
                        <Button
                            className={cn(
                                "w-full justify-between overflow-hidden h-[1.5rem] py-0 px-3 border-none shadow-none focus-visible:ring-0 bg-transparent hover:bg-transparent font-medium",
                                icon && "pl-1"
                            )}
                            disabled={disabled}
                        >
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                {icon && (
                                    <div className="flex items-center justify-center text-muted-foreground/60 group-focus-within:text-primary transition-colors shrink-0">
                                        {icon}
                                    </div>
                                )}
                                {selectedWarehouse ? (
                                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                        {!icon && <Home className={cn("h-3.5 w-3.5 shrink-0", disabled ? "text-muted-foreground" : "text-primary")} />}
                                        <span className="font-medium text-sm truncate">{selectedWarehouse.name}</span>
                                    </div>
                                ) : (
                                    <span className="text-muted-foreground truncate">{placeholder}</span>
                                )}
                            </div>
                            {!disabled && <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                        <div className="p-2">
                            <div className="flex items-center px-3 border rounded-md mb-2 bg-background">
                                <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                                <input
                                    className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
                                    placeholder="Buscar bodega..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    autoFocus
                                />
                            </div>
                            <div className="max-h-[300px] overflow-y-auto space-y-1">
                                {isLoading ? (
                                    <div className="p-4 flex justify-center"><Loader2 className="h-4 w-4 animate-spin text-primary" /></div>
                                ) : (
                                    <>
                                        {filteredWarehouses.length === 0 ? (
                                            <EmptyState context="inventory" variant="compact" title="No se encontraron bodegas" />
                                        ) : (
                                            filteredWarehouses.map((w) => (
                                                <div
                                                    key={w.id}
                                                    className={cn(
                                                        "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
                                                        selectedWarehouse?.id === w.id && "bg-accent"
                                                    )}
                                                    onClick={() => handleSelect(w)}
                                                >
                                                    <Home className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                                                    <div className="flex flex-col">
                                                        <span className="font-medium">{w.name}</span>
                                                        {w.code && <span className="text-[10px] text-muted-foreground font-mono">{w.code}</span>}
                                                    </div>
                                                    {selectedWarehouse?.id === w.id && (
                                                        <Check className="ml-auto h-4 w-4 opacity-100" />
                                                    )}
                                                </div>
                                            ))
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    </PopoverContent>
                </Popover>
            </fieldset>
            {error && (
                <p className="mt-1.5 text-[11px] font-medium text-destructive animate-in fade-in slide-in-from-top-1 w-full text-left px-1">
                    {error}
                </p>
            )}
        </div>
    )
}
