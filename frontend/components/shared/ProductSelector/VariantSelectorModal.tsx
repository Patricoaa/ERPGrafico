"use client"

// ProductSelector/VariantSelectorModal
// Extracted from @/features/pos/components/POSVariantSelectorModal (PR-3)

import React, { useEffect, useState } from "react"

import { ScrollArea } from "@/components/ui/scroll-area"
import { Package, ImageIcon } from "lucide-react"
import { formatCurrency } from "@/lib/money"
import { PricingUtils } from '@/features/inventory/utils/pricing'
import { cn } from "@/lib/utils"
import { BaseModal, Chip } from '@/components/shared'
import type { BaseProduct } from '@/features/inventory/types'
import { useVariants } from '@/features/inventory/hooks/useVariants'

export interface VariantSelectorModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    product: BaseProduct | null
    onSelect: (variant: BaseProduct) => void
    /** Strategy to determine if a variant should be disabled. Returns boolean. */
    isVariantDisabled?: (variant: BaseProduct) => boolean
    /** Function to get dynamic limit/stock display for a variant. Returns number or undefined. */
    getVariantLimit?: (variant: BaseProduct) => Promise<number | undefined>
    /** Extra params to pass to the variant fetch API (e.g. pos_session_id) */
    extraApiParams?: Record<string, string | number | boolean>
}

export function VariantSelectorModal({
    open,
    onOpenChange,
    product,
    onSelect,
    isVariantDisabled = () => false,
    getVariantLimit,
    extraApiParams
}: VariantSelectorModalProps) {
    const [variantLimits, setVariantLimits] = useState<Record<number, number>>({})

    const { data: variants = [], isLoading: loading } = useVariants({
        productId: product?.id,
        enabled: open && !!product?.id,
        extraParams: extraApiParams
    })

    // Resolve dynamic limits asynchronously
    useEffect(() => {
        let active = true
        const updateVariantLimits = async () => {
            if (variants.length === 0 || !getVariantLimit) return
            const newLimits: Record<number, number> = {}
            for (const v of variants) {
                const max = await getVariantLimit(v)
                if (max !== undefined) {
                    newLimits[v.id] = max
                }
            }
            if (active) setVariantLimits(newLimits)
        }
        updateVariantLimits()
        return () => { active = false }
    }, [variants, getVariantLimit])

    const handleSelect = (variant: BaseProduct) => {
        const disabled = isVariantDisabled(variant)
        if (!disabled) {
            onSelect(variant)
            onOpenChange(false)
        }
    }

    if (!product) return null

    return (
        <BaseModal
            open={open}
            onOpenChange={onOpenChange}
            title={
                <span className="flex items-center gap-3">
                    <Package className="h-6 w-6" />
                    Seleccionar {product.name}
                </span>
            }
            size="xl"
            contentClassName="max-w-3xl rounded-lg p-0 overflow-hidden border-none shadow-2xl"
            headerClassName="p-6 bg-primary text-primary-foreground"
        >
            <div className="p-6">
                {loading ? (
                    <div className="h-64 flex items-center justify-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                    </div>
                ) : (
                    <ScrollArea className="h-[50vh] pr-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4">
                            {variants.map((v) => {
                                const limit = variantLimits[v.id]
                                const disabled = isVariantDisabled(v)

                                return (
                                    <div
                                        key={v.id}
                                        onClick={() => !disabled && handleSelect(v)}
                                        className={cn(
                                            "relative flex items-center gap-4 p-4 rounded-md border-2 transition-all cursor-pointer",
                                            disabled ? "opacity-50 grayscale pointer-events-none bg-muted/20 border-dashed" : "border-muted bg-card hover:border-primary/50 hover:bg-muted/30 active:scale-[0.98]"
                                        )}
                                    >
                                        {/* Variant Image or Placeholder */}
                                        <div className="w-16 h-16 rounded-md bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                                            {v.image || product.image ? (
                                                <img
                                                    src={v.image || product.image || ""}
                                                    alt={v.variant_display_name || v.name}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <ImageIcon className="h-6 w-6 text-muted-foreground/40" />
                                            )}
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-bold text-sm truncate">
                                                {v.variant_display_name || v.name}
                                            </h4>
                                            <div className="flex flex-wrap gap-1 mt-1">
                                                {v.attribute_values_data?.map((av) => (
                                                    <Chip key={av.id} size="xs" intent="neutral" className="bg-background">
                                                        {av.value}
                                                    </Chip>
                                                ))}
                                            </div>
                                            <div className="mt-2 flex items-center justify-between">
                                                <span className="text-primary font-bold">
                                                    {formatCurrency(Number(v.sale_price_gross) || PricingUtils.netToGross(Number(v.sale_price)))}
                                                </span>

                                                {/* Status Badge */}
                                                {v.has_active_bom ? (
                                                    <Chip size="xs" intent={!disabled ? "success" : "destructive"}>
                                                        {limit !== undefined ? limit : (v.manufacturable_quantity || 0)} fab.
                                                    </Chip>
                                                ) : (
                                                    (v.product_type === 'MANUFACTURABLE' || v.requires_advanced_manufacturing) ? (
                                                        <Chip size="xs" intent="primary">
                                                            Disponible
                                                        </Chip>
                                                    ) : (
                                                        <Chip size="xs" intent={!disabled ? "success" : "destructive"}>
                                                            {limit !== undefined ? limit : v.qty_available} stock
                                                        </Chip>
                                                    )
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </ScrollArea>
                )}
            </div>
        </BaseModal>
    )
}
