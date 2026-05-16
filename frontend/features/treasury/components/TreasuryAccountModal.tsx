"use client"

import React, { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { toast } from "sonner"
import { showApiError } from "@/lib/errors"

import { Loader2, Landmark, CreditCard, Lock } from "lucide-react"
import { AccountSelector } from "@/components/selectors/AccountSelector"
import { ActivitySidebar } from "@/features/audit/components/ActivitySidebar"
import { useTreasuryAccounts, treasuryApi } from "@/features/treasury"

import { CancelButton, LabeledInput, LabeledSelect, FormSection, FormFooter, FormSplitLayout, ActionSlideButton, BaseModal, Chip } from "@/components/shared"
import { Form, FormField } from "@/components/ui/form"

const treasuryAccountSchema = z.object({
    name: z.string().min(1, "El nombre es requerido"),
    account_type: z.string().min(1, "El tipo es requerido"),
    currency: z.string().min(1, "La moneda es requerida"),
    account: z.string().nullable().optional(), // Accounting account ID
    bank: z.string().nullable().optional(),
    account_number: z.string().optional(),
})

type TreasuryAccountFormValues = z.infer<typeof treasuryAccountSchema>

interface TreasuryAccountModalProps {
    open: boolean
    onOpenChange: (o: boolean) => void
    accountId?: number | null
    onSuccess?: () => void
}

const SYSTEM_MANAGED_TYPES = new Set(['BRIDGE', 'MERCHANT'])

export function TreasuryAccountModal({ open, onOpenChange, accountId, onSuccess }: TreasuryAccountModalProps) {
    const { createAccount, updateAccount, isCreating, isUpdating } = useTreasuryAccounts()
    const [loading, setLoading] = useState(false)
    const [banks, setBanks] = useState<any[]>([])

    const form = useForm<TreasuryAccountFormValues>({
        resolver: zodResolver(treasuryAccountSchema),
        defaultValues: {
            name: "",
            account_type: "CASH",
            currency: "CLP",
            account: null,
            bank: null,
            account_number: "",
        },
    })

    const type = form.watch("account_type")
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

                setBanks(banksData)
                if (accountData) {
                    form.reset({
                        name: accountData.name,
                        account_type: accountData.account_type,
                        currency: accountData.currency,
                        account: accountData.account ? accountData.account.toString() : null,
                        bank: accountData.bank ? accountData.bank.toString() : null,
                        account_number: accountData.account_number || "",
                    })
                } else {
                    form.reset({
                        name: "",
                        account_type: "CASH",
                        currency: "CLP",
                        account: null,
                        bank: null,
                        account_number: "",
                    })
                }
            } catch (err) {
                console.error("Error fetching account data", err)
            } finally {
                setLoading(false)
            }
        }
        fetchData()
    }, [open, accountId, form])

    const requiresBank = (accountType: string) => {
        return ['CHECKING', 'CREDIT_CARD', 'DEBIT_CARD'].includes(accountType)
    }

    const onSubmit = async (data: TreasuryAccountFormValues) => {
        if (isSystemManaged) return
        try {
            const allowsCash = data.account_type === 'CASH'
            const allowsCard = ['CHECKING', 'CREDIT_CARD', 'DEBIT_CARD'].includes(data.account_type)
            const allowsTransfer = ['CHECKING'].includes(data.account_type)

            const payload = {
                ...data,
                account: data.account ? parseInt(data.account) : null,
                bank: requiresBank(data.account_type) ? (data.bank ? parseInt(data.bank) : null) : null,
                account_number: requiresBank(data.account_type) ? data.account_number : null,
                allows_cash: allowsCash,
                allows_card: allowsCard,
                allows_transfer: allowsTransfer,
            }

            if (accountId) {
                await updateAccount({ id: accountId, payload })
                toast.success("Cuenta actualizada")
            } else {
                await createAccount(payload)
                toast.success("Cuenta creada")
            }

            if (onSuccess) onSuccess()
            onOpenChange(false)
        } catch (error: unknown) {
            showApiError(error, "Error al guardar cuenta")
        }
    }

    return (
        <BaseModal
            open={open}
            onOpenChange={onOpenChange}
            size={accountId ? "xl" : "md"}
            hideScrollArea={true}
            contentClassName="p-0"
            title={
                <div className="flex items-center gap-3">
                    <Landmark className="h-5 w-5 text-muted-foreground" />
                    <span>{accountId ? "Ficha de Cuenta" : "Nueva Cuenta"}</span>
                    {isSystemManaged && (
                        <Chip icon={Lock}>Gestionada por sistema</Chip>
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
            footer={
                <FormFooter
                    actions={
                        <>
                            <CancelButton onClick={() => onOpenChange(false)}>
                                {isSystemManaged ? "Cerrar" : "Cancelar"}
                            </CancelButton>
                            {!isSystemManaged && (
                                <ActionSlideButton
                                    loading={isSubmitting || loading}
                                    disabled={isSubmitting || loading}
                                    onClick={form.handleSubmit(onSubmit)}
                                >
                                    {accountId ? "Guardar Cambios" : "Crear Cuenta"}
                                </ActionSlideButton>
                            )}
                        </>
                    }
                />
            }
        >
            <FormSplitLayout
                showSidebar={!!accountId}
                sidebar={
                    accountId && (
                        <ActivitySidebar
                            entityType="treasuryaccount"
                            entityId={accountId}
                            title="Historial de Cambios"
                        />
                    )
                }
            >
                {loading ? (
                    <div className="flex items-center justify-center p-12">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                ) : (
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 px-4 pb-4 pt-2">
                            {isSystemManaged && (
                                <div className="flex items-start gap-3 p-3 rounded-lg border border-warning/20 bg-warning/5 text-xs text-warning">
                                    <Lock className="h-4 w-4 mt-0.5 shrink-0" />
                                    <p>Esta cuenta es gestionada automáticamente por el sistema. Para modificarla, actualice el Proveedor de Terminal correspondiente.</p>
                                </div>
                            )}

                            {/* Section 1: General Info */}
                            <div className="space-y-4">
                                <FormSection title="Datos Generales" icon={Landmark} />
                                <div className="grid grid-cols-4 gap-4">
                                    <div className="col-span-4">
                                        <FormField
                                            control={form.control}
                                            name="name"
                                            render={({ field, fieldState }) => (
                                                <LabeledInput
                                                    label="Nombre de la Cuenta"
                                                    placeholder="Ej: Caja Principal"
                                                    required
                                                    disabled={isSystemManaged}
                                                    error={fieldState.error?.message}
                                                    {...field}
                                                />
                                            )}
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <FormField
                                            control={form.control}
                                            name="account_type"
                                            render={({ field, fieldState }) => (
                                                <LabeledSelect
                                                    label="Tipo de Cuenta"
                                                    value={field.value}
                                                    onChange={field.onChange}
                                                    disabled={isSystemManaged || !!accountId}
                                                    error={fieldState.error?.message}
                                                    options={[
                                                        { value: "CASH", label: "Caja Física (Efectivo)" },
                                                        { value: "CHECKING", label: "Cuenta Bancaria (Corriente/Vista)" },
                                                        { value: "DEBIT_CARD", label: "Tarjeta de Débito (Cta. Propia)" },
                                                        { value: "CREDIT_CARD", label: "Tarjeta de Crédito (Cta. Propia)" },
                                                        { value: "CHECKBOOK", label: "Chequera / Instrumentos" },
                                                        { value: "BRIDGE", label: "Cuenta Puente" },
                                                        { value: "MERCHANT", label: "Cuenta Recaudadora (Pasarela/Wallet)" }
                                                    ]}
                                                />
                                            )}
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <FormField
                                            control={form.control}
                                            name="currency"
                                            render={({ field, fieldState }) => (
                                                <LabeledSelect
                                                    label="Moneda"
                                                    value={field.value}
                                                    onChange={field.onChange}
                                                    disabled={isSystemManaged}
                                                    error={fieldState.error?.message}
                                                    options={[
                                                        { value: "CLP", label: "Pesos (CLP)" },
                                                        { value: "USD", label: "Dólar (USD)" }
                                                    ]}
                                                />
                                            )}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Section 2: Bank Info (Conditional) */}
                            {requiresBank(type) && (
                                <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                    <FormSection title="Configuración Bancaria" icon={CreditCard} />
                                    <div className="grid grid-cols-4 gap-4">
                                        <div className="col-span-2">
                                            <FormField
                                                control={form.control}
                                                name="bank"
                                                render={({ field, fieldState }) => (
                                                    <LabeledSelect
                                                        label="Entidad Bancaria"
                                                        placeholder="Seleccione banco..."
                                                        value={field.value || ""}
                                                        onChange={field.onChange}
                                                        disabled={isSystemManaged}
                                                        error={fieldState.error?.message}
                                                        options={banks.map((b: any) => ({
                                                            value: b.id.toString(),
                                                            label: b.name
                                                        }))}
                                                    />
                                                )}
                                            />
                                        </div>
                                        <div className="col-span-2">
                                            <FormField
                                                control={form.control}
                                                name="account_number"
                                                render={({ field, fieldState }) => (
                                                    <LabeledInput
                                                        label="N° de Cuenta Bancaria"
                                                        placeholder="Ej: 0123456789"
                                                        disabled={isSystemManaged}
                                                        error={fieldState.error?.message}
                                                        {...field}
                                                    />
                                                )}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Section 3: Accounting */}
                            <div className="space-y-4">
                                <FormSection title="Integración Contable" icon={Lock} />
                                <div className="grid grid-cols-4 gap-4">
                                    <div className="col-span-4">
                                        <FormField
                                            control={form.control}
                                            name="account"
                                            render={({ field, fieldState }) => (
                                                <AccountSelector
                                                    label="Cuenta del Plan de Cuentas"
                                                    value={field.value}
                                                    onChange={field.onChange}
                                                    accountType="ASSET"
                                                    isReconcilable={true}
                                                    placeholder="Seleccione cuenta..."
                                                    disabled={isSystemManaged}
                                                    error={fieldState.error?.message}
                                                />
                                            )}
                                        />
                                    </div>
                                </div>
                            </div>
                        </form>
                    </Form>
                )}
            </FormSplitLayout>
        </BaseModal>
    )
}
