"use client"

import { useState, useEffect } from "react"
import { Check, ChevronsUpDown, Search, Loader2, Package, Eye, Calendar, X, ClipboardList } from "lucide-react"
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

interface WorkOrder {
    id: number
    number: string
    product_name: string
    created_at: string
    status: string
}

interface AdvancedWorkOrderSelectorProps {
    value?: string | number | null
    onChange: (value: string | null) => void
    placeholder?: string
    disabled?: boolean
}

export function AdvancedWorkOrderSelector({
    value,
    onChange,
    placeholder = "Vincular a Orden de Trabajo (Opcional)...",
    disabled = false
}: AdvancedWorkOrderSelectorProps) {
    const [open, setOpen] = useState(false)
    const [previewOpen, setPreviewOpen] = useState(false)
    const [previewId, setPreviewId] = useState<number | null>(null)

    const [orders, setOrders] = useState<WorkOrder[]>([])
    const [loading, setLoading] = useState(false)
    const [searchTerm, setSearchTerm] = useState("")
    const debouncedSearch = useDebounce(searchTerm, 500)

    const [selectedOrder, setSelectedOrder] = useState<WorkOrder | null>(null)

    // Fetch initial selected order if value exists
    useEffect(() => {
        const fetchSelected = async () => {
            if (value && !selectedOrder && value !== "__none__" && value !== "none") {
                try {
                    const res = await api.get(`/production/orders/${value}/`)
                    setSelectedOrder(res.data)
                } catch (e) {
                    console.error("Failed to fetch selected work order", e)
                }
            } else if (!value || value === "__none__" || value === "none") {
                setSelectedOrder(null)
            }
        }
        fetchSelected()
    }, [value])

    // Fetch orders on search
    useEffect(() => {
        const fetchOrders = async () => {
            setLoading(true)
            try {
                const params = new URLSearchParams()
                if (debouncedSearch) params.append('search', debouncedSearch)

                // Only active OTs (not cancelled)
                params.append('status_exclude', 'CANCELLED')

                const res = await api.get(`/production/orders/?${params.toString()}`)
                setOrders(res.data.results || res.data)
            } catch (error) {
                console.error("Error searching work orders", error)
            } finally {
                setLoading(false)
            }
        }

        if (open) {
            fetchOrders()
        }
    }, [debouncedSearch, open])

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
        <>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        disabled={disabled}
                        className={cn(
                            "w-full justify-between h-auto py-2 px-3 bg-background border-dashed hover:border-indigo-400 transition-colors",
                            selectedOrder && "border-primary/20 bg-primary/10/30",
                            disabled && "opacity-50 cursor-not-allowed"
                        )}
                    >
                        {selectedOrder ? (
                            <div className="flex items-center gap-2 truncate text-left">
                                <div className="p-1.5 rounded-lg bg-primary/10 text-primary shrink-0">
                                    <ClipboardList className="h-4 w-4" />
                                </div>
                                <div className="flex flex-col items-start truncate leading-tight">
                                    <span className="font-medium text-sm truncate w-full text-primary">OT-{selectedOrder.number}</span>
                                    <span className="text-[10px] text-muted-foreground truncate w-full leading-tight">
                                        {selectedOrder.product_name}
                                    </span>
                                </div>
                            </div>
                        ) : (
                            <span className="text-muted-foreground italic text-sm">{placeholder}</span>
                        )}
                        <div className="flex items-center gap-2">
                            {selectedOrder && (
                                <div
                                    className="h-5 w-5 rounded-full bg-muted flex items-center justify-center hover:bg-red-100 hover:text-destructive transition-colors"
                                    onClick={clearSelection}
                                >
                                    <X className="h-3 w-3" />
                                </div>
                            )}
                            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-40" />
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
                            {loading ? (
                                <div className="p-4 flex justify-center"><Loader2 className="h-4 w-4 animate-spin" /></div>
                            ) : orders.length === 0 ? (
                                <div className="p-4 text-sm text-center text-muted-foreground">
                                    {searchTerm ? "No se encontraron órdenes." : "Escriba para buscar..."}
                                </div>
                            ) : (
                                orders.map((order) => (
                                    <div
                                        key={order.id}
                                        className={cn(
                                            "relative flex cursor-pointer select-none items-center rounded-lg px-2 py-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground group",
                                            selectedOrder?.id === order.id && "bg-accent"
                                        )}
                                        onClick={() => handleSelect(order)}
                                    >
                                        <div className="flex items-center gap-3 w-full overflow-hidden">
                                            <div className="flex-shrink-0 p-2 bg-muted rounded-md group-hover:bg-background transition-colors">
                                                <Package className="h-4 w-4 text-primary" />
                                            </div>
                                            <div className="flex flex-col overflow-hidden flex-1">
                                                <div className="flex items-center justify-between">
                                                    <span className="truncate font-bold text-xs">OT-{order.number}</span>
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

            {previewId && (
                <TransactionViewModal
                    open={previewOpen}
                    onOpenChange={setPreviewOpen}
                    type="work_order"
                    id={previewId}
                />
            )}
        </>
    )
}
