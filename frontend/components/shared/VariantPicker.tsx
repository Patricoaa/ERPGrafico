"use client"

import { useState, useEffect } from "react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import api from "@/lib/api"
import { Loader2 } from "lucide-react"

interface VariantPickerProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    parentProduct: any
    onSelect: (variant: any) => void
}

export function VariantPicker({ open, onOpenChange, parentProduct, onSelect }: VariantPickerProps) {
    const [variants, setVariants] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const [selectedAttributes, setSelectedAttributes] = useState<Record<string, string>>({})
    const [availableAttributes, setAvailableAttributes] = useState<Record<string, string[]>>({})

    useEffect(() => {
        if (open && parentProduct) {
            fetchVariants()
            setSelectedAttributes({})
        }
    }, [open, parentProduct])

    const fetchVariants = async () => {
        setLoading(true)
        try {
            // Fetch variants for this parent
            const res = await api.get(`/inventory/products/?variant_of=${parentProduct.id}`)
            const variantData = res.data.results || res.data
            setVariants(variantData)

            // Extract available attributes and values from these variants
            const attrs: Record<string, Set<string>> = {}
            variantData.forEach((v: any) => {
                v.attribute_values.forEach((av: any) => {
                    if (!attrs[av.attribute_name]) attrs[av.attribute_name] = new Set()
                    attrs[av.attribute_name].add(av.value)
                })
            })

            const finalAttrs: Record<string, string[]> = {}
            Object.keys(attrs).forEach(key => {
                finalAttrs[key] = Array.from(attrs[key])
            })
            setAvailableAttributes(finalAttrs)
        } catch (error) {
            console.error("Error fetching variants", error)
        } finally {
            setLoading(false)
        }
    }

    const handleValueSelect = (attrName: string, value: string) => {
        setSelectedAttributes(prev => ({
            ...prev,
            [attrName]: value
        }))
    }

    // Find if a variant matches current selection
    const findMatchingVariant = () => {
        return variants.find(v => {
            return Object.entries(selectedAttributes).every(([attr, val]) => {
                return v.attribute_values.some((av: any) => av.attribute_name === attr && av.value === val)
            }) && v.attribute_values.length === Object.keys(availableAttributes).length
        })
    }

    const matchingVariant = findMatchingVariant()
    const allSelected = Object.keys(selectedAttributes).length === Object.keys(availableAttributes).length

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Seleccionar Variantes para {parentProduct?.name}</DialogTitle>
                </DialogHeader>

                {loading ? (
                    <div className="flex justify-center p-8">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : (
                    <div className="space-y-6 py-4">
                        {Object.entries(availableAttributes).map(([attrName, values]) => (
                            <div key={attrName} className="space-y-2">
                                <Label className="text-xs font-bold uppercase text-muted-foreground">{attrName}</Label>
                                <div className="flex flex-wrap gap-2">
                                    {values.map(val => {
                                        const isSelected = selectedAttributes[attrName] === val
                                        // TODO: disable values that are not compatible with current selection
                                        return (
                                            <Button
                                                key={val}
                                                variant={isSelected ? "default" : "outline"}
                                                size="sm"
                                                className="h-8 px-3"
                                                onClick={() => handleValueSelect(attrName, val)}
                                            >
                                                {val}
                                            </Button>
                                        )
                                    })}
                                </div>
                            </div>
                        ))}

                        {matchingVariant && (
                            <div className="p-3 bg-muted rounded-md space-y-1">
                                <div className="text-xs font-medium text-muted-foreground">Variante Seleccionada:</div>
                                <div className="font-bold">{matchingVariant.code}</div>
                                <div className="text-sm">Precio: ${Number(matchingVariant.sale_price).toLocaleString()}</div>
                                <div className="text-sm">Stock: {matchingVariant.current_stock || 0}</div>
                            </div>
                        )}

                        {!matchingVariant && allSelected && (
                            <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md">
                                No existe una combinación con estos atributos.
                            </div>
                        )}
                    </div>
                )}

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                    <Button
                        disabled={!matchingVariant}
                        onClick={() => {
                            onSelect(matchingVariant)
                            onOpenChange(false)
                        }}
                    >
                        Confirmar Selección
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
