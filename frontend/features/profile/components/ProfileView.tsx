"use client"
import { formatPlainDate } from "@/lib/utils";

import { useState, useMemo } from "react"

import { toast } from "sonner"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { changePassword, changePin, downloadPayrollPdf, downloadMultiplePayrollPdfs } from '@/features/profile/api/profileApi'
import type { MyProfile } from "@/types/profile"
import type { Payroll } from "@/types/hr"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { SubmitButton, FadeIn, MoneyDisplay, type BulkAction } from "@/components/shared"
import { Form, FormField } from "@/components/ui/form"
import { cn } from "@/lib/utils"
import {
    User, KeyRound, Wallet,
    Download,
    Check, Sun, Moon, Monitor
} from "lucide-react"
import { EmptyState, LabeledInput, StatusBadge } from "@/components/shared"
import { EmployeePayrollModal } from "./EmployeePayrollModal"
import { PartnerProfileTab } from "./PartnerProfileTab"
import { profilePayrollActions, type ProfilePayrollActionsCtx } from './profilePayrollActions'
import { PayrollPaymentsModal } from './PayrollPaymentsModal'

import { Collection, useEntityCollection } from "@/components/entity-view"
import { payrollEntity, payrollViews } from "../entity-view/payroll.entity"
import { unifiedPaymentEntity, unifiedPaymentViews, type UnifiedPayment } from "../entity-view/unifiedPayment.entity"

import { useTheme } from "next-themes"
import { useThemeSync } from "../hooks/useThemeSync"
import { passwordSchema, pinSchema } from "../schema"
import type { PasswordFormValues, PinFormValues } from "../schema"

interface ProfileViewProps {
    activeSection: string
    initialProfile?: MyProfile
    onSectionChange?: (section: string) => void
}

export function ProfileView({ activeSection, initialProfile, onSectionChange }: ProfileViewProps) {
    const profile = initialProfile
    const contactDetail = profile?.contact_detail || profile?.employee?.contact_detail
    const isPartner = contactDetail?.is_partner

    if (!profile) return null

    return (
        <Tabs value={activeSection} onValueChange={onSectionChange} className="w-full min-w-0 flex-1 min-h-0 flex flex-col">
            <div className="pt-0 flex-1 min-h-0 flex flex-col">
                <TabsContent value="preferences" className="mt-0 outline-none flex-1 min-h-0 flex flex-col">
                    <AccountTab activeSubTab="preferences" />
                </TabsContent>

                <TabsContent value="security" className="mt-0 outline-none flex-1 min-h-0 flex flex-col">
                    <AccountTab activeSubTab="security" />
                </TabsContent>

                <TabsContent value="employee" className="mt-0 outline-none flex-1 min-h-0 flex flex-col">
                    <PersonalTab profile={profile} activeSubTab="employee" />
                </TabsContent>

                <TabsContent value="payrolls" className="mt-0 outline-none flex-1 min-h-0 flex flex-col">
                    <PersonalTab profile={profile} activeSubTab="payrolls" />
                </TabsContent>

                {isPartner && contactDetail && (
                    <TabsContent value="partner" className="mt-0 outline-none flex-1 min-h-0 flex flex-col">
                        <PartnerProfileTab contactId={contactDetail.id} />
                    </TabsContent>
                )}
            </div>
        </Tabs>
    )
}

// ============================================
// TAB 1: ACCOUNT
// ============================================
function AccountTab({ activeSubTab }: { activeSubTab?: string }) {

    return (
        <div className="w-full flex-1 min-h-0 overflow-y-auto custom-scrollbar space-y-8 pb-6">
            {activeSubTab === "preferences" && (
                <FadeIn delay={0.1} yOffset={10}>
                    <ThemeSelectionSection />
                </FadeIn>
            )}

            {activeSubTab === "security" && (
                <>
                    <FadeIn delay={0.1} yOffset={10}>
                        <PasswordChangeSection />
                    </FadeIn>

                    <FadeIn delay={0.2} yOffset={10}>
                        <PinChangeSection />
                    </FadeIn>
                </>
            )}
        </div>
    )
}

