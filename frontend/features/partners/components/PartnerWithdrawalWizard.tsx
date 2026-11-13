"use client"
import { formatCurrency } from "@/lib/money"

import React, { useState } from "react"
import {
    Wallet,
    Package,
    Users,
    ArrowUpCircle,
    Banknote
} from "lucide-react"
import { Banner, LabeledInput, LabeledSelect, LabeledContainer, PeriodValidationDateInput, Chip, DataCell, ChoiceCard, ChoiceGroup, GenericWizard, FadeIn, type WizardStep } from "@/components/shared"
import { usePartners } from "@/features/contacts"
import { type TreasuryAccount } from "@/features/treasury"
import { useTreasuryAccounts } from "@/features/settings"
import { usePartnerMutations, usePartnerWarehouses, usePartnerInventoryAdjustment, usePartnerAssetEntry, useOnOpen } from "../hooks"
import { ProductSelector } from "@/components/selectors/ProductSelector"

import { toast } from "sonner"
import { showApiError } from "@/lib/errors"

interface PartnerWithdrawalWizardProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess?: () => void
    initialPartnerId?: string
}

type WithdrawalMethod = "CASH" | "ASSETS"

export function PartnerWithdrawalWizard({
    open,
    onOpenChange,
    onSuccess,
    initialPartnerId
}: PartnerWithdrawalWizardProps) {
    const [isCompleting, setIsCompleting] = useState(false)

    // Data lists (cacheadas por TanStack Query)
    const { partners, isLoading: partnersLoading } = usePartners()
    const { data: warehouses = [], isLoading: warehousesLoading } = usePartnerWarehouses(open)
    const { data: accountsData, isLoading: accountsLoading } = useTreasuryAccounts(open)
    const treasuryAccounts = (accountsData ?? []) as unknown as TreasuryAccount[]
    const loading = open && (partnersLoading || warehousesLoading || accountsLoading)
    const { createTransaction } = usePartnerMutations()
    const inventoryAdjustment = usePartnerInventoryAdjustment()

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

    // Assets specific (borrador, producto y UoM base)
    const { assetData, setAssetData, productDetails, reset: resetAssets } = usePartnerAssetEntry()

    const resetForm = () => {
        setPartnerId(initialPartnerId || "")
        setMethod("CASH")
        setCashData({
            amount: "",
            treasuryAccountId: "",
            date: new Date().toISOString().split('T')[0],
            description: ""
        })
        resetAssets()
    }

    useOnOpen(open, () => { if (initialPartnerId) setPartnerId(initialPartnerId) }, resetForm)

    // Helpers
    const selectedPartner = partners.find(p => p.id.toString() === partnerId)
    const handleComplete = async () => {
        setIsCompleting(true)
        try {
            if (method === "CASH") {
                await createTransaction.mutateAsync({
                    contactId: parseInt(partnerId),
                    data: {
                        transaction_type: 'PROV_WITHDRAWAL',
                        amount: parseFloat(cashData.amount),
                        date: cashData.date,
                        treasury_account_id: parseInt(cashData.treasuryAccountId),
                        description: cashData.description || 'Retiro Provisorio de Utilidades'
                    }
                })
            } else {
                await inventoryAdjustment.mutateAsync({
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
            onSuccess?.()
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
                    <LabeledSelect
                        label={<div className="flex items-center"><Users className="h-3.5 w-3.5 mr-1 opacity-50" /> Socio Solicitante</div>}
                        value={partnerId}
                        onChange={setPartnerId}
                        disabled={!!initialPartnerId}
                        placeholder="Seleccione un socio"
                        options={partners.map(p => ({
                            value: p.id.toString(),
                            label: (
                                <span>
                                    {p.name}
                                    {p.tax_id && <span className="text-muted-foreground ml-2 font-mono text-3xs">{p.tax_id}</span>}
                                </span>
                            ),
                        }))}
                    />
                    {selectedPartner && (
                        <FadeIn className="p-3 bg-destructive/5 border-2 border-dashed border-destructive/20 rounded-md space-y-2">
                            <div className="flex justify-between items-center text-3xs text-muted-foreground uppercase font-bold">
                                <span>Pasivo con el Socio</span>
                                <Chip size="xs" intent="destructive">Deuda del Socio</Chip>
                            </div>
                            <div className="grid grid-cols-2 gap-4 pt-1">
                                <div className="space-y-0.5">
                                    <p className="text-4xs text-muted-foreground font-medium uppercase">Retiros Acumulados</p>
                                    <p className="text-sm font-black font-mono"><DataCell.CurrencyFlow value={selectedPartner.partner_provisional_withdrawals_balance} direction="outflow" showIcon={false} /></p>
                                </div>
                                <div className="space-y-0.5">
                                    <p className="text-4xs text-muted-foreground font-medium uppercase">Utilidades x Distribuir</p>
                                    <p className="text-sm font-black font-mono"><DataCell.CurrencyFlow value={selectedPartner.partner_earnings_balance} direction="inflow" showIcon={false} /></p>
                                </div>
                            </div>
                        </FadeIn>
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
                <ChoiceGroup
                    label="Tipo de Recurso"
                    columns="grid-cols-2"
                    activation="select"
                >
                    <ChoiceCard
                        variant="light"
                        selected={method === "CASH"}
                        onSelect={() => setMethod("CASH")}
                        title="Efectivo"
                        description="Egreso de caja o transferencia bancaria."
                        icon={Wallet}
                    />
                    <ChoiceCard
                        variant="light"
                        selected={method === "ASSETS"}
                        onSelect={() => setMethod("ASSETS")}
                        title="Bienes / Stock"
                        description="Retiro de mercaderías o productos del inventario."
                        icon={Package}
                    />
                </ChoiceGroup>
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
                <FadeIn className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <LabeledInput
                            label="Importe a Retirar"
                            type="number"
                            value={cashData.amount}
                            onChange={(e) => setCashData(prev => ({ ...prev, amount: e.target.value }))}
                            className="font-mono text-lg font-black text-destructive"
                            placeholder="0"
                            icon={<Banknote className="h-4 w-4 opacity-50" />}
                        />
                        <LabeledSelect
                            label="Cuenta de Origen"
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
                            placeholder="Ej: Adelanto utilidades Octubre"
                        />
                    </div>
                </FadeIn>
            ) : (
                <FadeIn className="space-y-4 py-4">
                    <div className="grid grid-cols-[1.5fr_2fr] gap-4">
                        <LabeledSelect
                            label="Almacén de Salida"
                            value={assetData.warehouseId}
                            onChange={(v) => setAssetData(prev => ({ ...prev, warehouseId: v }))}
                            options={warehouses.map(w => ({ label: w.name, value: w.id.toString() }))}
                            placeholder="Almacén"
                        />
                        <LabeledContainer label="Producto / Recurso">
                            <ProductSelector
                                value={assetData.productId}
                                onChange={(val) => setAssetData(prev => ({ ...prev, productId: val || "" }))}
                                productTypes={["STORABLE", "MANUFACTURABLE"]}
                                customFilter={(p) =>
                                    !(p.product_type === 'MANUFACTURABLE' && (p.requires_advanced_manufacturing || p.mfg_auto_finalize))
                                }
                            />
                        </LabeledContainer>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <LabeledInput
                            label="Cantidad"
                            type="number"
                            value={assetData.quantity}
                            onChange={(e) => setAssetData(prev => ({ ...prev, quantity: e.target.value }))}
                            className="font-mono font-bold text-right text-destructive"
                            placeholder="0.00"
                        />
                        <div className="space-y-1.5 font-mono">
                            <span className="text-3xs font-bold uppercase tracking-wider text-muted-foreground">Stock Actual</span>
                            <div className="h-10 px-3 flex items-center bg-muted/50 rounded-md border border-border/50 text-sm font-medium">
                                {productDetails?.qty_on_hand ?? '0'} {productDetails?.uom_name ?? ''}
                            </div>
                        </div>
                        <LabeledInput
                            label="Costo Unitario (Info)"
                            type="text"
                            readOnly
                            value={formatCurrency(productDetails?.cost_price || 0)}
                            className="font-mono font-bold text-right opacity-60 bg-muted/50"
                        />
                    </div>

                    <Banner tone="destructive" bleed="lg" title="Atención: esta operación disminuye el stock disponible" />
                </FadeIn>
            )
        }
    ]

    return (
        <GenericWizard
            open={open}
            onOpenChange={onOpenChange}
            title={
                <div className="flex items-center gap-3">
                    <ArrowUpCircle className="h-5 w-5" />
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
