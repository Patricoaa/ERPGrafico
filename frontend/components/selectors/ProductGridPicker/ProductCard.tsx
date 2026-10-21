"use client"

// ProductGridPicker/ProductCard
// One card anatomy for every catalog context (POS, calculator, production):
// icon/photo strip → code · name · availability → price + action glyph.
// What the card says is decided by `getProductCardModel`; this file only draws it.

import { memo } from 'react'
import Image from 'next/image'
import { Ban, Check, ChevronRight, Clock, Factory, Heart, Layers, Lock, Minus, Package, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/money'
import { resolveMediaUrl } from '@/lib/media-url'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Chip, DynamicIcon } from '@/components/shared'
import type { BaseProduct } from '@/features/inventory'
import {
    getProductCardModel,
    type AvailabilityIcon,
    type AvailabilityTone,
    type CardAction,
} from './product-card-model'

export interface ProductCardProps {
    product: BaseProduct
    categoryName?: string
    categoryIcon?: string | null
    /** Stock override from the POS branch. */
    limit?: number
    isDisabled: boolean
    isSelected: boolean
    isTouch: boolean
    onProductClick: (product: BaseProduct) => void
    onToggleFavorite?: (productId: number) => void
    /** Replaces the default price amount. Returning null hides the price block (e.g. production picker). */
    priceRenderer?: (product: BaseProduct) => React.ReactNode
    /** Caption above the price. Defaults to "Venta c/IVA". */
    priceLabel?: string
}

const AVAILABILITY_ICONS: Record<AvailabilityIcon, typeof Package> = {
    stock: Package,
    service: Clock,
    manufacture: Factory,
    blocked: Ban,
}

const TONE_TEXT: Record<AvailabilityTone, string> = {
    ok: 'text-muted-foreground',
    neutral: 'text-muted-foreground',
    warning: 'text-warning-foreground',
    none: 'text-destructive',
}

const ACTION_ICONS: Record<CardAction, typeof Plus> = {
    add: Plus,
    configure: ChevronRight,
    unavailable: Minus,
}

