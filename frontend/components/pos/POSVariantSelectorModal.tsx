"use client"

import React, { useEffect, useState } from "react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Package, Check, ImageIcon } from "lucide-react"
import api from "@/lib/api"
import { formatCurrency } from "@/lib/currency"
import { PricingUtils } from "@/lib/pricing"
import { cn } from "@/lib/utils"

interface Product {
    id: number
    name: string
    has_variants?: boolean
    image?: string | null
}

interface Variant {
    id: number
    name: string
    variant_display_name?: string
    sale_price: string
    sale_price_gross: string
    current_stock: number
    image?: string | null
    attribute_values_data?: {
        id: number
        attribute_name: string
        value: string
    }[]
}

interface POSVariantSelectorModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    product: Product | null
    onSelect: (variant: Variant) => void
    initialVariantId?: number | null
}

export function POSVariantSelectorModal({
    open,
    onOpenChange,
    product,
    onSelect,
    initialVariantId
}: POSVariantSelectorModalProps) {
    const [variants, setVariants] = useState<Variant[]>([])
    const [loading, setLoading] = useState(false)
    const [selectedId, setSelectedId] = useState<number | null>(null)

    useEffect(() => {
        if (open && product?.id) {
            fetchVariants()
            setSelectedId(initialVariantId || null)
        }
    }, [open, product, initialVariantId])

    const fetchVariants = async () => {
        if (!product?.id) return
        setLoading(true)
        try {
            const res = await api.get(`/inventory/products/?parent_template=${product.id}&show_technical_variants=true&active=true`)
            setVariants(res.data.results || res.data)
        } catch (error) {
            console.error("Failed to fetch variants", error)
        } finally {
            setLoading(false)
        }
    }

    const handleConfirm = () => {
        const variant = variants.find(v => v.id === selectedId)
        if (variant) {
            onSelect(variant)
            onOpenChange(false)
        }
    }

    if (!product) return null

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl rounded-3xl p-0 overflow-hidden border-none shadow-2xl">
                <DialogHeader className="p-6 bg-primary text-primary-foreground">
                    <DialogTitle className="text-2xl font-bold flex items-center gap-3">
                        <Package className="h-6 w-6" />
                        Seleccionar Variante: {product.name}
                    </DialogTitle>
                </DialogHeader>

                <div className="p-6">
                    {loading ? (
                        <div className="h-64 flex items-center justify-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                        </div>
                    ) : (
                        <ScrollArea className="h-[50vh] pr-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4">
                                {variants.map((v) => (
                                    <div
                                        key={v.id}
                                        onClick={() => setSelectedId(v.id)}
                                        className={cn(
                                            "relative flex items-center gap-4 p-4 rounded-2xl border-2 transition-all cursor-pointer hover:border-primary/50",
                                            selectedId === v.id
                                                ? "border-primary bg-primary/5 shadow-md"
                                                : "border-muted bg-card hover:bg-muted/30"
                                        )}
                                    >
                                        {/* Variant Image or Placeholder */}
                                        <div className="w-16 h-16 rounded-xl bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                                            {v.image || product.image ? (
                                                <img
                                                    src={v.image || product.image || ""}
                                                    alt={v.variant_display_name}
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
                                                    <Badge key={av.id} variant="outline" className="text-[9px] py-0 h-4 bg-background">
                                                        {av.value}
                                                    </Badge>
                                                ))}
                                            </div>
                                            <div className="mt-2 flex items-center justify-between">
                                                <span className="text-primary font-bold">
                                                    {formatCurrency(Number(v.sale_price_gross) || PricingUtils.netToGross(Number(v.sale_price)))}
                                                </span>
                                                <Badge variant={v.current_stock > 0 ? "success" : "secondary"} className="text-[10px]">
                                                    {v.current_stock} stock
                                                </Badge>
                                            </div>
                                        </div>

                                        {/* Selection Check */}
                                        {selectedId === v.id && (
                                            <div className="absolute top-2 right-2 p-1 bg-primary text-primary-foreground rounded-full">
                                                <Check className="h-3 w-3" />
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    )}
                </div>

                <DialogFooter className="p-6 bg-muted/30 border-t">
                    <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl h-12 px-8">
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        disabled={!selectedId}
                        className="rounded-xl h-12 px-12 shadow-lg shadow-primary/20"
                    >
                        Seleccionar y Continuar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
