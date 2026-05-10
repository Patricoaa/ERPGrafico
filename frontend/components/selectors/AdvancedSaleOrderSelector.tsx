"use client"
import { formatEntityDisplay } from "@/lib/entity-registry"

import { useState, useEffect } from "react"
import { Check, ChevronDown, Search, Loader2, ShoppingBag, Eye, Calendar, FileText } from "lucide-react"
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
import { Badge } from "@/components/ui/badge"
import { useSaleOrderSearch } from "@/features/orders/hooks/useSaleOrderSearch"
import { EmptyState } from "@/components/shared/EmptyState"
import { SaleOrder } from "@/types/entities"



interface AdvancedSaleOrderSelectorProps {
    value?: string | number | null
    onChange: (value: string | null) => void
    placeholder?: string
    disabled?: boolean
    customFilter?: (order: any) => boolean
    label?: string
    error?: string
    className?: string
}

export function AdvancedSaleOrderSelector({
    value,
    onChange,
    placeholder = "Seleccionar nota de venta...",
    disabled = false,
    customFilter,
    label,
    error,
    className
}: AdvancedSaleOrderSelectorProps) {
    const { orders: rawOrders, singleOrder, loading: searchLoading, fetchOrders, fetchSingleOrder } = useSaleOrderSearch()
    const [open, setOpen] = useState(false)
    const [previewOpen, setPreviewOpen] = useState(false)
    const [previewId, setPreviewId] = useState<number | null>(null)

    const [orders, setOrders] = useState<SaleOrder[]>([])
    const [searchTerm, setSearchTerm] = useState("")
    const debouncedSearch = useDebounce(searchTerm, 500)

    const [selectedOrder, setSelectedOrder] = useState<SaleOrder | null>(null)

    // Fetch initial selected order if value exists
    useEffect(() => {
        if (value && !selectedOrder && value !== "__none__" && value !== "none" && value.toString() !== singleOrder?.id?.toString()) {
            fetchSingleOrder(value.toString())
        } else if (!value || value === "__none__" || value === "none") {
            requestAnimationFrame(() => setSelectedOrder(null))
        }
    }, [value, selectedOrder, singleOrder, fetchSingleOrder])

    // Sync selected
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

    // Filter
    useEffect(() => {
        let allOrders = [...rawOrders]
        if (customFilter) {
            allOrders = allOrders.filter(customFilter)
        }
        requestAnimationFrame(() => setOrders(allOrders))
    }, [rawOrders, customFilter])

    const handleSelect = (order: SaleOrder) => {
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
                        {selectedOrder ? (
                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                <FileText className="h-3.5 w-3.5 shrink-0 text-primary" />
                                <span className="font-semibold text-sm shrink-0">{formatEntityDisplay('sales.saleorder', selectedOrder)}</span>
                                <span className="text-sm text-muted-foreground truncate">{selectedOrder.customer_name}</span>
                            </div>
                        ) : (
                            <span className="text-muted-foreground truncate">{placeholder}</span>
                        )}
                        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                    <div className="p-2">
                        <div className="flex items-center px-3 border rounded-md mb-2 bg-background">
                            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                            <input
                                className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                                placeholder="Buscar por N° Nota o Cliente..."
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
                                title={searchTerm ? "No se encontraron notas" : "Escriba para buscar"}
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
                                                <ShoppingBag className="h-4 w-4 text-primary" />
                                            </div>
                                            <div className="flex flex-col overflow-hidden flex-1">
                                                <div className="flex items-center justify-between">
                                                    <span className="truncate font-bold">{formatEntityDisplay('sales.saleorder', order)}</span>
                                                    <span className="text-[10px] font-mono text-muted-foreground">
                                                        {format(new Date(order.created_at), "dd/MM/yyyy")}
                                                    </span>
                                                </div>
                                                <span className="text-[10px] text-muted-foreground uppercase font-black truncate">
                                                    {order.customer_name}
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
                    type="sale_order"
                    id={previewId}
                />
            )}
        </div>
    )
}
