"use client"

import React, { useState, useEffect } from "react"
import { 
    Wallet, 
    Package, 
    Users, 
    Warehouse as WarehouseIcon, 
    Info,
    ArrowUpCircle,
    Banknote,
    AlertTriangle
} from "lucide-react"
import { GenericWizard, WizardStep } from "@/components/shared/GenericWizard"
import { partnersApi } from "@/features/contacts/api/partnersApi"
import api from "@/lib/api"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { 
    Select, 
    SelectContent, 
    SelectItem, 
    SelectTrigger, 
    SelectValue 
} from "@/components/ui/select"
import { ProductSelector } from "@/components/selectors/ProductSelector"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { formatCurrency, cn } from "@/lib/utils"
import { toast } from "sonner"
import { showApiError } from "@/lib/errors"
import { FORM_STYLES } from "@/lib/styles"

interface PartnerWithdrawalWizardProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess: () => void
    initialPartnerId?: string
}

type WithdrawalMethod = "CASH" | "ASSETS"

export function PartnerWithdrawalWizard({
    open,
    onOpenChange,
    onSuccess,
    initialPartnerId
}: PartnerWithdrawalWizardProps) {
    const [loading, setLoading] = useState(false)
    const [isCompleting, setIsCompleting] = useState(false)
    
    // Data lists
    const [partners, setPartners] = useState<any[]>([])
    const [warehouses, setWarehouses] = useState<any[]>([])
    const [treasuryAccounts, setTreasuryAccounts] = useState<any[]>([])
    
    // Form State
    const [partnerId, setPartnerId] = useState(initialPartnerId || "")
    const [method, setMethod] = useState<WithdrawalMethod>("CASH")
    
    // Cash specific
    const [cashData, setCashData] = useState({
        amount: "",
        treasuryAccountId: "",
        date: new Date().toISOString().split('T')[0],
        description: ""
    })
    
    // Assets specific
    const [assetData, setAssetData] = useState({
        warehouseId: "",
        productId: "",
        quantity: "",
        uomId: "",
        unitCost: "0",
        date: new Date().toISOString().split('T')[0],
        description: ""
    })
    
    // Product details for assets
    const [productDetails, setProductDetails] = useState<any>(null)
    const [productUoMs, setProductUoMs] = useState<any[]>([])

    // Load initial data
    useEffect(() => {
        if (open) {
            setLoading(true)
            Promise.all([
                partnersApi.getPartners(),
                api.get('/inventory/warehouses/'),
                api.get('/treasury/accounts/')
            ]).then(([pData, wRes, aRes]) => {
                setPartners(pData)
                setWarehouses(wRes.data.results || wRes.data)
                setTreasuryAccounts(aRes.data)
                
                if (initialPartnerId) setPartnerId(initialPartnerId)
            }).catch(err => {
                console.error(err)
                toast.error("Error al cargar datos necesarios")
            }).finally(() => setLoading(false))
        } else {
            // Reset
            setPartnerId(initialPartnerId || "")
            setMethod("CASH")
            setCashData({
                amount: "",
                treasuryAccountId: "",
                date: new Date().toISOString().split('T')[0],
                description: ""
            })
            setAssetData({
                warehouseId: "",
                productId: "",
                quantity: "",
                uomId: "",
                unitCost: "0",
                date: new Date().toISOString().split('T')[0],
                description: ""
            })
            setProductDetails(null)
            setProductUoMs([])
        }
    }, [open, initialPartnerId])

    // Load product details when productId changes
    useEffect(() => {
        if (!assetData.productId) {
            setProductDetails(null)
            setProductUoMs([])
            return
        }
        
        api.get(`/inventory/products/${assetData.productId}/`)
            .then(res => {
                const data = res.data
                setProductDetails(data)
                setAssetData(prev => ({ ...prev, unitCost: data.cost_price?.toString() || "0" }))

                if (data.uom_category) {
                    api.get(`/inventory/uoms/?category=${data.uom_category}`)
                        .then(uomRes => {
                            const uoms = uomRes.data.results || uomRes.data
                            setProductUoMs(uoms)
                            const baseId = typeof data.uom === 'object' ? data.uom.id : data.uom
                            const base = uoms.find((u: any) => u.id === baseId)
                            if (base) setAssetData(prev => ({ ...prev, uomId: base.id.toString() }))
                        })
                }
            })
            .catch(() => toast.error("Error cargando producto"))
    }, [assetData.productId])

    // Helpers
    const selectedPartner = partners.find(p => p.id.toString() === partnerId)
    const assetTotalValue = (Number(assetData.quantity) || 0) * (Number(assetData.unitCost) || 0)

    const handleComplete = async () => {
        setIsCompleting(true)
        try {
            if (method === "CASH") {
                await partnersApi.createTransaction(parseInt(partnerId), {
                    transaction_type: 'PROV_WITHDRAWAL',
                    amount: parseFloat(cashData.amount),
                    date: cashData.date,
                    treasury_account_id: parseInt(cashData.treasuryAccountId),
                    description: cashData.description || 'Retiro Provisorio de Utilidades'
                })
            } else {
                await api.post('/inventory/moves/adjust/', {
                    product_id: assetData.productId,
                    warehouse_id: assetData.warehouseId,
                    quantity: -Number(assetData.quantity), // Negative for withdrawal
                    uom_id: assetData.uomId || undefined,
                    unit_cost: Number(assetData.unitCost),
                    adjustment_reason: 'PARTNER_WITHDRAWAL',
                    description: assetData.description || 'Retiro de capital en bienes',
                    partner_contact_id: partnerId
                })
            }
            
            toast.success("Retiro registrado exitosamente")
            onSuccess()
            onOpenChange(false)
        } catch (error) {
            showApiError(error, "Error al registrar retiro")
        } finally {
            setIsCompleting(false)
        }
    }

    const steps: WizardStep[] = [
        {
            id: "partner",
            title: "Selección de Socio",
            description: "Identifique quién realiza el retiro",
            isValid: !!partnerId,
            component: (
                <div className="space-y-4 py-4">
                    <div className="space-y-1.5">
                        <Label className={FORM_STYLES.label}>
                            <Users className="inline h-3.5 w-3.5 mr-1 opacity-50" />
                            Socio Solicitante
                        </Label>
                        <Select value={partnerId} onValueChange={setPartnerId} disabled={!!initialPartnerId}>
                            <SelectTrigger className={cn(FORM_STYLES.input, "border-destructive/20 bg-destructive/5")}>
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
                    {selectedPartner && (
                        <div className="p-3 bg-destructive/5 border-2 border-dashed border-destructive/20 rounded-lg space-y-2 animate-in fade-in zoom-in-95 duration-300">
                            <div className="flex justify-between items-center text-[10px] text-muted-foreground uppercase font-black">
                                <span>Pasivo con el Socio</span>
                                <Badge variant="outline" className="h-4 py-0 text-[8px] border-destructive/20 text-destructive uppercase">Deuda del Socio</Badge>
                            </div>
                            <div className="grid grid-cols-2 gap-4 pt-1">
                                <div className="space-y-0.5">
                                    <p className="text-[9px] text-muted-foreground font-medium uppercase">Retiros Acumulados</p>
                                    <p className="text-sm font-black text-destructive font-mono">{formatCurrency(selectedPartner.partner_provisional_withdrawals_balance)}</p>
                                </div>
                                <div className="space-y-0.5">
                                    <p className="text-[9px] text-muted-foreground font-medium uppercase">Utilidades x Distribuir</p>
                                    <p className="text-sm font-black text-success font-mono">{formatCurrency(selectedPartner.partner_earnings_balance)}</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )
        },
        {
            id: "method",
            title: "Tipo de Recurso",
            description: "¿Qué se está retirando?",
            isValid: !!method,
            component: (
                <div className="grid grid-cols-2 gap-4 py-8">
                    <button
                        onClick={() => setMethod("CASH")}
                        className={cn(
                            "group flex flex-col items-center gap-4 p-6 rounded-xl border-2 transition-all text-center",
                            method === "CASH" 
                                ? "border-destructive bg-destructive/5 shadow-lg shadow-destructive/10" 
                                : "border-muted hover:border-destructive/30 hover:bg-muted/50"
                        )}
                    >
                        <div className={cn(
                            "p-4 rounded-full transition-transform group-hover:scale-110",
                            method === "CASH" ? "bg-destructive text-destructive-foreground" : "bg-muted text-muted-foreground"
                        )}>
                            <Wallet className="h-8 w-8" />
                        </div>
                        <div className="space-y-1">
                            <p className="font-black text-sm uppercase tracking-tight">Efectivo</p>
                            <p className="text-[10px] text-muted-foreground leading-tight">Egreso de caja o transferencia bancaria.</p>
                        </div>
                    </button>
                    
                    <button
                        onClick={() => setMethod("ASSETS")}
                        className={cn(
                            "group flex flex-col items-center gap-4 p-6 rounded-xl border-2 transition-all text-center",
                            method === "ASSETS" 
                                ? "border-warning bg-warning/5 shadow-lg shadow-warning/10" 
                                : "border-muted hover:border-warning/30 hover:bg-muted/50"
                        )}
                    >
                        <div className={cn(
                            "p-4 rounded-full transition-transform group-hover:scale-110",
                            method === "ASSETS" ? "bg-warning text-warning-foreground" : "bg-muted text-muted-foreground"
                        )}>
                            <Package className="h-8 w-8" />
                        </div>
                        <div className="space-y-1">
                            <p className="font-black text-sm uppercase tracking-tight">Bienes / Stock</p>
                            <p className="text-[10px] text-muted-foreground leading-tight">Retiro de mercaderías o productos del inventario.</p>
                        </div>
                    </button>
                </div>
            )
        },
        {
            id: "details",
            title: "Detalles del Retiro",
            description: "Complete la información de registro",
            isValid: method === "CASH" 
                ? (!!cashData.amount && !!cashData.treasuryAccountId)
                : (!!assetData.productId && !!assetData.warehouseId && !!assetData.quantity),
            component: method === "CASH" ? (
                <div className="space-y-4 py-4 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label className={FORM_STYLES.label}>Importe a Retirar</Label>
                            <div className="relative">
                                <Banknote className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input 
                                    type="number"
                                    value={cashData.amount}
                                    onChange={(e) => setCashData(prev => ({ ...prev, amount: e.target.value }))}
                                    className={cn(FORM_STYLES.input, "pl-10 font-mono text-lg font-black text-destructive")}
                                    placeholder="0"
                                />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label className={FORM_STYLES.label}>Cuenta de Origen</Label>
                            <Select 
                                value={cashData.treasuryAccountId} 
                                onValueChange={(v) => setCashData(prev => ({ ...prev, treasuryAccountId: v }))}
                            >
                                <SelectTrigger className={FORM_STYLES.input}>
                                    <SelectValue placeholder="Seleccione cuenta" />
                                </SelectTrigger>
                                <SelectContent>
                                    {treasuryAccounts.map(a => (
                                        <SelectItem key={a.id} value={a.id.toString()}>{a.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label className={FORM_STYLES.label}>Fecha</Label>
                            <Input 
                                type="date"
                                value={cashData.date}
                                onChange={(e) => setCashData(prev => ({ ...prev, date: e.target.value }))}
                                className={FORM_STYLES.input}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className={FORM_STYLES.label}>Referencia (Opcional)</Label>
                            <Input 
                                value={cashData.description}
                                onChange={(e) => setCashData(prev => ({ ...prev, description: e.target.value }))}
                                className={FORM_STYLES.input}
                                placeholder="Ej: Adelanto utilidades Octubre"
                            />
                        </div>
                    </div>
                </div>
            ) : (
                <div className="space-y-4 py-4 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="grid grid-cols-[1.5fr_2fr] gap-4">
                        <div className="space-y-1.5">
                            <Label className={FORM_STYLES.label}>Almacén de Salida</Label>
                            <Select 
                                value={assetData.warehouseId} 
                                onValueChange={(v) => setAssetData(prev => ({ ...prev, warehouseId: v }))}
                            >
                                <SelectTrigger className={FORM_STYLES.input}>
                                    <SelectValue placeholder="Almacén" />
                                </SelectTrigger>
                                <SelectContent>
                                    {warehouses.map(w => (
                                        <SelectItem key={w.id} value={w.id.toString()}>{w.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label className={FORM_STYLES.label}>Producto / Recurso</Label>
                            <ProductSelector 
                                value={assetData.productId}
                                onChange={(val) => setAssetData(prev => ({ ...prev, productId: val || "" }))}
                                allowedTypes={["STORABLE", "MANUFACTURABLE"]}
                                simpleOnly={true}
                            />
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-1.5">
                            <Label className={FORM_STYLES.label}>Cantidad</Label>
                            <Input 
                                type="number"
                                value={assetData.quantity}
                                onChange={(e) => setAssetData(prev => ({ ...prev, quantity: e.target.value }))}
                                className={cn(FORM_STYLES.input, "font-mono font-bold text-right text-destructive")}
                                placeholder="0.00"
                            />
                        </div>
                        <div className="space-y-1.5 font-mono">
                            <Label className={FORM_STYLES.label}>Stock Actual</Label>
                            <div className="h-9 px-3 flex items-center bg-muted/50 rounded border text-[11px] font-bold">
                                {productDetails?.qty_on_hand ?? '0'} {productDetails?.uom_name ?? ''}
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label className={FORM_STYLES.label}>Costo Unitario (Info)</Label>
                            <Input 
                                type="text"
                                readOnly
                                value={formatCurrency(productDetails?.cost_price || 0)}
                                className={cn(FORM_STYLES.input, "font-mono font-bold text-right opacity-60 bg-muted/50")}
                            />
                        </div>
                    </div>

                    <Alert className="bg-destructive/5 border-destructive/20 py-2">
                        <div className="flex items-center gap-2 text-destructive">
                            <AlertTriangle className="h-4 w-4" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Atención: Esta operación disminuye el stock disponible.</span>
                        </div>
                    </Alert>
                </div>
            )
        }
    ]

    return (
        <GenericWizard
            open={open}
            onOpenChange={onOpenChange}
            title={
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded bg-destructive/10 text-destructive">
                        <ArrowUpCircle className="h-5 w-5" />
                    </div>
                    <span>Asistente de Retiro de Capital / Utilidades</span>
                </div>
            }
            steps={steps}
            onComplete={handleComplete}
            isCompleting={isCompleting}
            isLoading={loading}
            completeButtonLabel="Confirmar Retiro"
            completeButtonIcon={<ArrowUpCircle className="h-4 w-4" />}
            size="lg"
        />
    )
}
