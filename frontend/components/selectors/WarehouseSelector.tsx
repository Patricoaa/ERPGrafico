"use client"

import { useState, useMemo, useCallback } from "react"
import { Check, Home } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ChevronDown } from "lucide-react"

import { useWarehouses } from "@/features/inventory/hooks/useWarehouses"
import { LabeledContainer, SearchablePopover } from '@/components/shared'
import { type Warehouse } from "@/types/entities"

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

    const { warehouses, isLoading } = useWarehouses()

    const selectedWarehouse = useMemo(() => {
        if (!value) return null
        return warehouses.find(w => w.id.toString() === value.toString())
    }, [warehouses, value])

    const filteredWarehouses = useMemo(() => {
        if (!searchTerm) return warehouses
        const term = searchTerm.toLowerCase()
        return warehouses.filter(w =>
            w.name.toLowerCase().includes(term) ||
            (w.code && w.code.toLowerCase().includes(term))
        )
    }, [warehouses, searchTerm])

    const handleSelect = useCallback((warehouse: Warehouse) => {
        onChange(warehouse.id.toString())
        setOpen(false)
        setSearchTerm("")
    }, [onChange])

    return (
        <LabeledContainer
            label={label}
            required={required}
            error={error}
            disabled={disabled}
            className={className}
            icon={icon}
        >
            <SearchablePopover
                open={open}
                onOpenChange={setOpen}
                searchValue={searchTerm}
                onSearchChange={setSearchTerm}
                searchPlaceholder="Buscar bodega..."
                items={filteredWarehouses}
                isLoading={isLoading}
                selectedId={value ? value.toString() : null}
                getId={(w) => w.id}
                onSelect={handleSelect}
                renderItem={(warehouse) => (
                    <>
                        <Home className="h-3.5 w-3.5 mr-2 text-muted-foreground shrink-0" />
                        <div className="flex flex-col flex-1 min-w-0">
                            <span className="font-medium">{warehouse.name}</span>
                            {warehouse.code && (
                                <span className="text-[10px] text-muted-foreground font-mono">{warehouse.code}</span>
                            )}
                        </div>
                        {selectedWarehouse?.id === warehouse.id && (
                            <Check className="ml-auto h-4 w-4 shrink-0 opacity-100" />
                        )}
                    </>
                )}
                trigger={
                    <Button
                        className={cn(
                            "w-full justify-between overflow-hidden h-[1.5rem] py-0 px-3 border-none shadow-none focus-visible:ring-0 bg-transparent hover:bg-transparent font-medium",
                            icon && "pl-1"
                        )}
                        disabled={disabled}
                    >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                            {icon && (
                                <div className="flex items-center justify-center text-muted-foreground/60 transition-colors shrink-0">
                                    {icon}
                                </div>
                            )}
                            {selectedWarehouse ? (
                                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                    {!icon && <Home className="h-3.5 w-3.5 shrink-0 text-primary" />}
                                    <span className="font-medium text-sm truncate">{selectedWarehouse.name}</span>
                                </div>
                            ) : (
                                <span className="text-muted-foreground truncate">{placeholder}</span>
                            )}
                        </div>
                        {!disabled && <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />}
                    </Button>
                }
            />
        </LabeledContainer>
    )
}
