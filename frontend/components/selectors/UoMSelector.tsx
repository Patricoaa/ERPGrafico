import React, { useMemo } from 'react'
import { Info, Check, ChevronDown, Search } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { LabeledContainer } from "@/components/shared"

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
    required?: boolean
}

export function UoMSelector({
    product,
    categoryId,
    context = 'stock', // Default context
    value,
    onChange,
    uoms = [],
    showConversionHint = false,
    disabled = false,
    label = 'Unidad',
    error,
    quantity = 1,
    variant = 'standalone',
    className,
    required
}: UoMSelectorProps) {
    // Get filtered UoMs based on context
    const filteredUoMs = useMemo(() => {
        // If categoryId is directly provided, just filter by it (ignores context restrictions usually applied to product)
        if (categoryId) {
            return uoms.filter(u => u.category === categoryId)
        }

        if (!product) return uoms

        const productUomId = product.uom && typeof product.uom === 'object' ? product.uom.id : product.uom
        if (!productUomId) return uoms

        const baseUom = uoms.find(u => String(u.id) === String(productUomId))
        if (!baseUom) return uoms

        if (context === 'stock') {
            // Only base UoM
            return uoms.filter(u => String(u.id) === String(productUomId))
        } else if (context === 'sale') {
            // Base + allowed_sale_uoms (restrictive)
            const allowedIds = [String(productUomId), ...(product.allowed_sale_uoms || []).map(id => String(id))]
            return uoms.filter(u => allowedIds.includes(String(u.id)))
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



    const [open, setOpen] = React.useState(false)
    const [searchTerm, setSearchTerm] = React.useState("")

    const filteredAndSearchedUoMs = useMemo(() => {
        if (!searchTerm) return filteredUoMs
        const term = searchTerm.toLowerCase()
        return filteredUoMs.filter(u => u.name.toLowerCase().includes(term))
    }, [filteredUoMs, searchTerm])

    const selectedUoM = useMemo(() => {
        return uoms.find(u => String(u.id) === String(value))
    }, [uoms, value])

    const selectComponent = (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    disabled={disabled || (context !== 'stock' && !product && !categoryId)}
                    className={cn(
                        "w-full justify-between shadow-none focus-visible:ring-0 font-normal transition-all",
                        variant === 'standalone' 
                            ? "h-[1.5rem] py-0 px-3 border-none bg-transparent hover:bg-transparent" 
                            : cn(className),
                        !value && "text-muted-foreground"
                    )}
                >
                    <span className="truncate">
                        {selectedUoM ? selectedUoM.name : "Und"}
                    </span>
                    <ChevronDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                <div className="p-2">
                    <div className="flex items-center px-3 border rounded-md mb-2 bg-background">
                        <Search className="mr-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                        <input
                            className="flex h-8 w-full rounded-md bg-transparent py-2 text-xs outline-none placeholder:text-muted-foreground"
                            placeholder="Buscar UdM..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            autoFocus
                        />
                    </div>
                    <div className="max-h-[200px] overflow-y-auto space-y-0.5">
                        {filteredAndSearchedUoMs.map((uom) => (
                            <div
                                key={uom.id}
                                className={cn(
                                    "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-xs outline-none hover:bg-accent hover:text-accent-foreground transition-colors",
                                    String(value) === String(uom.id) && "bg-accent"
                                )}
                                onClick={() => {
                                    onChange(String(uom.id))
                                    setOpen(false)
                                    setSearchTerm("")
                                }}
                            >
                                <span className="flex-1 truncate">{uom.name}</span>
                                {String(value) === String(uom.id) && (
                                    <Check className="ml-2 h-3 w-3 opacity-100" />
                                )}
                            </div>
                        ))}
                        {filteredAndSearchedUoMs.length === 0 && (
                            <div className="p-3 text-[10px] text-center text-muted-foreground italic">
                                {product || categoryId ? "No se encontraron unidades" : "Seleccione producto primero"}
                            </div>
                        )}
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    )

    const wrappedComponent = variant === 'standalone' ? (
        <LabeledContainer
            label={label}
            required={required}
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
        conversionHint ? (
            <div className={cn("flex items-center gap-1.5 min-w-0", className)}>
                {selectComponent}
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
            </div>
        ) : selectComponent
    )

    return wrappedComponent
}