function ThemeSelectionSection() {
    const { theme } = useTheme()
    const { changeTheme, isSyncing } = useThemeSync()
    const options = [
        { value: "light", label: "Modo claro", description: "Colores limpios para entornos bien iluminados", icon: Sun },
        { value: "dark", label: "Modo oscuro", description: "Una superficie oscura para reducir el brillo", icon: Moon },
        { value: "system", label: "Preferencia del sistema", description: "Usar automáticamente el tema de su dispositivo", icon: Monitor },
    ] as const

    const handleThemeKeyDown = (e: React.KeyboardEvent, next: "light" | "dark" | "system") => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            changeTheme(next)
        }
    }

    return (
        <section className="w-full max-w-none">
            <header className="flex items-start justify-between gap-4 border-b border-border/70 pb-4">
                <div className="space-y-1">
                    <h2 className="text-base font-semibold text-foreground">Tema y apariencia</h2>
                    <p className="text-sm text-muted-foreground">Personalice su entorno de trabajo visual.</p>
                </div>
                {isSyncing && <span role="status" className="shrink-0 text-xs text-muted-foreground">Guardando…</span>}
            </header>
            <div className="divide-y divide-border/70">
                {options.map(({ value, label, description, icon: Icon }) => {
                    const selected = theme === value
                    return (
                        <div
                            key={value}
                            role="button"
                            tabIndex={0}
                            aria-pressed={selected}
                            onClick={() => changeTheme(value)}
                            onKeyDown={(event) => handleThemeKeyDown(event, value)}
                            className="flex min-h-16 cursor-pointer items-center gap-3 px-1 py-3 text-left transition-colors hover:bg-foreground/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                        >
                            <Icon className={cn("h-4 w-4 shrink-0", selected ? "text-foreground" : "text-muted-foreground")} aria-hidden="true" />
                            <span className="min-w-0 flex-1">
                                <span className="block text-sm font-medium text-foreground">{label}</span>
                                <span className="block text-xs text-muted-foreground">{description}</span>
                            </span>
                            {selected && <Check className="h-4 w-4 shrink-0 text-foreground" aria-label="Seleccionado" />}
                        </div>
                    )
                })}
            </div>
        </section>
    )
}

function InfoField({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="flex min-w-0 flex-col gap-1 py-2 sm:flex-row sm:items-baseline sm:gap-8">
            <dt className="w-48 shrink-0 text-xs text-muted-foreground">{label}</dt>
            <dd className="min-w-0 break-words text-sm font-medium text-foreground">{value}</dd>
        </div>
    )
}

function PasswordChangeSection() {
    const [saving, setSaving] = useState(false)

    const form = useForm<PasswordFormValues>({
        resolver: zodResolver(passwordSchema),
        defaultValues: { current_password: "", new_password: "", confirm_password: "" },
    })

    const onSubmit = async (data: PasswordFormValues) => {
        setSaving(true)
        try {
            await changePassword({
                current_password: data.current_password,
                new_password: data.new_password,
            })
            toast.success("Contraseña actualizada exitosamente")
            form.reset()
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Error al cambiar contraseña")
        } finally {
            setSaving(false)
        }
    }

    return (
        <section className="w-full max-w-none">
            <header className="border-b border-border/70 pb-4">
                <h2 className="text-base font-semibold text-foreground">Cambiar contraseña</h2>
                <p className="mt-1 text-sm text-muted-foreground">Actualice sus credenciales de acceso.</p>
            </header>
            <div className="pt-5">
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                        <FormField control={form.control} name="current_password" render={({ field, fieldState }) => (
                            <LabeledInput
                                {...field}
                                label="Contraseña Actual"
                                type="password"
                                placeholder="••••••••"
                                error={fieldState.error?.message}
                            />
                        )} />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField control={form.control} name="new_password" render={({ field, fieldState }) => (
                                <LabeledInput
                                    {...field}
                                    label="Nueva Contraseña"
                                    type="password"
                                    placeholder="••••••••"
                                    error={fieldState.error?.message}
                                />
                            )} />

                            <FormField control={form.control} name="confirm_password" render={({ field, fieldState }) => (
                                <LabeledInput
                                    {...field}
                                    label="Confirmar Contraseña"
                                    type="password"
                                    placeholder="••••••••"
                                    error={fieldState.error?.message}
                                />
                            )} />
                        </div>

                        <div className="flex justify-end pt-2">
                            <SubmitButton type="submit" loading={saving} disabled={saving} className="rounded-sm text-xs font-bold gap-2">
                                <KeyRound className="h-4 w-4" />
                                Cambiar Contraseña
                            </SubmitButton>
                        </div>
                    </form>
                </Form>
            </div>
        </section>
    )
}

