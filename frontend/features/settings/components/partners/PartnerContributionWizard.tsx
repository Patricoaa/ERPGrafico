"use client"

import React, { useState, useEffect } from "react"
import { 
    Wallet, 
    Package, 
    Users, 
    Warehouse as WarehouseIcon, 
    Info,
    ArrowDownCircle,
    Banknote
} from "lucide-react"
import { GenericWizard, WizardStep } from "@/components/shared/GenericWizard"
import { partnersApi } from "@/features/contacts/api/partnersApi"
import { Partner } from "@/features/contacts/types/partner"
import { TreasuryAccount } from "@/features/treasury/types"
import { Product } from "@/features/inventory/types"
import api from "@/lib/api"
import { ProductSelector } from "@/components/selectors/ProductSelector"
import { LabeledInput, LabeledSelect, LabeledContainer, PeriodValidationDateInput, Chip } from "@/components/shared"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { formatCurrency, cn } from "@/lib/utils"
import { toast } from "sonner"
import { showApiError } from "@/lib/errors"

interface PartnerContributionWizardProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess: () => void
    initialPartnerId?: string
}

type ContributionMethod = "CASH" | "ASSETS"

export function PartnerContributionWizard({
    open,
    onOpenChange,
    onSuccess,
    initialPartnerId
}: PartnerContributionWizardProps) {
    const [loading, setLoading] = useState(false)
    const [isCompleting, setIsCompleting] = useState(false)
    
    // Data lists
    const [partners, setPartners] = useState<Partner[]>([])
    const [warehouses, setWarehouses] = useState<any[]>([])
    const [treasuryAccounts, setTreasuryAccounts] = useState<TreasuryAccount[]>([])
    
    // Form State
    const [partnerId, setPartnerId] = useState(initialPartnerId || "")
    const [method, setMethod] = useState<ContributionMethod>("CASH")
    
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
    const [productDetails, setProductDetails] = useState<Product | null>(null)
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
                            const base = uoms.find((u: { id: number }) => u.id === baseId)
                            if (base) setAssetData(prev => ({ ...prev, uomId: base.id.toString() }))
                        })
                }
            })
            .catch(() => toast.error("Error cargando producto"))
    }, [assetData.productId])

    // Helpers
    const selectedPartner = partners.find(p => p.id.toString() === partnerId)
    const selectedUoM = productUoMs.find(u => u.id.toString() === assetData.uomId)
    const baseUoM = typeof productDetails?.uom === 'object' ? productDetails.uom : productUoMs.find(u => u.id === productDetails?.uom)
    
    const assetTotalValue = (Number(assetData.quantity) || 0) * (Number(assetData.unitCost) || 0)

    const handleComplete = async () => {
        setIsCompleting(true)
        try {
            if (method === "CASH") {
                await partnersApi.createTransaction(parseInt(partnerId), {
                    transaction_type: 'CAPITAL_CASH',
                    amount: parseFloat(cashData.amount),
                    date: cashData.date,
                    treasury_account_id: parseInt(cashData.treasuryAccountId),
                    description: cashData.description
                })
            } else {
                await api.post('/inventory/moves/adjust/', {
                    product_id: assetData.productId,
                    warehouse_id: assetData.warehouseId,
                    quantity: Number(assetData.quantity),
                    uom_id: assetData.uomId || undefined,
                    unit_cost: Number(assetData.unitCost),
                    adjustment_reason: 'PARTNER_CONTRIBUTION',
                    description: assetData.description || 'Aporte de capital en bienes',
                    partner_contact_id: partnerId
                })
            }
            
            toast.success("Aporte registrado exitosamente")
            onSuccess()
            onOpenChange(false)
        } catch (error) {
            showApiError(error, "Error al registrar aporte")
        } finally {
            setIsCompleting(false)
        }
    }

    const steps: WizardStep[] = [
        {
            id: "partner",
            title: "Selección de Socio",
            description: "Identifique quién realiza el aporte",
            isValid: !!partnerId,
            component: (
                <div className="space-y-4 py-4">
                    <LabeledSelect
                        label={<div className="flex items-center"><Users className="h-3.5 w-3.5 mr-1 opacity-50" /> Socio Aportante</div>}
                        value={partnerId}
                        onChange={setPartnerId}
                        disabled={!!initialPartnerId}
                        placeholder="Seleccione un socio"
                        options={partners.map(p => ({
                            value: p.id.toString(),
                            label: (
                                <span>
                                    {p.name}
                                    {p.tax_id && <span className="text-muted-foreground ml-2 font-mono text-[10px]">{p.tax_id}</span>}
                                </span>
                            ),
                        }))}
                    />
                    {selectedPartner && (
                        <div className="p-3 bg-muted/30 border-2 border-dashed rounded-lg space-y-2 animate-in fade-in zoom-in-95 duration-300">
                            <div className="flex justify-between items-center text-[10px] text-muted-foreground uppercase font-black">
                                <span>Estado Societario</span>
                                <Chip size="xs" intent="primary">Activo</Chip>
                            </div>
                            <div className="grid grid-cols-2 gap-4 pt-1">
                                <div className="space-y-0.5">
                                    <p className="text-[9px] text-muted-foreground font-medium uppercase">Capital Pendiente</p>
                                    <p className="text-sm font-black text-warning font-mono">{formatCurrency(selectedPartner.partner_pending_capital)}</p>
                                </div>
                                <div className="space-y-0.5">
                                    <p className="text-[9px] text-muted-foreground font-medium uppercase">Participación</p>
                                    <p className="text-sm font-black text-primary font-mono">{selectedPartner.partner_equity_percentage}%</p>
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
            description: "¿Qué se está aportando?",
            isValid: !!method,
            component: (
                <div className="grid grid-cols-2 gap-4 py-8">
                    <button
                        onClick={() => setMethod("CASH")}
                        className={cn(
                            "group flex flex-col items-center gap-4 p-6 rounded-xl border-2 transition-all text-center",
                            method === "CASH" 
                                ? "border-success bg-success/5 shadow-lg shadow-success/10" 
                                : "border-muted hover:border-success/30 hover:bg-muted/50"
                        )}
                    >
                        <div className={cn(
                            "p-4 rounded-full transition-transform group-hover:scale-110",
                            method === "CASH" ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground"
                        )}>
                            <Wallet className="h-8 w-8" />
                        </div>
                        <div className="space-y-1">
                            <p className="font-black text-sm uppercase tracking-tight">Efectivo</p>
                            <p className="text-[10px] text-muted-foreground leading-tight">Caja, banco o transferencia bancaria electrónica.</p>
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
                            <p className="text-[10px] text-muted-foreground leading-tight">Materias primas, insumos o productos para la venta.</p>
                        </div>
                    </button>
                </div>
            )
        },
        {
            id: "details",
            title: "Detalles del Aporte",
            description: "Complete la información de registro",
            isValid: method === "CASH" 
                ? (!!cashData.amount && !!cashData.treasuryAccountId)
                : (!!assetData.productId && !!assetData.warehouseId && !!assetData.quantity && Number(assetData.unitCost) > 0),
            component: method === "CASH" ? (
                <div className="space-y-4 py-4 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="grid grid-cols-2 gap-4">
                        <LabeledInput
                            label="Importe en Efectivo"
                            type="number"
                            value={cashData.amount}
                            onChange={(e) => setCashData(prev => ({ ...prev, amount: e.target.value }))}
                            className="font-mono text-lg font-black"
                            placeholder="0"
                            icon={<Banknote className="h-4 w-4 opacity-50" />}
                        />
                        <LabeledSelect
                            label="Cuenta de Destino"
                            value={cashData.treasuryAccountId}
                            onChange={(v) => setCashData(prev => ({ ...prev, treasuryAccountId: v }))}
                            options={treasuryAccounts.map(a => ({ label: a.name, value: a.id.toString() }))}
                            placeholder="Seleccione cuenta"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <PeriodValidationDateInput
                            label="Fecha"
                            date={cashData.date ? new Date(cashData.date + 'T12:00:00') : undefined}
                            onDateChange={(d) => {
                                if (!d) {
                                    setCashData(prev => ({ ...prev, date: "" }))
                                    return
                                }
                                setCashData(prev => ({ ...prev, date: d.toISOString().split('T')[0] }))
                            }}
                            validationType="accounting"
                        />
                        <LabeledInput
                            label="Referencia (Opcional)"
                            value={cashData.description}
                            onChange={(e) => setCashData(prev => ({ ...prev, description: e.target.value }))}
                            placeholder="Ej: Aporte inicial"
                        />
                    </div>
                </div>
            ) : (
                <div className="space-y-4 py-4 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="grid grid-cols-[1.5fr_2fr] gap-4">
                        <LabeledSelect
                            label="Almacén de Entrada"
                            value={assetData.warehouseId}
                            onChange={(v) => setAssetData(prev => ({ ...prev, warehouseId: v }))}
                            options={warehouses.map(w => ({ label: w.name, value: w.id.toString() }))}
                            placeholder="Almacén"
                        />
                        <LabeledContainer label="Producto / Recurso">
                            <ProductSelector 
                                value={assetData.productId}
                                onChange={(val) => setAssetData(prev => ({ ...prev, productId: val || "" }))}
                                allowedTypes={["STORABLE", "MANUFACTURABLE"]}
                                simpleOnly={true}
                            />
                        </LabeledContainer>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4">
                        <LabeledInput
                            label="Cantidad"
                            type="number"
                            value={assetData.quantity}
                            onChange={(e) => setAssetData(prev => ({ ...prev, quantity: e.target.value }))}
                            className="font-mono font-bold text-right"
                            placeholder="0.00"
                        />
                        <LabeledSelect
                            label="Unidad"
                            value={assetData.uomId}
                            onChange={(v) => setAssetData(prev => ({ ...prev, uomId: v }))}
                            disabled={productUoMs.length === 0}
                            options={productUoMs.map(u => ({ label: u.name, value: u.id.toString() }))}
                            placeholder="UoM"
                        />
                        <LabeledInput
                            label="Costo Unitario"
                            type="number"
                            value={assetData.unitCost}
                            onChange={(e) => setAssetData(prev => ({ ...prev, unitCost: e.target.value }))}
                            className="font-mono font-bold text-right border-warning/30 bg-warning/5"
                        />
                    </div>

                    {assetTotalValue > 0 && (
                        <Alert className="bg-success/5 border-success/20 py-2">
                            <div className="flex items-center justify-between w-full">
                                <div className="flex items-center gap-2 text-success">
                                    <ArrowDownCircle className="h-4 w-4" />
                                    <span className="text-[10px] font-black uppercase tracking-widest">Valorización Total del Aporte</span>
                                </div>
                                <span className="text-sm font-black text-success font-mono">{formatCurrency(assetTotalValue)}</span>
                            </div>
                        </Alert>
                    )}
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
                    <ArrowDownCircle className="h-5 w-5" />
                    <span>Asistente de Aporte de Capital</span>
                </div>
            }
            steps={steps}
            onComplete={handleComplete}
            isCompleting={isCompleting}
            isLoading={loading}
            completeButtonLabel="Registrar Aporte"
            completeButtonIcon={<ArrowDownCircle className="h-4 w-4" />}
            size="lg"
        />
    )
}
