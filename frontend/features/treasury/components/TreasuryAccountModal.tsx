"use client"

import React, { useState, useEffect } from "react"
import { useTreasuryAccounts, type TreasuryAccount, treasuryApi } from "@/features/treasury"
import { BaseModal } from "@/components/shared/BaseModal"

import { Loader2, Landmark, CreditCard, Lock } from "lucide-react"
import { AccountSelector } from "@/components/selectors/AccountSelector"
import { ActivitySidebar } from "@/features/audit/components/ActivitySidebar"

import { CancelButton, LabeledInput, LabeledSelect, ActionSlideButton } from "@/components/shared"

interface TreasuryAccountModalProps {
    open: boolean
    onOpenChange: (o: boolean) => void
    accountId?: number | null
    onSuccess?: () => void
}

const SYSTEM_MANAGED_TYPES = new Set(['BRIDGE', 'MERCHANT'])

export function TreasuryAccountModal({ open, onOpenChange, accountId, onSuccess }: TreasuryAccountModalProps) {
    const { createAccount, updateAccount, isCreating, isUpdating } = useTreasuryAccounts()
    const [account, setAccount] = useState<TreasuryAccount | null>(null)
    const [loading, setLoading] = useState(false)

    const [name, setName] = useState("")
    const [type, setType] = useState<string>("CASH")
    const [currency, setCurrency] = useState("CLP")
    const [accountingAccount, setAccountingAccount] = useState<number | null>(null)
    const [bank, setBank] = useState<number | null>(null)
    const [accountNumber, setAccountNumber] = useState("")
    const [banks, setBanks] = useState<any[]>([])

    const isSubmitting = isCreating || isUpdating
    const isSystemManaged = SYSTEM_MANAGED_TYPES.has(type)

    useEffect(() => {
        const fetchData = async () => {
            if (!open) return
            try {
                setLoading(true)
                const [banksData, accountData] = await Promise.all([
                    treasuryApi.getBanks(),
                    accountId ? treasuryApi.getAccount(accountId) : Promise.resolve(null)
                ])

                requestAnimationFrame(() => {
                    setBanks(banksData)
                    if (accountData) {
                        setAccount(accountData)
                        setName(accountData.name)
                        setType(accountData.account_type)
                        setCurrency(accountData.currency)
                        setAccountingAccount(accountData.account ? Number(accountData.account) : null)
                        setBank(accountData.bank ? Number(accountData.bank) : null)
                        setAccountNumber(accountData.account_number || "")
                    } else {
                        setAccount(null)
                        setName("")
                        setType("CASH")
                        setCurrency("CLP")
                        setAccountingAccount(null)
                        setBank(null)
                        setAccountNumber("")
                    }
                })
            } catch (err) {
                console.error("Error fetching account data", err)
            } finally {
                setLoading(false)
            }
        }
        fetchData()
    }, [open, accountId])

    const requiresBank = (accountType: string) => {
        return ['CHECKING', 'CREDIT_CARD', 'DEBIT_CARD'].includes(accountType)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (isSystemManaged) return
        try {
            const allowsCash = type === 'CASH'
            const allowsCard = ['CHECKING', 'CREDIT_CARD', 'DEBIT_CARD'].includes(type)
            const allowsTransfer = ['CHECKING'].includes(type)

            const payload = {
                name,
                account_type: type,
                currency,
                account: accountingAccount,
                allows_cash: allowsCash,
                allows_card: allowsCard,
                allows_transfer: allowsTransfer,
                bank: requiresBank(type) ? bank : null,
                account_number: requiresBank(type) ? accountNumber : null
            }

            if (accountId) {
                await updateAccount({ id: accountId, payload })
            } else {
                await createAccount(payload)
            }

            if (onSuccess) onSuccess()
            onOpenChange(false)
        } catch (error: unknown) {
            // Error handled by hook
        }
    }

    return (
        <BaseModal
            open={open}
            onOpenChange={onOpenChange}
            size={accountId ? "xl" : "lg"}
            title={
                <div className="flex items-center gap-3">
                    <Landmark className="h-5 w-5 text-muted-foreground" />
                    <span>{accountId ? "Ficha de Cuenta" : "Nueva Cuenta"}</span>
                    {isSystemManaged && (
                        <span className="flex items-center gap-1 text-xs font-normal px-2 py-0.5 rounded-full bg-muted text-muted-foreground border">
                            <Lock className="h-3 w-3" /> Gestionada por sistema
                        </span>
                    )}
                </div>
            }
            description={
                isSystemManaged
                    ? "Esta cuenta es gestionada automáticamente por el proveedor de terminal. No puede modificarse directamente."
                    : accountId
                        ? "Modifique los detalles de la cuenta y revise su historial."
                        : "Complete la información para registrar una nueva cuenta."
            }
            hideScrollArea={true}
            className="h-[85vh]"
            footer={
                <>
                    <CancelButton onClick={() => onOpenChange(false)}>
                        {isSystemManaged ? "Cerrar" : "Cancelar"}
                    </CancelButton>
                    {!isSystemManaged && (
                        <ActionSlideButton type="submit" form="account-form" loading={isSubmitting || loading} disabled={isSubmitting || loading}>
                            {accountId ? "Guardar Cambios" : "Crear Cuenta"}
                        </ActionSlideButton>
                    )}
                </>
            }
        >
            <div className="flex-1 flex overflow-hidden h-full">
                <div className="flex-1 flex flex-col overflow-y-auto p-6 pt-2">
                    {loading ? (
                        <div className="flex items-center justify-center p-12">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        <form id="account-form" onSubmit={handleSubmit} className="space-y-6">
                            {isSystemManaged && (
                                <div className="flex items-start gap-3 p-3 rounded-lg border border-muted bg-muted/30 text-sm text-muted-foreground">
                                    <Lock className="h-4 w-4 mt-0.5 shrink-0" />
                                    <p>Esta cuenta es creada y gestionada automáticamente cuando se configura un proveedor de terminal de cobro. Para modificarla, actualice la cuenta puente en el <strong>Proveedor de Terminal</strong> correspondiente.</p>
                                </div>
                            )}
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-4">
                                    <div className="grid gap-2">
                                        <LabeledInput
                                            label="Nombre de la Cuenta"
                                            value={name}
                                            onChange={e => setName(e.target.value)}
                                            placeholder="Ej: Caja Principal"
                                            required
                                            disabled={isSystemManaged}
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <LabeledSelect
                                            label="Tipo"
                                            value={type}
                                            onChange={(v: string) => setType(v)}
                                            disabled={isSystemManaged || !!accountId}
                                            options={[
                                                { value: "CHECKING", label: "Cuenta Corriente" },
                                                { value: "CREDIT_CARD", label: "Tarjeta de Crédito" },
                                                { value: "DEBIT_CARD", label: "Tarjeta de Débito" },
                                                { value: "CHECKBOOK", label: "Chequera" },
                                                { value: "CASH", label: "Efectivo" },
                                                { value: "BRIDGE", label: "Cuenta Puente (Clearing)" },
                                                { value: "MERCHANT", label: "Cuenta Recaudadora" }
                                            ]}
                                        />
                                        <LabeledSelect
                                            label="Moneda"
                                            value={currency}
                                            onChange={setCurrency}
                                            disabled={isSystemManaged}
                                            options={[
                                                { value: "CLP", label: "Pesos (CLP)" },
                                                { value: "USD", label: "Dólar (USD)" }
                                            ]}
                                        />
                                    </div>

                                    {requiresBank(type) && (
                                        <div className="animate-in slide-in-from-left-2 duration-300">
                                            <LabeledSelect
                                                label="Entidad Bancaria"
                                                placeholder="Seleccione banco..."
                                                value={bank?.toString() || ""}
                                                onChange={(v) => setBank(v ? Number(v) : null)}
                                                disabled={isSystemManaged}
                                                options={banks.map((b: any) => ({
                                                    value: b.id.toString(),
                                                    label: b.name
                                                }))}
                                                icon={<Landmark className="h-4 w-4" />}
                                            />
                                        </div>
                                    )}

                                    {requiresBank(type) && (
                                        <div className="animate-in slide-in-from-left-2 duration-300">
                                            <LabeledInput
                                                label="N° de Cuenta Bancaria"
                                                value={accountNumber}
                                                onChange={e => setAccountNumber(e.target.value)}
                                                placeholder="Ej: 0123456789"
                                                className="border-info/20 bg-info/5"
                                                disabled={isSystemManaged}
                                            />
                                        </div>
                                    )}

                                    <AccountSelector
                                        label="Cuenta Contable"
                                        value={accountingAccount?.toString() || null}
                                        onChange={(v) => setAccountingAccount(v ? Number(v) : null)}
                                        accountType="ASSET"
                                        isReconcilable={true}
                                        placeholder="Seleccione cuenta..."
                                        disabled={isSystemManaged}
                                        error={undefined}
                                    />
                                </div>
                            </div>
                        </form>
                    )}
                </div>

                {accountId && (
                    <ActivitySidebar
                        entityType="treasuryaccount"
                        entityId={accountId}
                        className="h-full border-none"
                        title="Historial de Cambios"
                    />
                )}
            </div>
        </BaseModal>
    )
}
