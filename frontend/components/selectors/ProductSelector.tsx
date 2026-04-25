"use client"

import { useState, useEffect } from "react"
import { Check, ChevronsUpDown, Search, Loader2, AlertCircle, Package } from "lucide-react"
import { cn, translateProductType } from "@/lib/utils"
import { PricingUtils } from '@/features/inventory/utils/pricing'
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
import { BaseModal } from "@/components/shared/BaseModal"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { useProductSearch } from "@/features/inventory/hooks/useProductSearch"
import { EmptyState } from "@/components/shared/EmptyState"
import { Product } from "@/types/entities"
import { CardSkeleton, LabeledContainer } from "@/components/shared"

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
    shouldResolveVariants?: boolean
    simpleOnly?: boolean
    label?: string
    error?: string
    variant?: 'standalone' | 'inline'
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
    className,
    shouldResolveVariants = true,
    simpleOnly = false,
    label,
    error,
    variant = 'standalone'
}: ProductSelectorProps) {
    const { products: fetchedProducts, singleProduct, loading: searchLoading, fetchProducts, fetchSingleProduct } = useProductSearch()
    const [open, setOpen] = useState(false)
    const [filteredProducts, setFilteredProducts] = useState<Product[]>([])
    const [searchTerm, setSearchTerm] = useState("")
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
    const [displayLimit, setDisplayLimit] = useState(20)

    // Variant Selection state
    const [isVariantDialogOpen, setIsVariantDialogOpen] = useState(false)
    const [templateToResolve, setTemplateToResolve] = useState<Product | null>(null)

    // Effect to fetch the selected product if it's missing but we have a value
    useEffect(() => {
        if (value && (!selectedProduct || selectedProduct.id.toString() !== value.toString())) {
            fetchSingleProduct(value.toString())
        } else if (!value) {
            requestAnimationFrame(() => setSelectedProduct(null))
        }
    }, [value, selectedProduct, fetchSingleProduct])

    // Sync fetched single product to local state
    useEffect(() => {
        if (singleProduct && singleProduct.id.toString() === value?.toString()) {
            requestAnimationFrame(() => setSelectedProduct(singleProduct))
        }
    }, [singleProduct, value])

    // Effect to fetch full list only when open or searching
    useEffect(() => {
        if (!open && !searchTerm) return

        fetchProducts({
            search: searchTerm,
            productType,
            limit: 200, // Preload more to allow local filtering
            context,
            excludeVariantTemplates
        })
    }, [open, searchTerm, productType, context, excludeVariantTemplates, fetchProducts])

    // Effect to apply local filters
    useEffect(() => {
        let allProducts = [...fetchedProducts]

        if (allowedTypes && allowedTypes.length > 0) {
            allProducts = allProducts.filter(p => allowedTypes.includes(p.product_type))
        }

        if (simpleOnly) {
            allProducts = allProducts.filter(p => {
                return p.product_type === 'STORABLE' ||
                    (p.product_type === 'MANUFACTURABLE' && !p.requires_advanced_manufacturing && !p.mfg_auto_finalize);
            });
        }

        if (excludeIds && excludeIds.length > 0) {
            const excludedStrIds = excludeIds
                .filter(id => id !== null && id !== undefined)
                .map(id => id.toString())
            allProducts = allProducts.filter(p => !excludedStrIds.includes(p.id.toString()))
        }

        // Apply custom filter
        if (customFilter) {
            allProducts = allProducts.filter(customFilter)
        }

        requestAnimationFrame(() => setFilteredProducts(allProducts))
    }, [fetchedProducts, allowedTypes, simpleOnly, excludeIds, customFilter])

    // Load more entries when scrolling down
    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const target = e.currentTarget
        if (target.scrollHeight - target.scrollTop <= target.clientHeight + 50) {
            if (displayLimit < filteredProducts.length) {
                setDisplayLimit(prev => prev + 20)
            }
        }
    }

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

        if (shouldResolveVariants && product.has_variants && product.variants && product.variants.length > 0) {
            setTemplateToResolve(product)
            setIsVariantDialogOpen(true)
            setOpen(false)
            return
        }

        onSelect?.(product)
        onChange(product.id.toString())
        setOpen(false)
        setSearchTerm("")
    }

    const handleVariantSelect = (variant: any) => {
        setIsVariantDialogOpen(false)
        setTemplateToResolve(null)

        setSelectedProduct(variant)
        onChange(variant ? variant.id.toString() : null)
        if (onSelect) onSelect(variant)
    }

    const selectButton = (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="ghost"
                    role="combobox"
                    aria-expanded={open}
                    disabled={disabled}
                    className={cn(
                        "w-full justify-between overflow-hidden !h-[1.5rem] !p-0 px-2 border-none shadow-none focus-visible:ring-0 bg-transparent hover:bg-transparent min-w-0",
                        variant === 'inline' && "h-8 text-xs"
                    )}
                >
                    {selectedProduct ? (
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            <Package className={cn("h-3.5 w-3.5 shrink-0 text-primary", variant === 'inline' && "h-3 w-3")} />
                            <span className={cn("font-medium text-sm truncate", variant === 'inline' && "text-xs")}>{selectedProduct.name}</span>
                            <span className="text-[10px] text-muted-foreground shrink-0 hidden sm:inline">
                                {selectedProduct.internal_code || selectedProduct.code}
                            </span>
                        </div>
                    ) : (
                        <span className={cn("text-muted-foreground truncate", variant === 'inline' && "text-xs")}>{placeholder}</span>
                    )}
                    <ChevronsUpDown className={cn("ml-2 h-4 w-4 shrink-0 opacity-50", variant === 'inline' && "h-3 w-3")} />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                <div className="p-2">
                    <div className="flex items-center px-3 border rounded-md mb-2 relative">
                        <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                        <input
                            className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                            placeholder="Buscar código o nombre..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        {searchLoading && (
                            <Loader2 className="h-4 w-4 animate-spin shrink-0 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        )}
                    </div>
                </div>

                <div
                    className="max-h-[300px] overflow-y-auto w-full min-w-full"
                    onScroll={handleScroll}
                >
                    {searchLoading && filteredProducts.length === 0 ? (
                        <div className="p-2 space-y-2">
                            <CardSkeleton variant="compact" count={5} />
                        </div>
                    ) : filteredProducts.length === 0 ? (
                        <EmptyState context="inventory" variant="compact" title="No se encontraron productos" />
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
                                                {['STORABLE', 'MANUFACTURABLE'].includes(product.product_type) && (
                                                    <>
                                                        <Badge variant="outline" className={cn("text-[9px] px-1 h-4",
                                                            (product.current_stock || 0) > 0 ? "border-success text-success" : "border-destructive/20 text-destructive"
                                                        )}>
                                                            Stock: {product.current_stock || 0}
                                                        </Badge>
                                                        <Badge variant="outline" className={cn("text-[9px] px-1 h-4",
                                                            (product.qty_available || 0) > 0 ? "border-success text-success" : "border-destructive text-white bg-destructive/10"
                                                        )}>
                                                            Disp: {product.qty_available || 0}
                                                        </Badge>
                                                    </>
                                                )}

                                                {product.requires_advanced_manufacturing ? (
                                                    <Badge variant="outline" className="text-[9px] px-1 h-4 border-primary/50 text-primary bg-primary/10">
                                                        Fab: Avanzada
                                                    </Badge>
                                                ) : product.mfg_auto_finalize ? (
                                                    <Badge variant="outline" className="text-[9px] px-1 h-4 border-warning/50 text-warning bg-warning/10">
                                                        Fab: Express
                                                    </Badge>
                                                ) : product.has_bom ? (
                                                    <Badge variant="outline" className={cn("text-[9px] px-1 h-4 border-primary/50 text-primary",
                                                        (product.manufacturable_quantity ?? 0) <= 0 && "border-destructive text-destructive bg-destructive/10"
                                                    )}>
                                                        Fab: {product.manufacturable_quantity ?? 'N/A'}
                                                    </Badge>
                                                ) : product.product_type === 'MANUFACTURABLE' ? (
                                                    <Badge variant="outline" className="text-[9px] px-1 h-4 border text-muted-foreground bg-muted">
                                                        Sin Receta
                                                    </Badge>
                                                ) : null}
                                            </div>

                                            <span className="text-[10px] font-bold whitespace-nowrap ml-2">
                                                {product.is_dynamic_pricing ? (
                                                    <Badge variant="outline" className="text-[9px] border-warning text-warning bg-warning/10 px-1 py-0 h-4">Precio Dinámico</Badge>
                                                ) : (
                                                    <>
                                                        ${(Number(product.sale_price_gross) || PricingUtils.netToGross(Number(product.sale_price))).toLocaleString()}
                                                        <span className="text-[8px] text-muted-foreground ml-0.5">IVA Inc.</span>
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
            </PopoverContent>
        </Popover>
    )

    return (
        <>
            {variant === 'standalone' ? (
                <LabeledContainer
                    label={label}
                    error={error}
                    disabled={disabled}
                    className={className}
                    containerClassName={cn("group focused-within:ring-primary", className)}
                >
                    {selectButton}
                </LabeledContainer>
            ) : (
                <div className={cn("w-full", className)}>
                    {selectButton}
                </div>
            )}

            <BaseModal
                open={isVariantDialogOpen}
                onOpenChange={setIsVariantDialogOpen}
                title="Seleccionar Variante"
                description={`El producto "${templateToResolve?.name}" tiene múltiples variantes. Por favor seleccione una.`}
                className="sm:max-w-[500px]"
            >
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
            </BaseModal>
        </>
    )
}
