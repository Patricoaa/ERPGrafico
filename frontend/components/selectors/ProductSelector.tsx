"use client"

import { useState, useEffect } from "react"
import { Check, ChevronDown, Search, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { getEntityIcon } from "@/lib/entity-registry"
import { PricingUtils } from '@/lib/pricing-utils'
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

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useProductSearch, useSingleProduct } from "@/features/inventory/hooks/useProductSearch"

import { type Product, type ProductType, type ProductVariant, type ProductAttributeValue } from "@/types/entities"
import { BaseModal, CardSkeleton, EmptyState, LabeledContainer, MoneyDisplay, Badge } from '@/components/shared'

const ProductIcon = getEntityIcon('inventory.product')

interface ProductSelectorProps {
    value?: string | number | null
    onChange: (value: string | null) => void
    placeholder?: string
    productTypes?: ProductType[]
    disabled?: boolean
    restrictStock?: boolean
    excludeIds?: (string | number)[]
    canBePurchased?: boolean
    canBeSold?: boolean
    excludeVariantTemplates?: boolean
    onSelect?: (product: Product) => void
    customFilter?: (product: Product) => boolean
    customDisabled?: (product: Product) => boolean
    className?: string
    shouldResolveVariants?: boolean
    label?: string
    error?: string
    required?: boolean
    variant?: 'standalone' | 'inline'
}

