"use client"

import { useState, useEffect } from "react"
import { Check, ChevronsUpDown, Search, Loader2, ShoppingBag, Eye, Calendar, FileText } from "lucide-react"
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
}

export function AdvancedSaleOrderSelector({
    value,
    onChange,
    placeholder = "Seleccionar nota de venta...",
    disabled = false,
    customFilter
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
        <>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        disabled={disabled}
                        className={cn(
                            "w-full justify-between h-auto py-2 px-3 bg-background",
                            disabled && "opacity-50 cursor-not-allowed"
                        )}
                    >
                        {selectedOrder ? (
                             <div className="flex items-center gap-2 truncate text-left">
                                <div className="p-1.5 rounded-md bg-primary/10 text-primary shrink-0">
                                    <FileText className="h-4 w-4" />
                                </div>
                                <div className="flex flex-col items-start truncate leading-tight">
                                    <span className="font-medium text-sm truncate w-full">NV-{selectedOrder.number}</span>
                                    <span className="text-[10px] text-muted-foreground truncate w-full leading-tight">
                                        {selectedOrder.customer_name}
                                    </span>
                                </div>
                            </div>
                        ) : (
                            <span className="text-muted-foreground">{placeholder}</span>
                        )}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
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
                                                    <span className="truncate font-bold">NV-{order.number}</span>
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

            {previewId && (
                <TransactionViewModal
                    open={previewOpen}
                    onOpenChange={setPreviewOpen}
                    type="sale_order"
                    id={previewId}
                />
            )}
        </>
    )
}
