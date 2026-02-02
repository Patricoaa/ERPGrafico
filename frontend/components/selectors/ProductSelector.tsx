"use client"

import { useState, useEffect } from "react"
import { Check, ChevronsUpDown, Search, Loader2, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { PricingUtils } from "@/lib/pricing"
import { Button } from "@/components/ui/button"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
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
    excludeVariantTemplates?: boolean
    onSelect?: (product: any) => void
    customFilter?: (product: any) => boolean
    customDisabled?: (product: any) => boolean
    className?: string
}

const EMPTY_ARRAY: any[] = []

export function ProductSelector({
    value,
    onChange,
    placeholder = "Seleccionar producto...",
    productType,
    allowedTypes = EMPTY_ARRAY,
    disabled = false,
    restrictStock = false,
    excludeIds = EMPTY_ARRAY,
    context,
    excludeVariantTemplates = false,
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

    // Variant Selection state
    const [isVariantDialogOpen, setIsVariantDialogOpen] = useState(false)
    const [templateToResolve, setTemplateToResolve] = useState<any>(null)

    // Effect to fetch the selected product if it's missing but we have a value
    useEffect(() => {
        const fetchSingleProduct = async () => {
            if (value && (!selectedProduct || selectedProduct.id.toString() !== value.toString())) {
                try {
                    const res = await api.get(`/inventory/products/${value}/`)
                    setSelectedProduct(res.data)
                } catch (error) {
                    console.error("Error fetching single product", error)
                }
            } else if (!value) {
                setSelectedProduct(null)
            }
        }
        fetchSingleProduct()
    }, [value])

    // Effect to fetch full list only when open or searching
    useEffect(() => {
        if (!open && !searchTerm) return

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
                    // Exclude variant templates from purchase orders
                    if (excludeVariantTemplates) {
                        url += '&exclude_variant_templates=true'
                    }
                }

                const res = await api.get(url)
                let allProducts = res.data.results || res.data

                if (allowedTypes && allowedTypes.length > 0) {
                    allProducts = allProducts.filter((p: any) => allowedTypes.includes(p.product_type))
                }

                if (excludeIds && excludeIds.length > 0) {
                    const excludedStrIds = excludeIds
                        .filter(id => id !== null && id !== undefined)
                        .map(id => id.toString())
                    allProducts = allProducts.filter((p: any) => !excludedStrIds.includes(p.id.toString()))
                }

                // Apply custom filter
                if (customFilter) {
                    allProducts = allProducts.filter(customFilter)
                }

                setProducts(allProducts)
                setFilteredProducts(allProducts)
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
    }, [open, searchTerm, productType, context, allowedTypes, excludeIds, customFilter])

    const getStockRestrictionReason = (product: any) => {
        if (!restrictStock) return null

        if (product.product_type === 'STORABLE') {
            const available = product.qty_available || 0
            if (available <= 0) {
                return `Sin stock disponible (Stock: ${product.current_stock || 0}, Reservado: ${(product.current_stock || 0) - available})`
            }
        }

        if (product.product_type === 'MANUFACTURABLE') {
            if (!product.has_bom) return null
            const canMake = product.manufacturable_quantity ?? 0
            if (canMake <= 0) {
                return 'No se puede fabricar: componentes insuficientes'
            }
        }

        return null
    }

    const isStockRestricted = (product: any) => getStockRestrictionReason(product) !== null

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

        if (product.has_variants && product.variants && product.variants.length > 0) {
            setTemplateToResolve(product)
            setIsVariantDialogOpen(true)
            setOpen(false)
            return
        }

        setSelectedProduct(product)
        onChange(product ? product.id.toString() : null)
        if (onSelect) onSelect(product)
        setOpen(false)
    }

    const handleVariantSelect = (variant: any) => {
        setIsVariantDialogOpen(false)
        setTemplateToResolve(null)

        setSelectedProduct(variant)
        onChange(variant ? variant.id.toString() : null)
        if (onSelect) onSelect(variant)
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
                                            {isStockRestricted(product) ? (
                                                <TooltipProvider>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <div className="absolute inset-0 z-10" />
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                            <p className="text-xs">{getStockRestrictionReason(product)}</p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                            ) : null}
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
                                                                    (product.qty_available || 0) > 0 ? "border-emerald-500 text-emerald-600" : "border-red-500 text-white bg-red-500/10"
                                                                )}>
                                                                    Disp: {product.qty_available || 0}
                                                                </Badge>
                                                            </>
                                                        )}

                                                        {/* Manufacturable Badge */}
                                                        {product.product_type === 'MANUFACTURABLE' && product.has_bom && (
                                                            <Badge variant="outline" className={cn("text-[9px] px-1 h-4 border-blue-400 text-blue-600",
                                                                (product.manufacturable_quantity ?? 0) <= 0 && "border-red-500 text-red-500 bg-red-50"
                                                            )}>
                                                                Fab: {product.manufacturable_quantity ?? 'N/A'}
                                                            </Badge>
                                                        )}
                                                        {product.product_type === 'MANUFACTURABLE' && !product.has_bom && (
                                                            <Badge variant="outline" className="text-[9px] px-1 h-4 border-blue-400 text-blue-600">
                                                                Fab: Avanzada
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

            <Dialog open={isVariantDialogOpen} onOpenChange={setIsVariantDialogOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>Seleccionar Variante</DialogTitle>
                        <DialogDescription>
                            El producto "{templateToResolve?.name}" tiene múltiples variantes. Por favor seleccione una.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <div className="rounded-md border overflow-hidden max-h-[300px] overflow-y-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted hover:bg-muted">
                                        <TableHead className="font-bold">Variante / Atributos</TableHead>
                                        <TableHead className="text-right font-bold w-[120px]">Disponibilidad</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {templateToResolve?.variants?.map((v: any) => (
                                        <TableRow
                                            key={v.id}
                                            className="cursor-pointer hover:bg-muted/50 transition-colors"
                                            onClick={() => handleVariantSelect(v)}
                                        >
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="font-medium">{v.variant_display_name || v.name}</span>
                                                    <div className="flex gap-1 mt-1">
                                                        {v.attribute_values_data?.map((av: any) => (
                                                            <Badge key={av.id} variant="secondary" className="text-[9px] py-0 h-4">
                                                                {av.attribute_name}: {av.value}
                                                            </Badge>
                                                        ))}
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Badge variant={(v.current_stock || 0) > 0 ? "success" : "secondary"} className="text-[10px]">
                                                    {v.current_stock || 0} disp.
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
