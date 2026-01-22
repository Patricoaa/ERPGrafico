"use client"

import { useState, useEffect } from "react"
import { Check, ChevronsUpDown, Search, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { PricingUtils } from "@/lib/pricing"
import { Button } from "@/components/ui/button"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import api from "@/lib/api"
import { Badge } from "@/components/ui/badge"

interface ProductSelectorProps {
    value?: string | number | null
    onChange: (value: string | null) => void
    placeholder?: string
    productType?: string
    allowedTypes?: string[]
    disabled?: boolean
    restrictStock?: boolean
    excludeIds?: (string | number)[]
    context?: 'sale' | 'purchase'
    onSelect?: (product: any) => void
    customFilter?: (product: any) => boolean
    customDisabled?: (product: any) => boolean
    className?: string
}

export function ProductSelector({
    value,
    onChange,
    placeholder = "Seleccionar producto...",
    productType,
    allowedTypes,
    disabled = false,
    restrictStock = false,
    excludeIds = [],
    context,
    onSelect,
    customFilter,
    customDisabled,
    className
}: ProductSelectorProps) {
    const [open, setOpen] = useState(false)
    const [products, setProducts] = useState<any[]>([])
    const [filteredProducts, setFilteredProducts] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const [searchTerm, setSearchTerm] = useState("")
    const [selectedProduct, setSelectedProduct] = useState<any>(null)
    const [displayLimit, setDisplayLimit] = useState(20)

    useEffect(() => {
        const fetchProducts = async () => {
            setLoading(true)
            try {
                let url = `/inventory/products/?search=${encodeURIComponent(searchTerm)}`
                if (productType) {
                    url += `&product_type=${productType}`
                }

                if (context === 'sale') {
                    url += '&can_be_sold=true'
                } else if (context === 'purchase') {
                    url += '&can_be_purchased=true'
                }

                const res = await api.get(url)
                let allProducts = res.data.results || res.data

                if (allowedTypes && allowedTypes.length > 0) {
                    allProducts = allProducts.filter((p: any) => allowedTypes.includes(p.product_type))
                }

                if (excludeIds && excludeIds.length > 0) {
                    const excludedStrIds = excludeIds.map(id => id.toString())
                    allProducts = allProducts.filter((p: any) => !excludedStrIds.includes(p.id.toString()))
                }

                // Apply custom filter
                if (customFilter) {
                    allProducts = allProducts.filter(customFilter)
                }

                setProducts(allProducts)
                setFilteredProducts(allProducts)

                if (value) {
                    const found = allProducts.find((p: any) => p.id.toString() === value.toString())
                    if (found) setSelectedProduct(found)
                }
            } catch (error) {
                console.error("Error fetching products", error)
            } finally {
                setLoading(false)
            }
        }

        const timeoutId = setTimeout(() => {
            fetchProducts()
        }, 300)

        return () => clearTimeout(timeoutId)
    }, [value, productType, context, customFilter, excludeIds, searchTerm])

    const isStockRestricted = (product: any) => {
        if (!restrictStock) return false

        if (product.product_type === 'STORABLE') {
            return (product.current_stock || 0) <= 0
        }

        if (product.product_type === 'MANUFACTURABLE') {
            // Exception: If it has no BOM, it's always available for manufacturing (express)
            if (!product.has_bom) return false
            // If quantity is unknown (null/undefined), we assume it's available (or at least selectable)
            if (product.manufacturable_quantity === null || product.manufacturable_quantity === undefined) return false
            return (product.manufacturable_quantity || 0) <= 0
        }

        return false
    }

    const isCustomDisabled = (product: any) => {
        if (customDisabled && customDisabled(product)) {
            return true
        }
        return false
    }

    const handleSelect = (product: any) => {
        if (isStockRestricted(product) || isCustomDisabled(product)) {
            return;
        }

        setSelectedProduct(product)
        onChange(product ? product.id.toString() : null)
        if (onSelect) onSelect(product)
        setOpen(false)
    }

    const searchProducts = (val: string) => {
        setSearchTerm(val)
        const lowerVal = val.toLowerCase()

        setFilteredProducts(
            products.filter(p =>
                p.code.toLowerCase().includes(lowerVal) ||
                (p.internal_code && p.internal_code.toLowerCase().includes(lowerVal)) ||
                p.name.toLowerCase().includes(lowerVal)
            )
        )
        // Reset display limit when searching
        setDisplayLimit(20)
    }

    const handleLoadMore = () => {
        setDisplayLimit(prev => prev + 20)
    }

    return (
        <div className={cn("w-full min-w-0", className)}>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        disabled={disabled}
                        className="flex-1 justify-between h-9 px-3 min-w-0"
                    >
                        <div className="flex items-center gap-2 truncate">
                            {selectedProduct ? (
                                <span className="truncate">
                                    <span className="font-mono text-muted-foreground mr-2">{selectedProduct.internal_code || selectedProduct.code}</span>
                                    {selectedProduct.name}
                                </span>
                            ) : (
                                <span className="text-muted-foreground truncate">{placeholder}</span>
                            )}
                        </div>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[350px] p-0" align="start">
                    <div className="p-2">
                        <div className="flex items-center px-3 border rounded-md mb-2">
                            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                            <input
                                className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                                placeholder="Buscar código o nombre..."
                                value={searchTerm}
                                onChange={(e) => searchProducts(e.target.value)}
                            />
                        </div>
                        <div className="max-h-[400px] overflow-y-auto space-y-1" onScroll={(e) => {
                            const target = e.currentTarget
                            if (target.scrollHeight - target.scrollTop <= target.clientHeight + 50) {
                                if (displayLimit < filteredProducts.length) {
                                    handleLoadMore()
                                }
                            }
                        }}>
                            {loading ? (
                                <div className="p-4 flex justify-center"><Loader2 className="h-4 w-4 animate-spin" /></div>
                            ) : filteredProducts.length === 0 ? (
                                <div className="p-4 text-sm text-center">No se encontraron productos.</div>
                            ) : (
                                filteredProducts.slice(0, displayLimit).map((product) => {
                                    return (
                                        <div
                                            key={product.id}
                                            data-disabled={isStockRestricted(product) || isCustomDisabled(product)}
                                            className={cn(
                                                "relative flex cursor-default select-none items-start rounded-sm px-2 py-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50",
                                                selectedProduct?.id === product.id && "bg-accent"
                                            )}
                                            onClick={() => handleSelect(product)}
                                        >
                                            <Check
                                                className={cn(
                                                    "absolute left-2 top-3 h-4 w-4 opacity-0",
                                                    selectedProduct?.id === product.id && "opacity-100"
                                                )}
                                            />
                                            <div className="flex flex-col w-full ml-6">
                                                <div className="flex items-center justify-between">
                                                    <span className="font-medium">
                                                        {product.code} - {product.name}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between mt-1 items-center">
                                                    <div className="flex gap-1 flex-wrap">
                                                        {/* Stock Badge */}
                                                        {product.product_type === 'STORABLE' && (
                                                            <>
                                                                <Badge variant="outline" className={cn("text-[9px] px-1 h-4",
                                                                    (product.current_stock || 0) > 0 ? "border-emerald-500 text-emerald-600" : "border-red-200 text-red-400"
                                                                )}>
                                                                    Stock: {product.current_stock || 0}
                                                                </Badge>
                                                                <Badge variant="outline" className={cn("text-[9px] px-1 h-4",
                                                                    (product.qty_available || 0) > 0 ? "border-emerald-500 text-emerald-600" : "border-amber-500 text-amber-600"
                                                                )}>
                                                                    Disp: {product.qty_available || 0}
                                                                </Badge>
                                                            </>
                                                        )}

                                                        {/* Manufacturable Badge */}
                                                        {product.product_type === 'MANUFACTURABLE' && product.has_bom && (
                                                            <Badge variant="outline" className="text-[9px] px-1 h-4 border-blue-400 text-blue-600">
                                                                Fab: {product.manufacturable_quantity ?? 'N/A'}
                                                            </Badge>
                                                        )}
                                                        {product.product_type === 'MANUFACTURABLE' && !product.has_bom && (
                                                            <Badge variant="outline" className="text-[9px] px-1 h-4 border-blue-400 text-blue-600">
                                                                Fab: Express
                                                            </Badge>
                                                        )}
                                                    </div>

                                                    <span className="text-[10px] font-bold whitespace-nowrap ml-2">
                                                        {product.is_dynamic_pricing ? (
                                                            <Badge variant="outline" className="text-[9px] border-amber-500 text-amber-600 bg-amber-50 px-1 py-0 h-4">Precio Dinámico</Badge>
                                                        ) : (
                                                            <>
                                                                ${(Number(product.sale_price_gross) || PricingUtils.netToGross(Number(product.sale_price))).toLocaleString()}
                                                                <span className="text-[8px] text-muted-foreground ml-0.5">c/IVA</span>
                                                            </>
                                                        )}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })
                            )}
                            {displayLimit < filteredProducts.length && (
                                <div className="p-2 text-xs text-center text-muted-foreground border-t">
                                    Mostrando {displayLimit} de {filteredProducts.length} productos. Scroll para ver más...
                                </div>
                            )}
                        </div>
                    </div>
                </PopoverContent>
            </Popover>
        </div>
    )
}
