"use client"
import { formatEntityDisplay, getEntityIcon } from "@/lib/entity-registry"

import { useState, useEffect } from "react"
import { Check, ChevronDown, Eye } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useDebounce } from "@/hooks/useDebounce"
import { format } from "date-fns"
import { SaleOrderDrawer } from "@/features/sales/components/SaleOrderDrawer"

import { useSaleOrderSearch } from "@/features/orders/hooks/useSaleOrderSearch"
import { LabeledContainer, SearchablePopover } from '@/components/shared'
import { type SaleOrder } from "@/types/entities"

const SaleOrderIcon = getEntityIcon('sales.saleorder')

interface AdvancedSaleOrderSelectorProps {
    value?: string | number | null
    onChange: (value: string | null) => void
    placeholder?: string
    disabled?: boolean
    customFilter?: (order: any) => boolean
    label?: string
    error?: string
    className?: string
    icon?: React.ReactNode
}

export function AdvancedSaleOrderSelector({
    value,
    onChange,
    placeholder = "Seleccionar nota de venta...",
    disabled = false,
    customFilter,
    label,
    error,
    className,
    icon
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
        <LabeledContainer
            label={label}
            error={error}
            disabled={disabled}
            className={className}
        >
            <div className="flex items-center w-full">
                {icon && (
                    <div className="pl-2.5 flex items-center justify-center text-muted-foreground/60 transition-colors shrink-0 leading-none">
                        {icon}
                    </div>
                )}
                <SearchablePopover
                    open={open}
                    onOpenChange={setOpen}
                    searchValue={searchTerm}
                    onSearchChange={setSearchTerm}
                    searchPlaceholder="Buscar por N° Nota o Cliente..."
                    items={orders}
                    isLoading={searchLoading}
                    selectedId={selectedOrder ? selectedOrder.id.toString() : null}
                    getId={(o) => o.id}
                    onSelect={handleSelect}
                    emptyTitle={searchTerm ? "No se encontraron notas" : "Escriba para buscar"}
                    renderItem={(order) => (
                        <div className="flex items-center gap-3 w-full overflow-hidden">
                            <div className="flex-shrink-0 p-2 bg-muted rounded-md">
                                <SaleOrderIcon className="h-4 w-4 text-primary" />
                            </div>
                            <div className="flex flex-col overflow-hidden flex-1">
                                <div className="flex items-center justify-between">
                                    <span className="truncate font-bold">{formatEntityDisplay('sales.saleorder', order as unknown as Record<string, unknown>)}</span>
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
                    )}
                    trigger={
                        <Button
                            variant="ghost"
                            role="combobox"
                            aria-expanded={open}
                            disabled={disabled}
                            className={cn(
                                "w-full justify-between overflow-hidden h-[1.5rem] py-0 px-3 border-none shadow-none focus-visible:ring-0 bg-transparent hover:bg-transparent",
                                disabled && "opacity-50 cursor-not-allowed",
                                icon && "pl-1.5"
                            )}
                        >
                            {selectedOrder ? (
                                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                    <SaleOrderIcon className="h-3.5 w-3.5 shrink-0 text-primary" />
                                    <span className="font-semibold text-sm shrink-0">{formatEntityDisplay('sales.saleorder', selectedOrder as unknown as Record<string, unknown>)}</span>
                                    <span className="text-sm text-muted-foreground truncate">{selectedOrder.customer_name}</span>
                                </div>
                            ) : (
                                <span className="text-muted-foreground truncate">{placeholder}</span>
                            )}
                            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                    }
                />
            </div>

            {previewId && (
                <SaleOrderDrawer
                    id={previewId}
                    open={previewOpen}
                    onOpenChange={setPreviewOpen}
                />
            )}
        </LabeledContainer>
    )
}