function ProductCardComponent({
    product,
    categoryName,
    categoryIcon,
    limit,
    isDisabled,
    isSelected,
    isTouch,
    onProductClick,
    onToggleFavorite,
    priceRenderer,
    priceLabel = 'Venta c/IVA',
}: ProductCardProps) {
    const model = getProductCardModel(product, { limit, isDisabled })
    const photo = resolveMediaUrl(product.image_thumbnail ?? product.image)
    const AvailabilityIconComponent = model.availability ? AVAILABILITY_ICONS[model.availability.icon] : null
    const ActionIcon = ACTION_ICONS[model.action]
    const customPrice = priceRenderer ? priceRenderer(product) : undefined
    const showPrice = !priceRenderer || customPrice != null
    const caption = model.price.kind === 'from' ? `${priceLabel} · desde` : priceLabel

    return (
        <Card
            role="button"
            tabIndex={isDisabled ? -1 : 0}
            aria-disabled={isDisabled || undefined}
            aria-pressed={isSelected || undefined}
            aria-label={product.name}
            className={cn(
                "group relative flex h-full cursor-pointer flex-col gap-0 overflow-hidden rounded-md border border-border bg-card p-0 shadow-none transition-colors",
                "hover:border-foreground/30",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                isSelected && "ribbon-cmyk border-cyan ring-1 ring-cyan",
                isTouch && "active:scale-[0.98]",
                isDisabled && "cursor-not-allowed opacity-50 hover:border-border"
            )}
            onClick={() => !isDisabled && onProductClick(product)}
            onKeyDown={(e) => {
                if (isDisabled) return
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onProductClick(product)
                }
            }}
        >
            <div className={cn("relative aspect-[16/7] w-full overflow-hidden bg-muted", isTouch && "min-h-24")}>
                {photo ? (
                    <Image src={photo} alt="" fill sizes="(min-width: 1024px) 20vw, 40vw" className="object-cover" />
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <DynamicIcon name={categoryIcon || "Package"} className="h-9 w-9 text-muted-foreground/60" />
                    </div>
                )}

                {categoryName && (
                    <Chip size="xs" className="absolute left-2 top-2 border border-border bg-background">
                        {categoryName}
                    </Chip>
                )}

                {onToggleFavorite && (
                    <Button
                        type="button"
                        variant="ghost"
                        className={cn(
                            "absolute right-2 top-2 rounded-full border border-border bg-background p-0 transition-colors hover:bg-background",
                            isTouch ? "h-10 w-10" : "h-7 w-7",
                            product.is_favorite ? "text-magenta" : "text-muted-foreground hover:text-foreground"
                        )}
                        aria-pressed={Boolean(product.is_favorite)}
                        aria-label={product.is_favorite ? "Quitar de favoritos" : "Marcar como favorito"}
                        title={product.is_favorite ? "Quitar de favoritos" : "Marcar como favorito"}
                        onClick={(e) => {
                            e.stopPropagation()
                            onToggleFavorite(product.id)
                        }}
                    >
                        <Heart className={cn(isTouch ? "h-5 w-5" : "h-3.5 w-3.5", product.is_favorite && "fill-current")} />
                    </Button>
                )}

                {model.variantChip && (
                    <Chip size="xs" icon={Layers} className="absolute bottom-2 left-2 border border-border bg-background">
                        {model.variantChip}
                    </Chip>
                )}

                {isSelected && (
                    <span className="absolute bottom-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <Check className="h-3 w-3" aria-hidden />
                        <span className="sr-only">Seleccionado</span>
                    </span>
                )}
            </div>

            <div className={cn("flex flex-1 flex-col gap-1 px-3 pb-3 pt-2.5", isTouch && "pt-3")}>
                <div className="flex min-h-4 items-center justify-between gap-2">
                    <span className="truncate font-mono text-3xs text-muted-foreground">{model.code}</span>
                    {isDisabled ? (
                        <Lock className="h-3 w-3 shrink-0 text-muted-foreground" aria-label="No disponible" />
                    ) : model.isDynamicPricing ? (
                        <span className="shrink-0 text-3xs font-semibold text-info">Precio dinámico</span>
                    ) : null}
                </div>

                <h3 className={cn("line-clamp-2 text-left font-semibold leading-snug", isTouch ? "text-base" : "text-sm")}>
                    {product.name}
                </h3>

                {model.availability && AvailabilityIconComponent && (
                    <p className={cn("flex items-center gap-1.5 text-2xs", TONE_TEXT[model.availability.tone])}>
                        <AvailabilityIconComponent className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        <span className="truncate">{model.availability.text}</span>
                    </p>
                )}

                <div className="mt-auto flex items-end justify-between gap-2 pt-2">
                    {showPrice ? (
                        <div className="min-w-0">
                            <p className="text-3xs text-muted-foreground">{caption}</p>
                            {priceRenderer ? (
                                <div className="flex items-baseline">{customPrice}</div>
                            ) : model.price.gross === null ? (
                                <p className="text-2xs text-muted-foreground">Precio al agregar</p>
                            ) : (
                                <p className="flex items-baseline gap-1">
                                    <span className={cn("font-semibold tabular-nums", isTouch ? "text-xl" : "text-lg")}>
                                        {formatCurrency(model.price.gross)}
                                    </span>
                                    {model.price.unit && (
                                        <span className="text-2xs text-muted-foreground">/ {model.price.unit}</span>
                                    )}
                                </p>
                            )}
                        </div>
                    ) : <span />}
                    <ActionIcon
                        className={cn(
                            "h-4 w-4 shrink-0 transition-colors",
                            model.action === 'unavailable' ? "text-muted-foreground" : "text-muted-foreground group-hover:text-foreground"
                        )}
                        aria-hidden
                    />
                </div>
            </div>
        </Card>
    )
}

export const ProductCard = memo(ProductCardComponent)
