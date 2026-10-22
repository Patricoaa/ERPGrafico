"use client"

import { useState, useMemo, useCallback } from "react"
import { Check, Home } from "lucide-react"

import { useWarehouses } from "@/features/inventory/hooks/useWarehouses"
import { LabeledContainer, SearchablePopover } from '@/components/shared'
import { SelectorTrigger, SELECTOR_VALUE_CLASS } from "@/components/shared/SelectorTrigger"
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
    placeholder = "Seleccionar...",
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
                                <span className="text-3xs text-muted-foreground font-mono">{warehouse.code}</span>
                            )}
                        </div>
                        {selectedWarehouse?.id === warehouse.id && (
                            <Check className="ml-auto h-4 w-4 shrink-0 opacity-100" />
                        )}
                    </>
                )}
                trigger={
                    <SelectorTrigger
                        hasValue={!!selectedWarehouse}
                        placeholder={placeholder}
                        icon={icon}
                        open={open}
                        disabled={disabled}
                        showChevron={!disabled}
                        chevronClassName="h-3 w-3 opacity-30"
                        className="h-full!"
                    >
                        {!icon && <Home className="h-3.5 w-3.5 shrink-0 text-primary" />}
                        <span className={`${SELECTOR_VALUE_CLASS} truncate leading-none`}>{selectedWarehouse?.name}</span>
                    </SelectorTrigger>
                }
            />
        </LabeledContainer>
    )
}
