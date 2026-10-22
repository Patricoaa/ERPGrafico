"use client"

// ProductGridPicker/ProductCard
// One card anatomy for every catalog context (POS, calculator, production):
// icon/photo strip → code · name · availability → price + action glyph.
// What the card says is decided by `getProductCardModel`; this file only draws it.

import { memo } from 'react'
import Image from 'next/image'
import { Ban, ChevronRight, Clock, Factory, Heart, Layers, Lock, Minus, Package, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/money'
import { resolveMediaUrl } from '@/lib/media-url'
import { Button } from '@/components/ui/button'
import { Chip, DynamicIcon, SelectionCheck } from '@/components/shared'
import { CardSurface, cardAnatomy } from '@/components/shared'
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
    const unavailable = model.isUnavailable
    const photo = resolveMediaUrl(product.image_thumbnail ?? product.image)
    const AvailabilityIconComponent = model.availability ? AVAILABILITY_ICONS[model.availability.icon] : null
    const ActionIcon = ACTION_ICONS[model.action]
    const customPrice = priceRenderer ? priceRenderer(product) : undefined
    const showPrice = !priceRenderer || customPrice != null
    const caption = model.price.kind === 'from' ? `${priceLabel} · desde` : priceLabel

    return (
        <CardSurface
            role="button"
            selected={isSelected}
            unavailable={unavailable}
            onClick={() => !unavailable && onProductClick(product)}
            className={cn(
                "h-full",
                isTouch && !unavailable && "active:scale-[0.98]"
            )}
        >
            <div className={cn("relative h-22 w-full shrink-0 overflow-hidden bg-muted", isTouch && "h-28", unavailable && "bg-muted/60")}>
                {photo ? (
                    <Image src={photo} alt="" fill sizes="(min-width: 1024px) 20vw, 40vw" className="object-cover" />
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <DynamicIcon name={categoryIcon || "Package"} className={cn("h-9 w-9", unavailable ? "text-muted-foreground/40" : "text-muted-foreground/60")} />
                    </div>
                )}

                {categoryName && (
                    <Chip size="xs" className="absolute left-2 top-2 border border-border bg-background text-3xs font-normal">
                        {categoryName}
                    </Chip>
                )}

                {onToggleFavorite && (
                    <Button
                        type="button"
                        variant="ghost"
                        className={cn(
                            "absolute right-2 top-2 cursor-pointer rounded-full border border-border bg-background p-0 transition-colors hover:bg-background",
                            isTouch ? "h-10 w-10" : "h-7 w-7",
                            product.is_favorite ? "text-destructive" : "text-muted-foreground hover:text-foreground"
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

                {isSelected && <SelectionCheck />}
            </div>

            <div className={cn(cardAnatomy.body, isTouch && "pt-3")}>
                <div className="flex min-h-4 items-center justify-between gap-2">
                    <span className={cardAnatomy.code}>{model.code}</span>
                    {unavailable && <Lock className="h-3 w-3 shrink-0 text-muted-foreground" aria-label="No disponible" />}
                </div>

                <h3 className={cn(cardAnatomy.title, isTouch ? "text-base" : "text-sm", unavailable && "text-muted-foreground")}>
                    {product.name}
                </h3>

                {model.availability && AvailabilityIconComponent && (
                    <p className={cn("flex items-center gap-1.5", cardAnatomy.description, unavailable ? "text-muted-foreground" : TONE_TEXT[model.availability.tone])}>
                        <AvailabilityIconComponent className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        <span className="truncate">{model.availability.text}</span>
                    </p>
                )}

                <div className={cn(cardAnatomy.footer, "flex items-end justify-between gap-2")}>
                    {showPrice ? (
                        <div className="min-w-0">
                            <p className={cardAnatomy.caption}>{caption}</p>
                            {priceRenderer ? (
                                <div className="flex items-baseline">{customPrice}</div>
                            ) : model.price.kind === 'dynamic' ? (
                                <p className={cn("font-semibold", isTouch ? "text-base" : "text-sm", unavailable ? "text-muted-foreground" : "text-info")}>
                                    Precio dinámico
                                </p>
                            ) : (
                                <p className="flex items-baseline gap-1">
                                    <span className={cn(cardAnatomy.amount, isTouch ? "text-xl" : "", unavailable && "text-muted-foreground")}>
                                        {formatCurrency(model.price.gross ?? 0)}
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
                            cardAnatomy.glyph,
                            unavailable ? "text-muted-foreground" : ""
                        )}
                        aria-hidden
                    />
                </div>
            </div>
        </CardSurface>
    )
}

export const ProductCard = memo(ProductCardComponent)