// ============================================
// TAB 2: PERSONAL
// ============================================
function PersonalTab({
    profile,
    activeSubTab = "employee"
}: {
    profile: MyProfile
    activeSubTab?: string
}) {
    const { employee, payrolls, advances, payments } = profile

    const [previewPayrollId, setPreviewPayrollId] = useState<number | null>(null)
    const [previewOpen, setPreviewOpen] = useState(false)
    const [paymentsPayroll, setPaymentsPayroll] = useState<Payroll | null>(null)
    const [paymentsOpen, setPaymentsOpen] = useState(false)

    const unifiedPayments: UnifiedPayment[] = useMemo(() => [
        ...advances.map(a => ({
            id: `adv-${a.id}`,
            date: a.date,
            type: 'ANTICIPO' as const,
            typeLabel: 'Anticipo',
            amount: a.amount,
            payroll_display_id: a.payroll_display_id || null,
            statusKey: a.status
        })),
        ...payments.map(p => ({
            id: `pay-${p.id}`,
            date: p.date,
            type: p.payment_type as 'SALARIO' | 'PREVIRED',
            typeLabel: p.payment_type_display || p.payment_type,
            amount: p.amount,
            payroll_display_id: p.payroll_display_id || null,
            statusKey: p.status === 'CANCELLED' ? 'CANCELLED' : 'PAID'
        }))
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()), [advances, payments])

    const payrollCollection = useEntityCollection(payrollEntity, { rows: payrolls }, { pagination: { mode: "client", pageSize: 10 } })
    const paymentCollection = useEntityCollection(unifiedPaymentEntity, { rows: unifiedPayments }, { pagination: { mode: "client", pageSize: 10 } })

    const profilePayrollActionsCtx: ProfilePayrollActionsCtx = {
        onViewDetail: (id) => { setPreviewPayrollId(id); setPreviewOpen(true) },
        onViewPayments: (payroll) => { setPaymentsPayroll(payroll); setPaymentsOpen(true) },
        onDownloadPdf: async (id) => {
            try {
                const p = payrolls.find(p => p.id === id)
                await downloadPayrollPdf(id, `${p?.display_id}_${p?.period_label?.replace(' ', '_')}.pdf`)
                toast.success("Liquidación descargada")
            } catch {
                toast.error("Error al descargar")
            }
        },
    }

    const bulkDownloadAction = useMemo<BulkAction<Payroll>[]>(() => [
        {
            key: "download",
            label: "Descargar seleccionadas",
            icon: Download,
            onClick: async (items) => {
                try {
                    await downloadMultiplePayrollPdfs(items.map(p => p.id))
                    toast.success(`${items.length} liquidación(es) descargada(s)`)
                } catch {
                    toast.error("Error al descargar liquidaciones")
                }
            },
        },
    ], [])

    const contact = employee?.contact_detail

    if (!employee) {
        return (
            <div className="flex-1 flex items-center justify-center w-full">
                <EmptyState
                    icon={User}
                    title="Sin Ficha de Personal"
                    description="Su cuenta de usuario no tiene un perfil de empleado asociado. Contacte al administrador si necesita vincular su ficha."
                />
            </div>
        )
    }

    return (
        <div className="flex min-w-0 w-full flex-1 min-h-0 flex-col space-y-6">
            {/* Sub-tab 1: Ficha de Personal */}
            {activeSubTab === "employee" && (
                <FadeIn yOffset={10}>
                    <section className="w-full min-w-0 space-y-6">
                        <header className="flex items-start justify-between gap-4 border-b border-border/70 pb-4">
                            <div>
                                <h2 className="text-base font-semibold text-foreground">Ficha de Personal</h2>
                                <p className="mt-1 text-sm text-muted-foreground">{employee.display_id}</p>
                            </div>
                            <StatusBadge status={employee.status} label={employee.status_display} />
                        </header>
                        <section aria-labelledby="employee-contact-heading" className="space-y-1">
                            <h3 id="employee-contact-heading" className="text-sm font-semibold text-foreground">Datos personales</h3>
                            <dl className="divide-y divide-border/60">
                                <InfoField label="Nombre" value={contact?.name || "—"} />
                                <InfoField label="RUT" value={contact?.tax_id || "—"} />
                                <InfoField label="Correo electrónico" value={contact?.email || "—"} />
                            </dl>
                        </section>

                        <section aria-labelledby="employee-work-heading" className="space-y-1">
                            <h3 id="employee-work-heading" className="text-sm font-semibold text-foreground">Información laboral</h3>
                            <dl className="divide-y divide-border/60">
                                <InfoField label="Cargo" value={employee.position || "—"} />
                                <InfoField label="Departamento" value={employee.department || "—"} />
                                <InfoField label="Fecha de ingreso" value={employee.start_date ? formatPlainDate(employee.start_date) : "—"} />
                                <InfoField label="Tipo de contrato" value={employee.contract_type_display || "—"} />
                            </dl>
                        </section>

                        <section aria-labelledby="employee-benefits-heading" className="space-y-1">
                            <h3 id="employee-benefits-heading" className="text-sm font-semibold text-foreground">Previsión y remuneración</h3>
                            <dl className="divide-y divide-border/60">
                                <InfoField label="AFP" value={employee.afp_detail?.name || "—"} />
                                <InfoField label="Sistema de salud" value={employee.salud_type_display || "—"} />
                                <InfoField label="Sueldo base" value={<MoneyDisplay amount={parseFloat(employee.base_salary || "0")} />} />
                                <InfoField label="Jornada" value={employee.jornada_type_display || "—"} />
                            </dl>
                        </section>
                    </section>
                </FadeIn>
            )}

            {/* Sub-tab 2: Liquidaciones */}
            {activeSubTab === "payrolls" && (
                <FadeIn delay={0.1} yOffset={10}>
                    <section className="flex flex-1 min-h-0 flex-col">
                        <header className="mb-4 border-b border-border/70 pb-4">
                            <h2 className="text-base font-semibold text-foreground">Liquidaciones</h2>
                            <p className="mt-1 text-sm text-muted-foreground">Consulta y descarga tus liquidaciones emitidas.</p>
                        </header>
                        <div className="min-w-0 flex flex-1 flex-col gap-8 [&>div>div]:rounded-none [&>div>div]:border-0">
                            <Collection.Root
                                collection={payrollCollection}
                                selection="bulk"
                                actions={profilePayrollActions.forCollection(profilePayrollActionsCtx)}
                                onOpen={(payroll) => { setPreviewPayrollId(payroll.id); setPreviewOpen(true) }}
                            >
                                <Collection.View
                                    table={payrollViews.table}
                                    emptyTitle="No tiene liquidaciones"
                                    emptyDescription="Las liquidaciones contabilizadas aparecerán aquí una vez que sean emitidas."
                                />
                                <Collection.BulkBar actions={bulkDownloadAction} />
                            </Collection.Root>

                            <div className="flex min-h-0 flex-1 flex-col [&>div>div]:rounded-none [&>div>div]:border-0">
                                <header className="mb-3 border-b border-border/70 pb-3">
                                    <h3 className="text-sm font-semibold text-foreground">Pagos y anticipos</h3>
                                    <p className="mt-1 text-xs text-muted-foreground">{unifiedPayments.length} transacción(es) registrada(s)</p>
                                </header>
                                <Collection.Root collection={paymentCollection} label="Pagos y anticipos">
                                    <Collection.View
                                        table={unifiedPaymentViews.table}
                                        emptyTitle="No tiene transacciones"
                                        emptyDescription="Los anticipos y pagos de remuneraciones aparecerán aquí una vez que sean procesados."
                                    />
                                </Collection.Root>
                            </div>
                        </div>
                    </section>
                </FadeIn>
            )}

            <EmployeePayrollModal
                payrollId={previewPayrollId}
                open={previewOpen}
                onOpenChange={setPreviewOpen}
                employee={employee}
            />

            <PayrollPaymentsModal
                open={paymentsOpen}
                onOpenChange={setPaymentsOpen}
                payroll={paymentsPayroll}
                allPayments={unifiedPayments}
            />
        </div>
    )
}

