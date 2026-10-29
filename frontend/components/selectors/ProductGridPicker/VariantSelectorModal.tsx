"use client"

// ProductSelector/VariantSelectorModal
// Extracted from @/features/pos/components/POSVariantSelectorModal (PR-3)
// Migrated to CardRow (ADR-0095)

import React, { useEffect, useState } from "react"
import Image from "next/image"

import { ScrollArea } from "@/components/ui/scroll-area"
import { Package, ImageIcon } from "lucide-react"
import { formatCurrency } from "@/lib/money"
import { PricingUtils } from '@/lib/pricing-utils'
import { BaseModal, Chip, CardRow, GlyphChevron } from '@/components/shared'
import { resolveMediaUrl } from '@/lib/media-url'
import type { BaseProduct } from '@/features/inventory'
import { useVariants } from '@/features/inventory'

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

    const { variants = [], isLoading: loading } = useVariants({
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
            asDialog
            open={open}
            onOpenChange={onOpenChange}
            title={
                <span className="flex items-center gap-3">
                    <Package className="h-6 w-6" />
                    Seleccionar {product.name}
                </span>
            }
            size="xl"
            contentClassName="max-w-3xl rounded-lg p-0 overflow-hidden border-none shadow-overlay"
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

                                // Build status badge
                                const StatusBadge = () => {
                                    if (v.has_active_bom) {
                                        return <Chip size="xs" intent={!disabled ? "success" : "destructive"}>
                                            {limit !== undefined ? limit : (v.manufacturable_quantity || 0)} fab.
                                        </Chip>
                                    }
                                    if (v.product_type === 'MANUFACTURABLE' || v.requires_advanced_manufacturing) {
                                        return <Chip size="xs" intent="primary">Disponible</Chip>
                                    }
                                    return <Chip size="xs" intent={!disabled ? "success" : "destructive"}>
                                        {limit !== undefined ? limit : v.qty_available} stock
                                    </Chip>
                                }

                                return (
                                    <CardRow
                                        key={v.id}
                                        lead={
                                            <div className="w-16 h-16 rounded-md bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                                                {v.image || product.image ? (
                                                    <Image
                                                        src={resolveMediaUrl(v.image || product.image) ?? ""}
                                                        alt={v.variant_display_name || v.name}
                                                        fill
                                                        className="object-cover"
                                                    />
                                                ) : (
                                                    <ImageIcon className="h-6 w-6 text-muted-foreground/40" />
                                                )}
                                            </div>
                                        }
                                        title={v.variant_display_name || v.name}
                                        description={
                                            <div className="flex flex-wrap gap-1">
                                                {v.attribute_values_data?.map((av) => (
                                                    <Chip key={av.id} size="xs" intent="neutral" className="bg-background">
                                                        {av.value}
                                                    </Chip>
                                                ))}
                                            </div>
                                        }
                                        amount={formatCurrency(Number(v.sale_price_gross) || PricingUtils.netToGross(Number(v.sale_price)))}
                                        trailing={<StatusBadge />}
                                        glyph={<GlyphChevron />}
                                        unavailable={disabled}
                                        onClick={() => handleSelect(v)}
                                    />
                                );
                            })}
                        </div>
                    </ScrollArea>
                )}
            </div>
        </BaseModal>
    )
}