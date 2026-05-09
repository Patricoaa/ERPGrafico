"use client"

import React, { useState, useEffect } from "react"
import { notFound, useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { toast } from "sonner"
import { showApiError } from "@/lib/errors"
import { Loader2, Landmark, CreditCard, Lock } from "lucide-react"

import { AccountSelector } from "@/components/selectors/AccountSelector"
import { useTreasuryAccounts, treasuryApi } from "@/features/treasury"
import {
    CancelButton,
    LabeledInput,
    LabeledSelect,
    FormSection,
    FormFooter,
    FormSkeleton,
    ActionSlideButton,
    EntityDetailPage,
} from "@/components/shared"
import { Form, FormField } from "@/components/ui/form"

const schema = z.object({
    name: z.string().min(1, "El nombre es requerido"),
    account_type: z.string().min(1, "El tipo es requerido"),
    currency: z.string().min(1, "La moneda es requerida"),
    account: z.string().nullable().optional(),
    bank: z.string().nullable().optional(),
    account_number: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

const SYSTEM_MANAGED_TYPES = new Set(["BRIDGE", "MERCHANT"])

const requiresBank = (t: string) => ["CHECKING", "CREDIT_CARD", "DEBIT_CARD"].includes(t)

interface TreasuryAccountDetailClientProps {
    accountId: string
}

export function TreasuryAccountDetailClient({ accountId }: TreasuryAccountDetailClientProps) {
    const router = useRouter()
    const { updateAccount, isUpdating } = useTreasuryAccounts()
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<number | null>(null)
    const [banks, setBanks] = useState<any[]>([])

    const form = useForm<FormValues>({
        resolver: zodResolver(schema),
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
    const isSystemManaged = SYSTEM_MANAGED_TYPES.has(type)
    const isSaving = isUpdating

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true)
                const [banksData, accountData] = await Promise.all([
                    treasuryApi.getBanks(),
                    treasuryApi.getAccount(parseInt(accountId)),
                ])
                setBanks(banksData)
                form.reset({
                    name: accountData.name,
                    account_type: accountData.account_type,
                    currency: accountData.currency,
                    account: accountData.account ? accountData.account.toString() : null,
                    bank: accountData.bank ? accountData.bank.toString() : null,
                    account_number: accountData.account_number || "",
                })
            } catch (err: any) {
                setError(err.response?.status || 500)
            } finally {
                setLoading(false)
            }
        }
        fetchData()
    }, [accountId, form])

    const onSubmit = async (data: FormValues) => {
        if (isSystemManaged) return
        try {
            const allowsCash = data.account_type === "CASH"
            const allowsCard = ["CHECKING", "CREDIT_CARD", "DEBIT_CARD"].includes(data.account_type)
            const allowsTransfer = data.account_type === "CHECKING"
            const payload = {
                ...data,
                account: data.account ? parseInt(data.account) : null,
                bank: requiresBank(data.account_type) ? (data.bank ? parseInt(data.bank) : null) : null,
                account_number: requiresBank(data.account_type) ? data.account_number : null,
                allows_cash: allowsCash,
                allows_card: allowsCard,
                allows_transfer: allowsTransfer,
            }
            await updateAccount({ id: parseInt(accountId), payload })
            toast.success("Cuenta actualizada")
            router.refresh()
        } catch (err: unknown) {
            showApiError(err, "Error al guardar cuenta")
        }
    }

    if (error === 404) return notFound()
    if (error) return (
        <div className="flex-1 flex items-center justify-center p-8 text-destructive text-sm">
            Error al cargar la cuenta
        </div>
    )

    if (loading) {
        return (
            <div className="flex-1 p-8">
                <FormSkeleton />
            </div>
        )
    }

    const accountName = form.getValues("name")

    return (
        <EntityDetailPage
            entityType="treasuryaccount"
            title="Cuenta de Tesorería"
            displayId={accountName}
            icon="landmark"
            breadcrumb={[
                { label: "Cuentas", href: "/treasury/accounts" },
                { label: accountName || `#${accountId}`, href: `/treasury/accounts/${accountId}` },
            ]}
            instanceId={parseInt(accountId)}
            readonly={isSystemManaged}
            footer={
                !isSystemManaged ? (
                    <FormFooter
                        actions={
                            <>
                                <CancelButton onClick={() => router.push("/treasury/accounts")} disabled={isSaving} />
                                <ActionSlideButton
                                    loading={isSaving}
                                    disabled={isSaving}
                                    onClick={form.handleSubmit(onSubmit)}
                                >
                                    Guardar Cambios
                                </ActionSlideButton>
                            </>
                        }
                    />
                ) : (
                    <FormFooter
                        actions={<CancelButton onClick={() => router.push("/treasury/accounts")}>Volver</CancelButton>}
                    />
                )
            }
        >
            <div className="max-w-5xl mx-auto w-full">
                {isSystemManaged && (
                    <div className="flex items-start gap-3 p-3 rounded-lg border border-amber-500/20 bg-amber-500/5 text-xs text-amber-600 mb-4">
                        <Lock className="h-4 w-4 mt-0.5 shrink-0" />
                        <p>Esta cuenta es gestionada automáticamente por el sistema. Para modificarla, actualice el Proveedor de Terminal correspondiente.</p>
                    </div>
                )}

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6" id="treasury-account-form">
                        {/* Section 1: General */}
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
                                                disabled={isSystemManaged || true /* type locked on edit */}
                                                error={fieldState.error?.message}
                                                options={[
                                                    { value: "CASH", label: "Caja Física (Efectivo)" },
                                                    { value: "CHECKING", label: "Cuenta Bancaria (Corriente/Vista)" },
                                                    { value: "DEBIT_CARD", label: "Tarjeta de Débito (Cta. Propia)" },
                                                    { value: "CREDIT_CARD", label: "Tarjeta de Crédito (Cta. Propia)" },
                                                    { value: "CHECKBOOK", label: "Chequera / Instrumentos" },
                                                    { value: "BRIDGE", label: "Cuenta Puente" },
                                                    { value: "MERCHANT", label: "Cuenta Recaudadora (Pasarela/Wallet)" },
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
                                                    { value: "USD", label: "Dólar (USD)" },
                                                ]}
                                            />
                                        )}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Section 2: Bank Info (conditional) */}
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
                                                        label: b.name,
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

                        {/* Section 3: Accounting link */}
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
            </div>
        </EntityDetailPage>
    )
}