function PinChangeSection() {
    const [saving, setSaving] = useState(false)

    const form = useForm<PinFormValues>({
        resolver: zodResolver(pinSchema),
        defaultValues: { current_password: "", new_pin: "", confirm_pin: "" },
    })

    const onSubmit = async (data: PinFormValues) => {
        setSaving(true)
        try {
            await changePin({
                current_password: data.current_password,
                new_pin: data.new_pin,
            })
            toast.success("PIN de Punto de Venta (POS) actualizado exitosamente")
            form.reset()
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Error al cambiar PIN")
        } finally {
            setSaving(false)
        }
    }

    return (
        <section className="w-full max-w-none">
            <header className="border-b border-border/70 pb-4">
                <h2 className="text-base font-semibold text-foreground">PIN de seguridad POS</h2>
                <p className="mt-1 text-sm text-muted-foreground">Defina su PIN para operaciones en Punto de Venta.</p>
            </header>
            <div className="pt-5">
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                        <FormField control={form.control} name="current_password" render={({ field, fieldState }) => (
                            <LabeledInput
                                {...field}
                                label="Contraseña Actual"
                                type="password"
                                placeholder="••••••••"
                                error={fieldState.error?.message}
                            />
                        )} />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField control={form.control} name="new_pin" render={({ field, fieldState }) => (
                                <LabeledInput
                                    {...field}
                                    label="Nuevo PIN (máx 4 dígitos)"
                                    type="password"
                                    pattern="\d*"
                                    inputMode="numeric"
                                    placeholder="••••"
                                    maxLength={4}
                                    error={fieldState.error?.message}
                                />
                            )} />

                            <FormField control={form.control} name="confirm_pin" render={({ field, fieldState }) => (
                                <LabeledInput
                                    {...field}
                                    label="Confirmar PIN"
                                    type="password"
                                    pattern="\d*"
                                    inputMode="numeric"
                                    placeholder="••••"
                                    maxLength={4}
                                    error={fieldState.error?.message}
                                />
                            )} />
                        </div>

                        <div className="flex justify-end pt-2">
                            <SubmitButton type="submit" loading={saving} disabled={saving} className="rounded-sm text-xs font-bold gap-2">
                                <Wallet className="h-4 w-4" />
                                Guardar PIN
                            </SubmitButton>
                        </div>
                    </form>
                </Form>
            </div>
        </section>
    )
}