export function ProductSelector({
    value,
    onChange,
    placeholder = "Seleccionar producto...",
    productTypes,
    disabled = false,
    restrictStock = false,
    excludeIds = [],
    canBePurchased = false,
    canBeSold = false,
    excludeVariantTemplates = false,
    onSelect,
    customFilter,
    customDisabled,
    className,
    shouldResolveVariants = true,
    label,
    error,
    required = false,
    variant = 'standalone'
}: ProductSelectorProps) {
    const [open, setOpen] = useState(false)
    const [filteredProducts, setFilteredProducts] = useState<Product[]>([])
    const [searchTerm, setSearchTerm] = useState("")
    const [displayLimit, setDisplayLimit] = useState(20)

    const shouldFetchProducts = open || searchTerm.length > 0
    const { products: fetchedProducts, loading: searchLoading } = useProductSearch({
        search: searchTerm,
        productTypes,
        limit: 200, // Preload more to allow local filtering
        canBePurchased,
        canBeSold,
        excludeVariantTemplates
    }, shouldFetchProducts)

    const { product: singleProduct } = useSingleProduct(value || null)
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)

    // Variant Selection state
    const [isVariantDialogOpen, setIsVariantDialogOpen] = useState(false)
    const [templateToResolve, setTemplateToResolve] = useState<Product | null>(null)

    // Sync fetched single product to local state
    useEffect(() => {
        if (singleProduct && singleProduct.id.toString() === value?.toString()) {
            requestAnimationFrame(() => setSelectedProduct(singleProduct))
        } else if (!value) {
            requestAnimationFrame(() => setSelectedProduct(null))
        }
    }, [singleProduct, value])

    // Effect to apply local filters
    useEffect(() => {
        let allProducts = [...fetchedProducts]

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
    }, [fetchedProducts, excludeIds, customFilter])

    // Load more entries when scrolling down
    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const target = e.currentTarget
        if (target.scrollHeight - target.scrollTop <= target.clientHeight + 50) {
            if (displayLimit < filteredProducts.length) {
                setDisplayLimit(prev => prev + 20)
            }
        }
    }

    const getStockRestrictionReason = (product: Product) => {
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

    const isStockRestricted = (product: Product) => getStockRestrictionReason(product) !== null

    const isCustomDisabled = (product: Product) => {
        if (customDisabled && customDisabled(product)) {
            return true
        }
        return false
    }

    const handleSelect = (product: Product) => {
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

    const handleVariantSelect = (variant: ProductVariant) => {
        setIsVariantDialogOpen(false)
        setTemplateToResolve(null)

        setSelectedProduct(variant as unknown as Product)
        onChange(variant.id.toString())
        if (onSelect) onSelect(variant as unknown as Product)
    }

    const selectButton = (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant="ghost"
                    role="combobox"
                    aria-expanded={open}
                    disabled={disabled}
                    className={cn(
                        "w-full justify-between overflow-hidden shadow-none focus-visible:ring-0 transition-all",
                        variant === 'standalone'
                            ? "h-[1.5rem] px-0 border-none bg-transparent hover:bg-transparent"
                            : cn("h-9 text-xs px-2 bg-background hover:bg-primary/[0.02]", className)
                    )}
                >
                    {selectedProduct ? (
                        <div className="flex items-center justify-between gap-1.5 min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 min-w-0">
                                <ProductIcon className={cn("h-3.5 w-3.5 shrink-0 text-primary", variant === 'inline' && "h-3 w-3")} />
                                <span className={cn("font-medium text-sm truncate", variant === 'inline' && "text-xs")}>{selectedProduct.name}</span>
                            </div>
                            <span className={cn("text-muted-foreground shrink-0 pr-1 text-right", variant === 'inline' ? "text-[10px]" : "text-xs")}>
                                {PricingUtils.formatCurrency(Number(selectedProduct.sale_price_gross ?? selectedProduct.sale_price))}
                            </span>
                        </div>
                    ) : (
                        <span className={cn("text-muted-foreground truncate", variant === 'inline' && "text-xs")}>{placeholder}</span>
                    )}
                    <ChevronDown className={cn("ml-2 h-4 w-4 shrink-0 opacity-50", variant === 'inline' && "h-3 w-3")} />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                <div className="p-2">
                    <div className="flex items-center px-3 border rounded-md mb-2 relative">
                        <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                        <input
                            className={cn(
                                "flex h-10 w-full rounded-md bg-transparent py-3 outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
                                variant === 'inline' ? "text-xs" : "text-sm"
                            )}
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
                                        "relative flex cursor-default select-none items-start rounded-sm px-2 py-2 outline-none hover:bg-accent hover:text-accent-foreground data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50",
                                        variant === 'inline' ? "text-xs" : "text-sm",
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
                                        <div className="flex items-center justify-between gap-2 w-full">
                                            <span className="font-medium truncate text-left">
                                                {product.name}
                                            </span>
                                            <span className="text-muted-foreground whitespace-nowrap text-right">
                                                {PricingUtils.formatCurrency(Number(product.sale_price_gross ?? product.sale_price))}
                                            </span>
                                        </div>
                                        <div className="flex justify-between mt-1 items-center">
                                            <div className="flex gap-1 flex-wrap">
                                                {['STORABLE', 'MANUFACTURABLE'].includes(product.product_type) && (
                                                    <>
                                                        <Badge intent={(product.current_stock || 0) > 0 ? "success" : "destructive"} size="xs" className={(product.current_stock || 0) > 0 ? "bg-success text-success-foreground" : "bg-destructive text-destructive-foreground"}>
                                                            Stock: {product.current_stock || 0}
                                                        </Badge>
                                                        <Badge intent={(product.qty_available || 0) > 0 ? "success" : "destructive"} size="xs" className={(product.qty_available || 0) > 0 ? "bg-success text-success-foreground" : "bg-destructive text-destructive-foreground"}>
                                                            Disp: {product.qty_available || 0}
                                                        </Badge>
                                                    </>
                                                )}

                                                {product.requires_advanced_manufacturing ? (
                                                    <Badge intent="primary" size="xs">
                                                        Fab: Avanzada
                                                    </Badge>
                                                ) : product.mfg_auto_finalize ? (
                                                    <Badge intent="warning" size="xs">
                                                        Fab: Express
                                                    </Badge>
                                                ) : product.has_bom ? (
                                                    <Badge intent={(product.manufacturable_quantity ?? 0) <= 0 ? "destructive" : "primary"} size="xs">
                                                        Fab: {product.manufacturable_quantity ?? 'N/A'}
                                                    </Badge>
                                                ) : product.product_type === 'MANUFACTURABLE' ? (
                                                    <Badge intent="neutral" size="xs">
                                                        Sin Receta
                                                    </Badge>
                                                ) : null}
                                            </div>

                                            <span className="text-[10px] font-bold whitespace-nowrap ml-2">
                                                {product.is_dynamic_pricing ? (
                                                    <Badge intent="warning" size="xs">Precio Dinámico</Badge>
                                                ) : (
                                                    <>
                                                        <MoneyDisplay amount={Number(product.sale_price_gross) || PricingUtils.netToGross(Number(product.sale_price))} inline />
                                                        <span className="text-[9px] text-muted-foreground ml-0.5">IVA Inc.</span>
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
                    required={required}
                    error={error}
                    disabled={disabled}
                    className={className}
                >
                    {selectButton}
                </LabeledContainer>
            ) : (
                selectButton
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
                                {templateToResolve?.variants?.map((v: ProductVariant) => (
                                    <TableRow
                                        key={v.id}
                                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                                        onClick={() => handleVariantSelect(v)}
                                    >
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-medium">{v.variant_display_name || v.name}</span>
                                                <div className="flex gap-1 mt-1">
                                                    {v.attribute_values_data?.map((av: ProductAttributeValue) => (
                                                        <Badge key={av.id} intent="neutral" size="xs">
                                                            {av.attribute_name}: {av.value}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Badge intent={(v.current_stock || 0) > 0 ? "success" : "neutral"} size="sm">
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
