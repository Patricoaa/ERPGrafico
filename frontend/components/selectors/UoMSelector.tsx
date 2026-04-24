import React, { useMemo } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Info } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from "@/lib/utils"
import { LabeledContainer, EmptyState } from "@/components/shared"

interface UoM {
    id: number
    name: string
    category: number
    ratio: number
}

interface Product {
    id: number
    name: string
    uom?: number | { id: number }
    allowed_sale_uoms?: number[]
    category?: number
}

interface UoMSelectorProps {
    product?: Product | null
    categoryId?: number
    context?: 'sale' | 'purchase' | 'bom' | 'stock'
    value: string
    onChange: (value: string) => void
    uoms: UoM[]
    showConversionHint?: boolean
    disabled?: boolean
    label?: string
    error?: string
    quantity?: number
    variant?: 'inline' | 'standalone'
    className?: string
}

export function UoMSelector({
    product,
    categoryId,
    context = 'stock', // Default context
    value,
    onChange,
    uoms,
    showConversionHint = false,
    disabled = false,
    label = 'Unidad',
    error,
    quantity = 1,
    variant = 'inline',
    className
}: UoMSelectorProps) {
    // Get filtered UoMs based on context
    const filteredUoMs = useMemo(() => {
        // If categoryId is directly provided, just filter by it (ignores context restrictions usually applied to product)
        if (categoryId) {
            return uoms.filter(u => u.category === categoryId)
        }

        if (!product) return []

        const productUomId = product.uom && typeof product.uom === 'object' ? product.uom.id : product.uom
        if (!productUomId) return []

        const baseUom = uoms.find(u => u.id === productUomId)
        if (!baseUom) return []

        if (context === 'stock') {
            // Only base UoM
            return uoms.filter(u => u.id === productUomId)
        } else if (context === 'sale') {
            // Base + allowed_sale_uoms (restrictive)
            const allowedIds = [productUomId, ...(product.allowed_sale_uoms || [])]
            return uoms.filter(u => allowedIds.includes(u.id))
        } else if (context === 'purchase' || context === 'bom') {
            // Full category (flexible)
            return uoms.filter(u => u.category === baseUom.category)
        }

        return []
    }, [product, categoryId, context, uoms])

    // Get conversion hint
    const conversionHint = useMemo(() => {
        if (!showConversionHint || !product || !value || !quantity) return null

        const productUomId = product.uom && typeof product.uom === 'object' ? product.uom.id : product.uom
        const selectedUom = uoms.find(u => u.id === parseInt(value))
        const baseUom = uoms.find(u => u.id === productUomId)

        if (!selectedUom || !baseUom || selectedUom.id === baseUom.id) return null

        // Calculate conversion
        const convertedQty = (quantity * selectedUom.ratio) / baseUom.ratio
        const formattedConverted = convertedQty % 1 === 0 ? convertedQty : convertedQty.toFixed(2)

        return `${quantity} ${selectedUom.name} = ${formattedConverted} ${baseUom.name} (stock)`
    }, [showConversionHint, product, value, quantity, uoms])



    if (filteredUoMs.length === 0) {
        return (
            <div className="space-y-2">
                <Label className="text-destructive">{label}</Label>
                <EmptyState
                    context="generic"
                    variant="compact"
                    title="Sin unidades disponibles"
                    description="Configure la UoM base del producto."
                />
            </div>
        )
    }

    const selectComponent = (
        <Select onValueChange={onChange} value={value} disabled={disabled || (!product && !categoryId)}>
            <SelectTrigger className={cn("h-9 w-full", variant === 'standalone' && "border-none shadow-none focus-visible:ring-0 bg-transparent")}>
                <SelectValue placeholder="Und" />
            </SelectTrigger>
            <SelectContent>
                {filteredUoMs.map((uom) => (
                    <SelectItem key={uom.id} value={uom.id.toString()}>
                        {uom.name}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    )

    const wrappedComponent = variant === 'standalone' ? (
        <LabeledContainer
            label={label}
            error={error}
            disabled={disabled}
            className={className}
        >
            <div className="flex items-center gap-1.5 w-full">
                {selectComponent}
                {conversionHint && (
                    <TooltipProvider delayDuration={0}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div className="p-1 mr-2 rounded-full hover:bg-muted cursor-help transition-colors shrink-0">
                                    <Info className="h-4 w-4 text-muted-foreground/70" />
                                </div>
                            </TooltipTrigger>
                            <TooltipContent side="top" align="center" className="bg-popover text-popover-foreground border shadow-md font-medium text-xs">
                                <p>{conversionHint}</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                )}
            </div>
        </LabeledContainer>
    ) : (
        <div className={cn("flex items-center gap-1.5 min-w-0", className)}>
            {selectComponent}
            {conversionHint && (
                <TooltipProvider delayDuration={0}>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div className="p-1 rounded-full hover:bg-muted cursor-help transition-colors">
                                <Info className="h-4 w-4 text-muted-foreground/70" />
                            </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" align="center" className="bg-popover text-popover-foreground border shadow-md font-medium text-xs">
                            <p>{conversionHint}</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            )}
        </div>
    )

    return wrappedComponent
}
