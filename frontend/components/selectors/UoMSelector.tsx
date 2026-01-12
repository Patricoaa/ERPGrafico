import React, { useMemo } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Info } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

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
    product: Product | null
    context: 'sale' | 'purchase' | 'bom' | 'stock'
    value: string
    onChange: (value: string) => void
    uoms: UoM[]
    showConversionHint?: boolean
    disabled?: boolean
    label?: string
    quantity?: number
}

export function UoMSelector({
    product,
    context,
    value,
    onChange,
    uoms,
    showConversionHint = false,
    disabled = false,
    label = 'Unidad',
    quantity = 1
}: UoMSelectorProps) {
    // Get filtered UoMs based on context
    const filteredUoMs = useMemo(() => {
        if (!product) return []

        const productUomId = typeof product.uom === 'object' ? product.uom.id : product.uom
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
    }, [product, context, uoms])

    // Get conversion hint
    const conversionHint = useMemo(() => {
        if (!showConversionHint || !product || !value || !quantity) return null

        const productUomId = typeof product.uom === 'object' ? product.uom.id : product.uom
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
                <div className="text-sm text-muted-foreground">
                    No hay unidades disponibles. Configure la UoM base del producto.
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-2">
            <div className="flex items-center gap-2">
                <Label>{label}</Label>

            </div>

            <Select onValueChange={onChange} value={value} disabled={disabled || !product}>
                <SelectTrigger>
                    <SelectValue placeholder="Seleccione unidad" />
                </SelectTrigger>
                <SelectContent>
                    {filteredUoMs.map((uom) => (
                        <SelectItem key={uom.id} value={uom.id.toString()}>
                            {uom.name}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>

            {conversionHint && (
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <Info className="h-3 w-3" />
                    {conversionHint}
                </div>
            )}
        </div>
    )
}
