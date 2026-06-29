"use client"

import React, { useState, useEffect, useRef } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { showApiError } from "@/lib/errors"

import { Landmark, CreditCard, Lock, Printer, ScrollText, Plus, Pencil, Archive } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useReactToPrint } from "react-to-print"
import { PrintableLayout } from "@/features/_shared/transaction-drawer"
import type { DrawerMode } from "@/features/_shared/drawer/types"
import { AccountSelector } from "@/components/selectors/AccountSelector"
import { ActivitySidebar } from "@/features/audit/components"
import { useTreasuryAccounts, treasuryApi, useCreditLineMutations, CreditLineDrawer } from "@/features/treasury"
import type { Bank, TreasuryAccount, TreasuryAccountCreatePayload, TreasuryAccountUpdatePayload } from "../types"
import type { CreditLine } from "../credit-lines/types"

import { CancelButton, LabeledInput, LabeledSelect, FormSection, FormFooter, FormSplitLayout, ActionSlideButton, Drawer, Chip, SkeletonShell, StatusBadge, MoneyDisplay } from "@/components/shared"
import { formDrawerWidth } from "@/lib/form-widths"
import { Form, FormField } from "@/components/ui/form"

const treasuryAccountSchema = z.object({
    name: z.string().min(1, "El nombre es requerido"),
    account_type: z.string().min(1, "El tipo es requerido"),
    currency: z.string().min(1, "La moneda es requerida"),
    account: z.string().nullable().optional(), // Accounting account ID
    bank: z.string().nullable().optional(),
    account_number: z.string().optional(),
    card_number: z.string().optional(),
    credit_limit: z.string().optional(),
})

type TreasuryAccountFormValues = z.infer<typeof treasuryAccountSchema>

interface TreasuryAccountDrawerProps {
    open: boolean
    onOpenChange: (o: boolean) => void
    accountId?: number | null
    onSuccess?: () => void
    mode?: DrawerMode
}

const SYSTEM_MANAGED_TYPES = new Set(['BRIDGE'])

