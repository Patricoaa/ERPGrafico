"use client"

import { showApiError } from "@/lib/errors"
import React, { useState, useEffect } from "react"
import {
    Package,
    ArrowDownCircle,
    ArrowUpCircle,
    Loader2,
    Users,
    Info,
    Warehouse as WarehouseIcon
} from "lucide-react"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { BaseModal } from "@/components/shared/BaseModal"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { ProductSelector } from "@/components/selectors/ProductSelector"
import { toast } from "sonner"
import { formatCurrency } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import api from "@/lib/api"
import { partnersApi } from "@/features/contacts/api/partnersApi"
import { FORM_STYLES } from "@/lib/styles"
import { cn } from "@/lib/utils"
import { Partner } from "@/features/contacts/types/partner"
import { Product } from "@/features/inventory/types"

interface InventoryContributionModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess?: () => void
    preSelectedPartnerId?: number
}



interface Warehouse {
    id: number
    name: string
}

interface UoM {
    id: number
    name: string
    ratio: number
}

export function InventoryContributionModal({
    open,
    onOpenChange,
    onSuccess,
    preSelectedPartnerId
}: InventoryContributionModalProps) {
    const [moveType, setMoveType] = useState<"IN" | "OUT">("IN")
    const [partners, setPartners] = useState<Partner[]>([])
    const [warehouses, setWarehouses] = useState<Warehouse[]>([])
    const [productUoMs, setProductUoMs] = useState<UoM[]>([])
    const [isLoading, setIsLoading] = useState(false)

    // Form state
    const [partnerId, setPartnerId] = useState("")
    const [productId, setProductId] = useState("")
    const [warehouseId, setWarehouseId] = useState("")
    const [quantity, setQuantity] = useState("")
    const [uomId, setUomId] = useState("")
    const [unitCost, setUnitCost] = useState("0")
    const [description, setDescription] = useState("")
    const [productDetails, setProductDetails] = useState<Product | null>(null)

    // Load initial data
    useEffect(() => {
        if (!open) return
        const fetchData = async () => {
            try {
                const [pData, wRes] = await Promise.all([
                    partnersApi.getPartners(),
                    api.get<{ results?: Warehouse[] } | Warehouse[]>('/inventory/warehouses/')
                ])
                setPartners(pData)
                const wData = 'results' in wRes.data ? wRes.data.results : wRes.data
                setWarehouses(Array.isArray(wData) ? wData : [])
            } catch {
                toast.error("Error cargando datos")
            }
        }
        fetchData()
    }, [open])

    // Pre-select partner
    useEffect(() => {
        if (preSelectedPartnerId) {
            setPartnerId(preSelectedPartnerId.toString())
        }
    }, [preSelectedPartnerId])

    // Fetch product details when product changes
    useEffect(() => {
        if (!productId) {
            setProductDetails(null)
            setProductUoMs([])
            setUomId("")
            return
        }
        api.get<Product>(`/inventory/products/${productId}/`)
            .then(res => {
                const data = res.data
                setProductDetails(data)
                setUnitCost(data.cost_price?.toString() || "0")

                if (data.uom_category) {
                    return api.get<{ results?: UoM[] } | UoM[]>(`/inventory/uoms/?category=${data.uom_category}`)
                        .then(uomRes => {
                            const uomData = uomRes.data
                            const uoms = Array.isArray(uomData) ? uomData : (uomData.results || [])
                            setProductUoMs(uoms)
                            const baseId = typeof data.uom === 'object' ? data.uom.id : data.uom
                            const base = uoms.find((u: UoM) => u.id === baseId)
                            if (base) setUomId(base.id.toString())
                        })
                }
            })
            .catch(() => toast.error("Error cargando producto"))
    }, [productId])

    // Reset form when modal closes
    useEffect(() => {
        if (!open) {
            setMoveType("IN")
            setProductId("")
            setWarehouseId("")
            setQuantity("")
            setUomId("")
            setUnitCost("0")
            setDescription("")
            setProductDetails(null)
            setProductUoMs([])
            if (!preSelectedPartnerId) setPartnerId("")
        }
    }, [open, preSelectedPartnerId])

    const selectedUoM = productUoMs.find(u => u.id.toString() === uomId)
    const baseUoM = typeof productDetails?.uom === 'object' ? productDetails.uom : productUoMs.find(u => u.id === productDetails?.uom)
    const isCostEditable = moveType === 'IN'

    const conversion = React.useMemo(() => {
        if (!quantity || !uomId || !baseUoM || !productUoMs.length) return null

        if (!selectedUoM || selectedUoM.id === baseUoM.id) return null

        const qtyNum = Number(quantity)
        const costNum = Number(unitCost)

        // Conversion formula
        const ratioInBase = (selectedUoM.ratio / baseUoM.ratio)
        const qtyInBase = qtyNum * ratioInBase
        const costInBase = costNum / ratioInBase

        return {
            qty: qtyInBase,
            cost: costInBase
        }
    }, [quantity, uomId, baseUoM, productUoMs, unitCost, selectedUoM])

    const totalValue = (Number(quantity) || 0) * (Number(unitCost) || 0)

    const handleSubmit = async () => {
        // Validations
        if (!partnerId) return toast.error("Debe seleccionar un socio")
        if (!productId) return toast.error("Debe seleccionar un producto")
        if (!warehouseId) return toast.error("Debe seleccionar un almacén")
        if (!quantity || Number(quantity) <= 0) return toast.error("La cantidad debe ser mayor a 0")
        if (moveType === 'IN' && Number(unitCost) <= 0) return toast.error("Debe indicar un costo unitario para el aporte")

        setIsLoading(true)
        try {
            const qty = Number(quantity)
            const finalQty = moveType === 'OUT' ? -qty : qty

            await api.post('/inventory/moves/adjust/', {
                product_id: productId,
                warehouse_id: warehouseId,
                quantity: finalQty,
                uom_id: uomId || undefined,
                unit_cost: Number(unitCost),
                adjustment_reason: moveType === 'IN' ? 'PARTNER_CONTRIBUTION' : 'PARTNER_WITHDRAWAL',
                description: description || (moveType === 'IN' ? 'Aporte de capital en bienes' : 'Retiro de capital en bienes'),
                partner_contact_id: partnerId
            })

            toast.success(moveType === 'IN' ? "Aporte en bienes registrado" : "Retiro en bienes registrado")
            onOpenChange(false)
            onSuccess?.()
        } catch (error: unknown) {
            console.error(error)
            showApiError(error, "Error al registrar movimiento")
        } finally {
            setIsLoading(false)
        }
    }

    const footerContent = (
        <div className="flex w-full gap-3 justify-end">
            <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="rounded-lg text-xs font-bold border-primary/20 hover:bg-primary/5"
            >
                Cancelar
            </Button>
            <Button
                onClick={handleSubmit}
                disabled={isLoading}
                className={cn(
                    "rounded-lg text-xs font-bold",
                    moveType === 'IN' ? 'bg-success hover:bg-success/90 text-primary-foreground' : 'bg-destructive hover:bg-destructive/90 text-primary-foreground'
                )}
            >
                {isLoading ? (
                    <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Procesando...
                    </>
                ) : (
                    moveType === 'IN' ? "Registrar Aporte" : "Registrar Retiro"
                )}
            </Button>
        </div>
    )

    return (
        <BaseModal
            open={open}
            onOpenChange={onOpenChange}
            size="lg"
            title={
                <div className="flex items-center gap-3">
                    <Package className="h-5 w-5" />
                    Aporte / Retiro de Bienes
                </div>
            }
            description={
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-widest mt-1.5 pl-0 sm:pl-[2px]">
                    Registro Societario <span className="opacity-30">|</span> Movimiento de Stock
                </div>
            }
            footer={footerContent}
        >
            <div className="space-y-5">
                {/* Type Tabs */}
                <Tabs value={moveType} onValueChange={(v) => setMoveType(v as "IN" | "OUT")} className="w-full">
                    <TabsList className="grid w-full grid-cols-2 bg-muted/50 rounded-full h-11 p-1 border">
                        <TabsTrigger
                            value="IN"
                            className="rounded-full text-[11px] uppercase font-bold tracking-wider data-[state=active]:bg-background data-[state=active]:text-success data-[state=active]:border data-[state=active]:border-success/20 data-[state=active]:shadow-sm h-full"
                        >
                            <ArrowDownCircle className="mr-2 h-4 w-4" />
                            Aporte
                        </TabsTrigger>
                        <TabsTrigger
                            value="OUT"
                            className="rounded-full text-[11px] uppercase font-bold tracking-wider data-[state=active]:bg-background data-[state=active]:text-destructive data-[state=active]:border data-[state=active]:border-destructive/20 data-[state=active]:shadow-sm h-full"
                        >
                            <ArrowUpCircle className="mr-2 h-4 w-4" />
                            Retiro
                        </TabsTrigger>
                    </TabsList>
                </Tabs>

                {/* Section: Clasificación */}
                <div className="flex items-center gap-2 pt-2 pb-2">
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Clasificación</span>
                    <div className="flex-1 h-px bg-border" />
                </div>

                {/* Partner Selector */}
                <div className="space-y-1.5">
                    <Label className={FORM_STYLES.label}>
                        <Users className="inline h-3.5 w-3.5 mr-1 opacity-50" />
                        Socio
                    </Label>
                    <Select value={partnerId} onValueChange={setPartnerId} disabled={!!preSelectedPartnerId}>
                        <SelectTrigger className={cn(FORM_STYLES.input, "border-warning/20 bg-warning/5")}>
                            <SelectValue placeholder="Seleccione un socio" />
                        </SelectTrigger>
                        <SelectContent>
                            {partners.map(p => (
                                <SelectItem key={p.id} value={p.id.toString()}>
                                    {p.name}
                                    {p.tax_id && <span className="text-muted-foreground ml-2 font-mono text-[10px]">{p.tax_id}</span>}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* Section: Producto y Ubicación */}
                <div className="flex items-center gap-2 pt-2 pb-2">
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Almacén y Producto</span>
                    <div className="flex-1 h-px bg-border" />
                </div>

                {/* Product & Warehouse (Side by Side) */}
                <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-4">
                    <div className="space-y-1.5">
                        <Label className={FORM_STYLES.label}>
                            <WarehouseIcon className="inline h-3.5 w-3.5 mr-1 opacity-50" />
                            Almacén
                        </Label>
                        <Select value={warehouseId} onValueChange={setWarehouseId}>
                            <SelectTrigger className={FORM_STYLES.input}>
                                <SelectValue placeholder="Seleccione almacén" />
                            </SelectTrigger>
                            <SelectContent>
                                {warehouses.map(w => (
                                    <SelectItem key={w.id} value={w.id.toString()}>{w.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1.5">
                        <Label className={FORM_STYLES.label}>
                            <Package className="inline h-3.5 w-3.5 mr-1 opacity-50" />
                            Producto
                        </Label>
                        <ProductSelector
                            value={productId}
                            onChange={(val) => setProductId(val || "")}
                            allowedTypes={["STORABLE", "MANUFACTURABLE"]}
                            simpleOnly={true}
                        />
                    </div>
                </div>

                {/* Section: Detalles del Movimiento */}
                <div className="flex items-center gap-2 pt-2 pb-2">
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Detalles del Movimiento</span>
                    <div className="flex-1 h-px bg-border" />
                </div>

                {/* Quantity, UoM & Cost */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                        <Label className={FORM_STYLES.label}>Cantidad</Label>
                        <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={quantity}
                            onChange={(e) => setQuantity(e.target.value)}
                            className={cn(FORM_STYLES.input, "text-right font-mono")}
                            placeholder="0"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label className={FORM_STYLES.label}>Unidad de Medida</Label>
                        <Select value={uomId} onValueChange={setUomId} disabled={productUoMs.length === 0}>
                            <SelectTrigger className={FORM_STYLES.input}>
                                <SelectValue placeholder="UoM" />
                            </SelectTrigger>
                            <SelectContent>
                                {productUoMs.map(u => (
                                    <SelectItem key={u.id} value={u.id.toString()}>{u.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1.5 bg-muted/20 pb-2 pt-1 border border-transparent rounded-lg px-2 -mx-2 sm:mx-0">
                        <Label className={cn(FORM_STYLES.label, "flex justify-between")}>
                            <span>Costo {selectedUoM ? `(${selectedUoM.name})` : ''}</span>
                            {isCostEditable && <Badge variant="outline" className="text-[8px] h-4 py-0 leading-tight border-warning/30 text-warning bg-warning/10">Editable</Badge>}
                        </Label>
                        <Input
                            type={isCostEditable ? "number" : "text"}
                            step={isCostEditable ? "0.01" : undefined}
                            min="0"
                            readOnly={!isCostEditable}
                            value={isCostEditable ? unitCost : formatCurrency(Number(unitCost))}
                            onChange={(e) => isCostEditable && setUnitCost(e.target.value)}
                            className={cn(FORM_STYLES.input, "text-right font-mono text-sm", !isCostEditable && "opacity-80 bg-muted/50 focus-visible:ring-0 cursor-default")}
                        />
                        <div className="flex justify-between text-[11px] items-center px-1 font-bold">
                            <span className="text-muted-foreground mr-1">V. Total:</span>
                            <span className="text-primary text-xs font-black font-mono">
                                {formatCurrency(totalValue)}
                            </span>
                        </div>
                    </div>
                </div>

                {conversion && baseUoM && (
                    <Alert className="bg-info/5 border-info/20 text-info py-2">
                        <Info className="h-4 w-4 text-info" />
                        <AlertDescription className="text-xs ml-2">
                            Se registrará formalmente como <strong>{conversion.qty.toFixed(4)} {baseUoM.name}</strong> a un costo base de <strong>{formatCurrency(conversion.cost)} c/u</strong>.
                        </AlertDescription>
                    </Alert>
                )}

                {/* Stock Info */}
                {productDetails && (
                    <div className="flex items-center gap-4 text-[10px] font-medium text-muted-foreground bg-muted/30 p-2.5 rounded-lg border">
                        <span>Stock actual: <strong className="font-mono">{productDetails.qty_on_hand ?? '—'}</strong></span>
                        <span>Costo promedio: <strong className="font-mono">{formatCurrency(productDetails.cost_price || 0)}</strong></span>
                    </div>
                )}

                {/* Description */}
                <div className="space-y-1.5">
                    <Label className={FORM_STYLES.label}>Notas / Referencia</Label>
                    <Input
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder={moveType === 'IN' ? "Ej: Aporte inicial de maquinaria" : "Ej: Retiro de materiales por socio"}
                        className={FORM_STYLES.input}
                    />
                </div>
            </div>
        </BaseModal>
    )
}
