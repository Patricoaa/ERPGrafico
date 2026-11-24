"use client"

// ProductSelector/VariantSelectorModal
// Extracted from @/features/pos/components/POSVariantSelectorModal (PR-3)
// Migrated to CardRow (ADR-0095); lista compacta alineada con SummaryPanel.

/** Desde esta cantidad de variantes se muestra el buscador. */
const SEARCH_THRESHOLD = 8

import React, { useEffect, useMemo, useState } from "react"
import Image from "next/image"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Package, ChevronRight, Search } from "lucide-react"
import { formatCurrency } from "@/lib/money"
import { PricingUtils } from '@/lib/pricing-utils'
import { cn } from "@/lib/utils"
import { BaseModal, Chip, DynamicIcon, EmptyState } from '@/components/shared'
import { resolveMediaUrl } from '@/lib/media-url'
import type { BaseProduct, ProductCategory } from '@/features/inventory'
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
    /** Catálogo de categorías: la imagen ausente hereda el icono de la categoría del producto. */
    categories?: ProductCategory[]
}

export function VariantSelectorModal({
    open,
    onOpenChange,
    product,
    onSelect,
    isVariantDisabled = () => false,
    getVariantLimit,
    extraApiParams,
    categories = []
}: VariantSelectorModalProps) {
    const [variantLimits, setVariantLimits] = useState<Record<number, number>>({})
    const [query, setQuery] = useState("")

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

    const variantLabel = (v: BaseProduct) => v.variant_display_name || v.name

    // Icono de la categoría del producto: sirve de imagen cuando la variante no tiene foto.
    const categoryIcon = useMemo(() => {
        if (!product) return undefined
        const own = typeof product.category === 'object' && product.category !== null ? product.category.icon : undefined
        if (own?.trim()) return own.trim()
        const categoryId = typeof product.category === 'object' && product.category !== null ? product.category.id : product.category
        const byId = categoryId != null ? categories.find(c => String(c.id) === String(categoryId)) : undefined
        const byName = !byId && product.category_name
            ? categories.find(c => c.name?.trim().toLowerCase() === String(product.category_name).trim().toLowerCase())
            : undefined
        const icon = (byId ?? byName)?.icon
        return typeof icon === 'string' && icon.trim() ? icon.trim() : undefined
    }, [product, categories])

    // Las no seleccionables van al final: el cajero ve primero lo que sí puede vender.
    const visibleVariants = useMemo(() => {
        const q = query.trim().toLowerCase()
        const matches = q
            ? variants.filter(v =>
                variantLabel(v).toLowerCase().includes(q) ||
                v.attribute_values_data?.some(av => String(av.value).toLowerCase().includes(q)))
            : variants
        return [...matches].sort((a, b) => Number(isVariantDisabled(a)) - Number(isVariantDisabled(b)))
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [variants, query])

    const availableCount = useMemo(
        () => variants.filter(v => !isVariantDisabled(v)).length,
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [variants]
    )

    const handleSelect = (variant: BaseProduct) => {
        const disabled = isVariantDisabled(variant)
        if (!disabled) {
            onSelect(variant)
            onOpenChange(false)
        }
    }

    if (!product) return null

    const showSearch = variants.length > SEARCH_THRESHOLD

    return (
        <BaseModal
            asDialog
            open={open}
            onOpenChange={(next) => { if (!next) setQuery(""); onOpenChange(next) }}
            icon={Package}
            title={product.name}
            description={loading ? "Cargando variantes…" : availableCount === 0 ? "Ninguna variante está disponible para la venta" : `Elige una variante · ${availableCount} de ${variants.length} disponibles`}
            size="md"
            hideScrollArea
        >
            <div className="flex flex-col gap-3 p-4">
                {showSearch && (
                    <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                        <Input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Filtrar por nombre o atributo…"
                            aria-label="Filtrar variantes"
                            className="h-control-lg pl-9"
                        />
                    </div>
                )}

                {loading ? (
                    <div className="grid gap-px overflow-hidden rounded-sm border border-border" aria-busy>
                        {[0, 1, 2, 3].map(i => <div key={i} className="h-16 animate-pulse bg-muted motion-reduce:animate-none" />)}
                    </div>
                ) : visibleVariants.length === 0 ? (
                    <EmptyState
                        context="search"
                        variant="compact"
                        title="Sin variantes"
                        description={query ? "Ninguna variante coincide con el filtro." : "Este producto no tiene variantes disponibles."}
                    />
                ) : (
                    <div className="max-h-[55vh] w-full overflow-y-auto rounded-sm border border-border">
                        <ul className="w-full divide-y divide-border">
                            {visibleVariants.map((v) => {
                                const limit = variantLimits[v.id]
                                const disabled = isVariantDisabled(v)
                                const photo = v.image || product.image
                                const price = Number(v.effective_price ?? v.sale_price_gross) || PricingUtils.netToGross(Number(v.sale_price))

                                const stock = disabled ? (
                                    <Chip size="xs" intent="destructive">{v.has_active_bom ? "Sin insumos" : "Sin stock"}</Chip>
                                ) : v.has_active_bom ? (
                                    <Chip size="xs" intent={!disabled ? "success" : "destructive"}>
                                        {limit !== undefined ? limit : (v.manufacturable_quantity || 0)} fab.
                                    </Chip>
                                ) : (v.product_type === 'MANUFACTURABLE' || v.requires_advanced_manufacturing) ? (
                                    <Chip size="xs" intent="primary">Disponible</Chip>
                                ) : (
                                    <Chip size="xs" intent={!disabled ? "success" : "destructive"}>
                                        {limit !== undefined ? limit : v.qty_available} stock
                                    </Chip>
                                )

                                return (
                                    <li key={v.id}>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            disabled={disabled}
                                            onClick={() => handleSelect(v)}
                                            className={cn(
                                                "h-auto min-h-16 w-full justify-start gap-3 rounded-none px-3 py-2.5 text-left font-normal whitespace-normal",
                                                "hover:bg-muted active:bg-muted/70 disabled:pointer-events-none disabled:opacity-50"
                                            )}
                                        >
                                            <span className="relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-sm bg-muted text-muted-foreground">
                                                {photo ? (
                                                    <Image src={resolveMediaUrl(photo) ?? ""} alt="" fill sizes="48px" className="object-cover" />
                                                ) : categoryIcon ? (
                                                    <DynamicIcon name={categoryIcon} className="size-6" />
                                                ) : (
                                                    <Package className="size-6" aria-hidden />
                                                )}
                                             </span>
                                             <span className="min-w-0 flex-1">
                                                 <span className="block truncate text-base font-medium">{variantLabel(v)}</span>
                                                 {!!v.attribute_values_data?.length && (
                                                     <span className="mt-1 flex flex-wrap gap-1">
                                                         {v.attribute_values_data.map((av) => (
                                                             <Chip key={av.id} size="xs" intent="neutral">{av.value}</Chip>
                                                         ))}
                                                     </span>
                                                 )}
                                             </span>
                                             <span className="flex shrink-0 flex-col items-end gap-1">
                                                 <span className="font-mono text-base font-black tabular-nums">{formatCurrency(price)}</span>
                                                 {stock}
                                             </span>
                                             <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                                         </Button>
                                     </li>
                                 )
                            })}
                        </ul>
                    </div>
                )}
            </div>
        </BaseModal>
    )
}