export function TreasuryAccountDrawer({ open, onOpenChange, accountId, onSuccess, mode: modeProp }: TreasuryAccountDrawerProps) {
    const { createAccount, updateAccount, isCreating, isUpdating } = useTreasuryAccounts()
    const [loading, setLoading] = useState(false)
    const [banks, setBanks] = useState<Bank[]>([])
    const [entityData, setEntityData] = useState<TreasuryAccount | null>(null)
    const [creditLineData, setCreditLineData] = useState<CreditLine | null>(null)
    const [creditLineDrawerOpen, setCreditLineDrawerOpen] = useState(false)
    const { remove: deleteCreditLine } = useCreditLineMutations()

    const form = useForm<TreasuryAccountFormValues>({
        resolver: zodResolver(treasuryAccountSchema),
        defaultValues: {
            name: "",
            account_type: "CASH",
            currency: "CLP",
            account: null,
            bank: null,
            account_number: "",
            card_number: "",
            credit_limit: "",
        },
    })

    const type = form.watch("account_type")
    const isSubmitting = isCreating || isUpdating
    const isSystemManaged = SYSTEM_MANAGED_TYPES.has(type)
    const mode: DrawerMode = modeProp ?? (accountId ? 'edit' : 'create')
    const isView = mode === 'view' || isSystemManaged
    const printRef = useRef<HTMLDivElement>(null)
    const handlePrint = useReactToPrint({ contentRef: printRef })

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
                setEntityData(accountData)

                // Load credit line if CHECKING account
                if (accountData?.account_type === 'CHECKING') {
                    try {
                        const response = await import('@/lib/api').then(m =>
                            m.default.get<CreditLine[]>('/treasury/credit-lines/', { params: { treasury_account_id: accountData.id } })
                        )
                        setCreditLineData(response.data[0] || null)
                    } catch {
                        setCreditLineData(null)
                    }
                } else {
                    setCreditLineData(null)
                }
                if (accountData) {
                    form.reset({
                        name: accountData.name,
                        account_type: accountData.account_type,
                        currency: accountData.currency,
                        account: accountData.account ? accountData.account.toString() : null,
                        bank: accountData.bank ? accountData.bank.toString() : null,
                        account_number: accountData.account_number || "",
                        card_number: accountData.card_number || "",
                        credit_limit: accountData.credit_limit?.toString() ?? "",
                    })
                } else {
                    form.reset({
                        name: "",
                        account_type: "CASH",
                        currency: "CLP",
                        account: null,
                        bank: null,
                        account_number: "",
                        card_number: "",
                        credit_limit: "",
                    })
                }
            } catch (err) {
                showApiError(err, "Error al cargar datos de la cuenta")
            } finally {
                setLoading(false)
            }
        }
        fetchData()
    }, [open, accountId, form])

    const requiresBank = (accountType: string) => {
        return ['CHECKING', 'CREDIT_CARD', 'LOAN'].includes(accountType)
    }
    const isLiabilityType = (accountType: string) => ['CREDIT_CARD', 'LOAN'].includes(accountType)

    const onSubmit = async (data: TreasuryAccountFormValues) => {
        if (isSystemManaged) return
        try {
            const allowsCash = data.account_type === 'CASH'
            const allowsCard = ['CHECKING', 'CREDIT_CARD'].includes(data.account_type)
            const allowsTransfer = ['CHECKING'].includes(data.account_type)
            const allowsCheck = ['CHECKING'].includes(data.account_type)

            const payload = {
                ...data,
                account: data.account ? parseInt(data.account) : null,
                bank: requiresBank(data.account_type) ? (data.bank ? parseInt(data.bank) : null) : null,
                account_number: requiresBank(data.account_type) ? data.account_number : null,
                card_number: data.account_type === 'CREDIT_CARD' ? data.card_number : null,
                credit_limit: data.credit_limit ? Number(data.credit_limit) : null,
                allows_cash: allowsCash,
                allows_card: allowsCard,
                allows_transfer: allowsTransfer,
                allows_check: allowsCheck,
            }

            if (accountId) {
                await updateAccount({ id: accountId, payload: payload as unknown as TreasuryAccountUpdatePayload })
            } else {
                await createAccount(payload as unknown as TreasuryAccountCreatePayload)
            }

            if (onSuccess) onSuccess()
            onOpenChange(false)
        } catch (error: unknown) {
            showApiError(error, "Error al guardar cuenta")
        }
    }

    const drawerTitle = isView
        ? `Ficha de Cuenta${accountId ? ` #${accountId}` : ""}`
        : mode === 'create'
            ? "Nueva Cuenta"
            : "Editar Cuenta"

    return (
        <>
            {(mode === 'view' || mode === 'edit') && accountId && entityData && (
                <PrintableLayout ref={printRef} title="Cuenta" displayId={`#${accountId}`}>
                    <div className="text-[9px] space-y-1 mb-2">
                        <div className="flex justify-between">
                            <span>Nombre:</span>
                            <span>{entityData?.name ?? '-'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Tipo:</span>
                            <span>{entityData?.account_type ?? '-'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Moneda:</span>
                            <span>{entityData?.currency ?? '-'}</span>
                        </div>
                    </div>
                </PrintableLayout>
            )}
            <Drawer
                open={open}
                onOpenChange={onOpenChange}
                side="left"
                defaultSize={formDrawerWidth("medium", !!accountId)}
                mode={mode}
                title={
                    <div className="flex items-center gap-3">
                        <Landmark className="h-5 w-5 text-muted-foreground" />
                        <span>{drawerTitle}</span>
                        {isSystemManaged && (
                            <Chip icon={Lock}>Gestionada por sistema</Chip>
                        )}
                    </div>
                }
                headerActions={(mode === 'view' || mode === 'edit') && accountId && (
                    <Button variant="ghost" size="icon" onClick={() => handlePrint()}>
                        <Printer className="h-4 w-4" />
                    </Button>
                )}
                subtitle={
                    isSystemManaged
                        ? "Esta cuenta es gestionada automáticamente por el proveedor de terminal. No puede modificarse directamente."
                        : accountId
                            ? "Modifique los detalles de la cuenta y revise su historial."
                            : "Complete la información para registrar una nueva cuenta."
                }
                footer={isView ? undefined : (
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
                )}
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
                    <SkeletonShell isLoading={open && loading} ariaLabel="Cargando formulario de cuenta de tesorería">
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 px-6 pb-6 pt-6">
                                <fieldset disabled={isView} className="contents">
                                    {isSystemManaged && (
                                        <div className="flex items-start gap-3 p-3 rounded-md border border-warning/20 bg-warning/5 text-xs text-warning">
                                            <Lock className="h-4 w-4 mt-0.5 shrink-0" />
                                            <p>Esta cuenta es gestionada automáticamente por el sistema. Para modificarla, actualice el Proveedor de Terminal correspondiente.</p>
                                        </div>
                                    )}

                                    {/* Section 1: General Info */}
                                    <div className="space-y-4">
                                        <FormSection title="Datos Generales" icon={Landmark} />
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
                                        <FormField
                                            control={form.control}
                                            name="account_type"
                                            render={({ field, fieldState }) => (
                                                <LabeledSelect
                                                    label="Tipo de Cuenta"
                                                    required
                                                    value={field.value}
                                                    onChange={field.onChange}
                                                    disabled={isSystemManaged || !!accountId}
                                                    error={fieldState.error?.message}
                                                    options={[
                                                        { value: "CASH", label: "Caja Física (Efectivo)" },
                                                        { value: "CHECKING", label: "Cuenta Bancaria (Corriente/Vista)" },
                                                        { value: "CREDIT_CARD", label: "Tarjeta de Crédito (Cta. Propia)" },
                                                        { value: "LOAN", label: "Préstamo Bancario (Pasivo)" },
                                                        { value: "BRIDGE", label: "Cuenta Puente" }
                                                    ]}
                                                />
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="currency"
                                            render={({ field, fieldState }) => (
                                                <LabeledSelect
                                                    label="Moneda"
                                                    required
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

                                    {/* Credit limit (solo CREDIT_CARD) */}
                                    {type === "CREDIT_CARD" && (
                                        <div className="space-y-4">
                                            <FormSection title="Datos de la Tarjeta" icon={CreditCard} />
                                            <FormField
                                                control={form.control}
                                                name="card_number"
                                                render={({ field, fieldState }) => (
                                                    <LabeledInput
                                                        label="Número de Tarjeta"
                                                        placeholder="1234 5678 9012 3456"
                                                        disabled={isSystemManaged}
                                                        error={fieldState.error?.message}
                                                        {...field}
                                                    />
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="credit_limit"
                                                render={({ field }) => (
                                                    <LabeledInput
                                                        label="Cupo Total"
                                                        placeholder="5000000"
                                                        type="number"
                                                        disabled={isSystemManaged}
                                                        {...field}
                                                    />
                                                )}
                                            />
                                        </div>
                                    )}

                                    {/* Section 2: Bank Info (Conditional) */}
                                    {requiresBank(type) && (
                                        <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                            <FormSection title="Configuración Bancaria" icon={CreditCard} />
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
                                                        options={banks.map((b: Bank) => ({
                                                            value: b.id.toString(),
                                                            label: b.name
                                                        }))}
                                                    />
                                                )}
                                            />
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
                                    )}

                                    {/* Credit Line Section (solo CHECKING) */}
                                    {type === "CHECKING" && (
                                        <div className="space-y-4">
                                            <FormSection title="Línea de Crédito (Sobregiro)" icon={ScrollText} />
                                            {creditLineData ? (
                                                <div className="rounded-lg border p-4 space-y-3">
                                                    <div className="grid grid-cols-2 gap-3 text-sm">
                                                        <div>
                                                            <span className="text-muted-foreground">Límite</span>
                                                            <p className="font-medium"><MoneyDisplay amount={parseFloat(creditLineData.credit_limit)} /></p>
                                                        </div>
                                                        <div>
                                                            <span className="text-muted-foreground">Utilizado</span>
                                                            <p className="font-medium"><MoneyDisplay amount={parseFloat(creditLineData.used_amount)} /></p>
                                                        </div>
                                                        <div>
                                                            <span className="text-muted-foreground">Disponible</span>
                                                            <p className="font-medium text-success"><MoneyDisplay amount={parseFloat(creditLineData.available_amount)} /></p>
                                                        </div>
                                                        <div>
                                                            <span className="text-muted-foreground">Estado</span>
                                                            <StatusBadge status={creditLineData.status} />
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-2 pt-2 border-t">
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => setCreditLineDrawerOpen(true)}
                                                        >
                                                            <Pencil className="h-3.5 w-3.5 mr-1" />
                                                            Editar
                                                        </Button>
                                                        {creditLineData.status === 'ACTIVE' && (
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={async () => {
                                                                    if (confirm('¿Archivar esta línea de crédito?')) {
                                                                        await deleteCreditLine.mutateAsync(creditLineData.id)
                                                                        setCreditLineData(null)
                                                                    }
                                                                }}
                                                            >
                                                                <Archive className="h-3.5 w-3.5 mr-1" />
                                                                Archivar
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                                                    <p className="mb-2">No tiene línea de crédito asociada</p>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => setCreditLineDrawerOpen(true)}
                                                    >
                                                        <Plus className="h-3.5 w-3.5 mr-1" />
                                                        Agregar Línea de Crédito
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Section 3: Accounting */}
                                    <div className="space-y-4">
                                        <FormSection title="Integración Contable" icon={Lock} />
                                        <FormField
                                            control={form.control}
                                            name="account"
                                            render={({ field, fieldState }) => (
                                                <AccountSelector
                                                    label={type === 'CREDIT_CARD' ? "Cuenta de Pasivo (Tarjeta por pagar)"
                                                        : type === 'LOAN' ? "Cuenta de Pasivo (Préstamo por pagar)"
                                                            : "Cuenta del Plan de Cuentas"}
                                                    value={field.value}
                                                    onChange={field.onChange}
                                                    accountType={isLiabilityType(type) ? "LIABILITY" : "ASSET"}
                                                    isReconcilable={isLiabilityType(type) ? undefined : true}
                                                    placeholder="Seleccione cuenta..."
                                                    disabled={isSystemManaged}
                                                    error={fieldState.error?.message}
                                                />
                                            )}
                                        />
                                    </div>
                                </fieldset>
                            </form>
                        </Form>
                    </SkeletonShell>
                </FormSplitLayout>
            </Drawer>

            <CreditLineDrawer
                open={creditLineDrawerOpen}
                onOpenChange={(o) => {
                    setCreditLineDrawerOpen(o)
                    if (!o) {
                        // Reload credit line data when drawer closes
                        if (accountId && entityData?.account_type === 'CHECKING') {
                            import('@/lib/api').then(m =>
                                m.default.get<CreditLine[]>('/treasury/credit-lines/', { params: { treasury_account_id: accountId } })
                            ).then(({ data }) => setCreditLineData(data[0] || null))
                                .catch(() => setCreditLineData(null))
                        }
                    }
                }}
                treasuryAccountId={type === 'CHECKING' ? accountId ?? undefined : undefined}
                creditLineId={creditLineData?.id ?? null}
            />
        </>
    )
}
