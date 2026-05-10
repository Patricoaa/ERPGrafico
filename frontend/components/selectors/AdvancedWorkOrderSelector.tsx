"use client"
import { formatEntityDisplay, getEntityIcon } from "@/lib/entity-registry"

import { useState, useEffect } from "react"
import { Check, ChevronDown, Search, Loader2, Eye, Calendar, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import api from "@/lib/api"
import { useDebounce } from "@/hooks/use-debounce"
import { format } from "date-fns"
import { TransactionViewModal } from "@/components/shared/TransactionViewModal"
import { useWorkOrderSearch } from "@/features/production/hooks/useWorkOrderSearch"
import { EmptyState } from "@/components/shared/EmptyState"
import { WorkOrder } from "@/types/entities"
// Removed LabeledContainer import as it's now internal




interface AdvancedWorkOrderSelectorProps {
    value?: string | number | null
    onChange: (value: string | null) => void
    disabled?: boolean
    label?: string
    error?: string
    required?: boolean
    placeholder?: string
    className?: string
}

export function AdvancedWorkOrderSelector({
    value,
    onChange,
    placeholder = "Vincular a Orden de Trabajo (Opcional)...",
    disabled = false,
    label,
    error,
    required,
    className
}: AdvancedWorkOrderSelectorProps) {
    const { orders, singleOrder, loading: searchLoading, fetchOrders, fetchSingleOrder } = useWorkOrderSearch()
    const [open, setOpen] = useState(false)
    const [previewOpen, setPreviewOpen] = useState(false)
    const [previewId, setPreviewId] = useState<number | null>(null)

    const [searchTerm, setSearchTerm] = useState("")
    const debouncedSearch = useDebounce(searchTerm, 500)

    const [selectedOrder, setSelectedOrder] = useState<WorkOrder | null>(null)

    // Fetch initial selected order if value exists
    useEffect(() => {
        if (value && !selectedOrder && value !== "__none__" && value !== "none" && value.toString() !== singleOrder?.id.toString()) {
            fetchSingleOrder(value.toString())
        } else if (!value || value === "__none__" || value === "none") {
            requestAnimationFrame(() => setSelectedOrder(null))
        }
    }, [value, selectedOrder, singleOrder, fetchSingleOrder])

    // Sync individual order
    useEffect(() => {
        if (singleOrder && singleOrder.id.toString() === value?.toString()) {
            requestAnimationFrame(() => setSelectedOrder(singleOrder))
        }
    }, [singleOrder, value])

    // Fetch orders on search
    useEffect(() => {
        if (open) {
            fetchOrders(debouncedSearch)
        }
    }, [debouncedSearch, open, fetchOrders])

    const handleSelect = (order: WorkOrder) => {
        setSelectedOrder(order)
        onChange(order.id.toString())
        setOpen(false)
        setSearchTerm("")
    }

    const openPreview = (e: React.MouseEvent, id: number) => {
        e.stopPropagation()
        setPreviewId(id)
        setPreviewOpen(true)
    }

    const clearSelection = (e: React.MouseEvent) => {
        e.stopPropagation()
        setSelectedOrder(null)
        onChange(null)
    }

    return (
        <div className={cn("relative w-full group", className)}>
            <fieldset 
                className={cn(
                    "notched-field w-full group transition-all border-dashed",
                    open && "focused",
                    error && "error",
                    disabled && "opacity-50 cursor-not-allowed bg-muted/10",
                    selectedOrder && "border-primary/20 bg-primary/10/30 border-solid"
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
                            variant="ghost"
                            role="combobox"
                            aria-expanded={open}
                            disabled={disabled}
                            className={cn(
                                "w-full justify-between overflow-hidden h-[1.5rem] py-0 px-3 border-none shadow-none focus-visible:ring-0 bg-transparent hover:bg-transparent",
                                disabled && "opacity-50 cursor-not-allowed"
                            )}
                        >
                        {selectedOrder ? (() => {
                            const OrderIcon = getEntityIcon('production.workorder');
                            return (
                                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                    <OrderIcon className="h-3.5 w-3.5 shrink-0 text-primary" />
                                    <span className="font-semibold text-sm text-primary shrink-0">{formatEntityDisplay('production.workorder', selectedOrder)}</span>
                                    <span className="text-sm text-muted-foreground truncate">{selectedOrder.product_name}</span>
                                </div>
                            );
                        })() : (
                            <span className="text-muted-foreground italic text-sm truncate">{placeholder}</span>
                        )}
                        <div className="flex items-center gap-2">
                            {selectedOrder && (
                                <div
                                    className="h-5 w-5 rounded-full bg-muted flex items-center justify-center hover:bg-destructive/10 hover:text-destructive transition-colors"
                                    onClick={clearSelection}
                                >
                                    <X className="h-3 w-3" />
                                </div>
                            )}
                            <ChevronDown className="h-4 w-4 shrink-0 opacity-40" />
                        </div>
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                    <div className="p-2">
                        <div className="flex items-center px-3 border rounded-md mb-2 bg-background">
                            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                            <input
                                className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
                                placeholder="Buscar por N° OT o Producto..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                autoFocus
                            />
                        </div>
                        <div className="max-h-[300px] overflow-y-auto space-y-1">
                        {searchLoading ? (
                            <div className="p-4 flex justify-center"><Loader2 className="h-4 w-4 animate-spin" /></div>
                        ) : orders.length === 0 ? (
                            <EmptyState
                                context="search"
                                variant="compact"
                                title={searchTerm ? "No se encontraron órdenes" : "Escriba para buscar"}
                            />
                        ) : (
                                orders.map((order) => (
                                    <div
                                        key={order.id}
                                        className={cn(
                                            "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground group",
                                            selectedOrder?.id === order.id && "bg-accent"
                                        )}
                                        onClick={() => handleSelect(order)}
                                    >
                                        <div className="flex items-center gap-3 w-full overflow-hidden">
                                            <div className="flex-shrink-0 p-2 bg-muted rounded-md group-hover:bg-background transition-colors">
                                                {(() => {
                                                    const OrderIcon = getEntityIcon('production.workorder');
                                                    return <OrderIcon className="h-4 w-4 text-primary" />;
                                                })()}
                                            </div>
                                            <div className="flex flex-col overflow-hidden flex-1">
                                                <div className="flex items-center justify-between">
                                                    <span className="truncate font-bold text-xs">{formatEntityDisplay('production.workorder', order)}</span>
                                                    <span className="text-[9px] font-mono text-muted-foreground">
                                                        {format(new Date(order.created_at), "dd/MM/yyyy")}
                                                    </span>
                                                </div>
                                                <span className="text-[10px] text-muted-foreground uppercase font-black truncate">
                                                    {order.product_name}
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    onClick={(e) => openPreview(e, order.id)}
                                                    title="Previsualizar"
                                                >
                                                    <Eye className="h-4 w-4 text-primary" />
                                                </Button>
                                                {selectedOrder?.id === order.id && (
                                                    <Check className="h-4 w-4 text-primary flex-shrink-0" />
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))
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

            {previewId && (
                <TransactionViewModal
                    open={previewOpen}
                    onOpenChange={setPreviewOpen}
                    type="work_order"
                    id={previewId}
                />
            )}
        </div>
    )
}
