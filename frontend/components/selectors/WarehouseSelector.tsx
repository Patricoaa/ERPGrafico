"use client"

import { useState, useMemo, useCallback } from "react"
import { Check, Home } from "lucide-react"
import { Button } from "@/components/ui/button"

import { useWarehouses } from "@/features/inventory/hooks/useWarehouses"
import { LabeledContainer, SearchablePopover, SelectorItem, SelectorTrigger, SELECTOR_VALUE_CLASS } from '@/components/shared'
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
    variant?: 'standalone' | 'inline'
    allowNone?: boolean
    noneLabel?: string
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
    icon,
    variant = 'standalone',
    allowNone = false,
    noneLabel = "Ninguna"
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

    const popover = (
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
            beforeItems={allowNone ? (
                <Button
                    variant="ghost"
                    className="w-full justify-start text-sm hover:bg-muted"
                    onClick={() => {
                        onChange(null)
                        setOpen(false)
                        setSearchTerm("")
                    }}
                >
                    <span className="text-muted-foreground">{noneLabel}</span>
                    {!value && (
                        <Check className="ml-auto h-4 w-4 shrink-0" />
                    )}
                </Button>
            ) : undefined}
            renderItem={(warehouse) => (
                <SelectorItem
                    icon={<Home className="h-3.5 w-3.5 text-muted-foreground" />}
                    title={warehouse.name}
                    subtitle={warehouse.code}
                    selected={selectedWarehouse?.id === warehouse.id}
                />
            )}
            trigger={
                <SelectorTrigger
                    hasValue={!!selectedWarehouse}
                    placeholder={placeholder}
                    variant={variant}
                    icon={icon}
                    open={open}
                    disabled={disabled}
                    showChevron={!disabled}
                    chevronClassName="h-3 w-3 opacity-30"
                    className={variant === 'standalone' ? "h-full!" : undefined}
                >
                    {!icon && <Home className="h-3.5 w-3.5 shrink-0 text-primary" />}
                    <span className={`${SELECTOR_VALUE_CLASS} truncate leading-none`}>{selectedWarehouse?.name}</span>
                </SelectorTrigger>
            }
        />
    )

    if (variant === 'inline') return popover

    return (
        <LabeledContainer
            label={label}
            required={required}
            error={error}
            disabled={disabled}
            className={className}
            icon={icon}
        >
            {popover}
        </LabeledContainer>
    )
}
