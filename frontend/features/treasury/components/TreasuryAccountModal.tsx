"use client"

import React, { useState, useEffect } from "react"
import { useTreasuryAccounts, type TreasuryAccount, treasuryApi } from "@/features/treasury"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { BaseModal } from "@/components/shared/BaseModal"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Loader2, Landmark, CreditCard } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { AccountSelector } from "@/components/selectors/AccountSelector"
import { UserSelector } from "@/components/selectors/UserSelector"
import { ActivitySidebar } from "@/features/audit/components/ActivitySidebar"
import { FORM_STYLES } from "@/lib/styles"
import { cn } from "@/lib/utils"

interface TreasuryAccountModalProps {
    open: boolean
    onOpenChange: (o: boolean) => void
    accountId?: number | null
    onSuccess?: () => void
}

export function TreasuryAccountModal({ open, onOpenChange, accountId, onSuccess }: TreasuryAccountModalProps) {
    const { createAccount, updateAccount, isCreating, isUpdating } = useTreasuryAccounts()
    const [account, setAccount] = useState<TreasuryAccount | null>(null)
    const [loading, setLoading] = useState(false)
    
    const [name, setName] = useState("")
    const [type, setType] = useState<'CHECKING' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'CHECKBOOK' | 'CASH'>("CASH")
    const [currency, setCurrency] = useState("CLP")
    const [accountingAccount, setAccountingAccount] = useState<number | null>(null)
    const [location, setLocation] = useState("")
    const [custodian, setCustodian] = useState<number | null>(null)
    const [isPhysical, setIsPhysical] = useState(false)
    const [bank, setBank] = useState<number | null>(null)
    const [accountNumber, setAccountNumber] = useState("")
    const [banks, setBanks] = useState<any[]>([])

    const isSubmitting = isCreating || isUpdating

    useEffect(() => {
        const fetchData = async () => {
            if (!open) return
            
            try {
                setLoading(true)
                const [banksData, accountData] = await Promise.all([
                    treasuryApi.getBanks(),
                    accountId ? treasuryApi.getAccount(accountId) : Promise.resolve(null)
                ])
                
                setBanks(banksData)
                
                if (accountData) {
                    setAccount(accountData)
                    setName(accountData.name)
                    setType(accountData.account_type)
                    setCurrency(accountData.currency)
                    setAccountingAccount(accountData.account ? Number(accountData.account) : null)
                    setLocation(accountData.location || "")
                    setCustodian(accountData.custodian || null)
                    setIsPhysical(accountData.is_physical || false)
                    setBank(accountData.bank ? Number(accountData.bank) : null)
                    setAccountNumber(accountData.account_number || "")
                } else {
                    setAccount(null)
                    setName("")
                    setType("CASH")
                    setCurrency("CLP")
                    setAccountingAccount(null)
                    setLocation("")
                    setCustodian(null)
                    setIsPhysical(false)
                    setBank(null)
                    setAccountNumber("")
                }
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
                location,
                custodian,
                is_physical: isPhysical,
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
        } catch (error: any) {
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
                    <div className="p-2 bg-primary/10 rounded-lg">
                        <Landmark className="h-5 w-5 text-primary" />
                    </div>
                    <span>{accountId ? "Ficha de Cuenta" : "Nueva Cuenta"}</span>
                </div>
            }
            description={accountId ? "Modifique los detalles de la cuenta y revise su historial." : "Complete la información para registrar una nueva cuenta."}
            hideScrollArea={true}
            className="h-[85vh]"
            footer={
                <>
                    <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
                    <Button type="submit" form="account-form" disabled={isSubmitting || loading}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {accountId ? "Guardar Cambios" : "Crear Cuenta"}
                    </Button>
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
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-4">
                                    <div className="grid gap-2">
                                        <Label className={FORM_STYLES.label}>Nombre de la Cuenta</Label>
                                        <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Caja Principal" className={FORM_STYLES.input} required />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="grid gap-2">
                                            <Label className={FORM_STYLES.label}>Tipo</Label>
                                            <Select value={type} onValueChange={(v: any) => setType(v)}>
                                                <SelectTrigger className={FORM_STYLES.input}>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="CHECKING">Cuenta Corriente</SelectItem>
                                                    <SelectItem value="CREDIT_CARD">Tarjeta de Crédito</SelectItem>
                                                    <SelectItem value="DEBIT_CARD">Tarjeta de Débito</SelectItem>
                                                    <SelectItem value="CHECKBOOK">Chequera</SelectItem>
                                                    <SelectItem value="CASH">Efectivo</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="grid gap-2">
                                            <Label className={FORM_STYLES.label}>Moneda</Label>
                                            <Select value={currency} onValueChange={setCurrency}>
                                                <SelectTrigger className={FORM_STYLES.input}>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="CLP">Pesos (CLP)</SelectItem>
                                                    <SelectItem value="USD">Dólar (USD)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    {requiresBank(type) && (
                                        <div className="grid gap-2 animate-in slide-in-from-left-2 duration-300">
                                            <Label className={cn(FORM_STYLES.label, "text-info flex items-center gap-1")}>
                                                <Landmark className="h-3.5 w-3.5" /> Entidad Bancaria
                                            </Label>
                                            <Select value={bank?.toString() || ""} onValueChange={(v) => setBank(v ? Number(v) : null)}>
                                                <SelectTrigger className={cn(FORM_STYLES.input, "border-info/20 bg-info/5")}>
                                                    <SelectValue placeholder="Seleccione banco..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {banks.map((b: any) => (
                                                        <SelectItem key={b.id} value={b.id.toString()}>{b.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    )}

                                    {requiresBank(type) && (
                                        <div className="grid gap-2 animate-in slide-in-from-left-2 duration-300">
                                            <Label className={cn(FORM_STYLES.label, "text-info flex items-center gap-1")}>
                                                <CreditCard className="h-3.5 w-3.5" /> N° de Cuenta Bancaria
                                            </Label>
                                            <Input
                                                value={accountNumber}
                                                onChange={e => setAccountNumber(e.target.value)}
                                                placeholder="Ej: 0123456789"
                                                className={cn(FORM_STYLES.input, "border-info/20 bg-info/5")}
                                            />
                                        </div>
                                    )}

                                    <div className="grid gap-2">
                                        <Label className={FORM_STYLES.label}>Cuenta Contable</Label>
                                        <AccountSelector
                                            value={accountingAccount?.toString() || null}
                                            onChange={(v) => setAccountingAccount(v ? Number(v) : null)}
                                            accountType="ASSET"
                                            isReconcilable={true}
                                            placeholder="Seleccione cuenta..."
                                        />
                                        <p className="text-[10px] text-muted-foreground italic">
                                            Vínculo con el plan de cuentas.
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="p-4 border rounded-xl bg-warning/5 space-y-3 border-warning/10">
                                        <div className="flex items-center space-x-2">
                                            <Checkbox id="is-physical-p" checked={isPhysical} onCheckedChange={(v) => setIsPhysical(!!v)} />
                                            <Label htmlFor="is-physical-p" className="font-semibold cursor-pointer">¿Es un lugar físico?</Label>
                                        </div>
                                        {isPhysical && (
                                            <div className="space-y-3 pt-2 border-t border-warning/10 animate-in fade-in duration-300">
                                                <div className="grid gap-1.5">
                                                    <Label className={cn(FORM_STYLES.label, "text-[11px] uppercase tracking-wider text-warning")}>Ubicación</Label>
                                                    <Input value={location} onChange={e => setLocation(e.target.value)} placeholder="Ej: Oficina Central" className={cn(FORM_STYLES.input, "h-8 text-xs bg-white")} />
                                                </div>
                                                <div className="grid gap-1.5">
                                                    <Label className={cn(FORM_STYLES.label, "text-[11px] uppercase tracking-wider text-warning")}>Custodio</Label>
                                                    <UserSelector value={custodian} onChange={setCustodian} />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </form>
                    )}
                </div>

                {accountId && (
                    <div className="w-[350px] flex flex-col bg-muted/10 border-l overflow-hidden hidden lg:flex">
                        <ActivitySidebar
                            entityType="treasuryaccount"
                            entityId={accountId}
                            className="h-full border-none"
                            title="Historial de Cambios"
                        />
                    </div>
                )}
            </div>
        </BaseModal>
    )
}
