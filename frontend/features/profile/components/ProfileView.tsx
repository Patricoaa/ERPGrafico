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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Form, FormField } from "@/components/ui/form"
import { cn } from "@/lib/utils"
import {
    User, ShieldCheck, KeyRound, Mail,
    Building2, Briefcase, Calendar, CreditCard, Wallet,
    Download, FileText,
    Sun, Moon, Monitor
} from "lucide-react"
import { EmptyState, LabeledInput, StatusBadge } from "@/components/shared"
import { EmployeePayrollPreview } from "./EmployeePayrollPreview"
import { PartnerProfileTab } from "./PartnerProfileTab"
import { profilePayrollActions, type ProfilePayrollActionsCtx } from './profilePayrollActions'
import { PayrollPaymentsDrawer } from './PayrollPaymentsDrawer'

import { Collection, useEntityCollection } from "@/components/entity-view"
import { payrollEntity, payrollViews } from "../entity-view/payroll.entity"
import { unifiedPaymentEntity, unifiedPaymentViews, type UnifiedPayment } from "../entity-view/unifiedPayment.entity"

import { useTheme } from "next-themes"
import { useThemeSync } from "../hooks/useThemeSync"
import { passwordSchema, pinSchema } from "../schema"
import type { PasswordFormValues, PinFormValues } from "../schema"

interface ProfileViewProps {
    activeTab: string
    activeSubTab?: string
    initialProfile?: MyProfile
}

export function ProfileView({ activeTab, activeSubTab = "employee", initialProfile }: ProfileViewProps) {
    const profile = initialProfile
    const contactDetail = profile?.contact_detail || profile?.employee?.contact_detail
    const isPartner = contactDetail?.is_partner

    if (!profile) return null

    return (
        <Tabs value={activeTab} className="w-full flex-1 min-h-0 flex flex-col">
            <div className="pt-0 flex-1 min-h-0 flex flex-col">
                <TabsContent value="account" className="mt-0 outline-none flex-1 min-h-0 flex flex-col">
                    <AccountTab activeSubTab={activeSubTab} />
                </TabsContent>

                <TabsContent value="personal" className="mt-0 outline-none flex-1 min-h-0 flex flex-col">
                    <PersonalTab
                        profile={profile}
                        activeSubTab={activeSubTab}
                    />
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
                    <ThemeSelectionCard />
                </FadeIn>
            )}

            {activeSubTab === "security" && (
                <>
                    <FadeIn delay={0.1} yOffset={10}>
                        <PasswordChangeCard />
                    </FadeIn>

                    <FadeIn delay={0.2} yOffset={10}>
                        <PinChangeCard />
                    </FadeIn>
                </>
            )}
        </div>
    )
}

function ThemeSelectionCard() {
    const { theme } = useTheme()
    const { changeTheme, isSyncing } = useThemeSync()

    const handleThemeKeyDown = (e: React.KeyboardEvent, next: "light" | "dark" | "system") => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            changeTheme(next)
        }
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="text-lg text-primary">Tema & Apariencia</CardTitle>
                    {isSyncing && (
                        <span className="text-4xs uppercase tracking-widest font-bold text-primary animate-pulse">
                            Sincronizando...
                        </span>
                    )}
                </div>
                <CardDescription>Personalice su entorno de trabajo visual</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div
                        role="button"
                        tabIndex={0}
                        onClick={() => changeTheme('light')}
                        onKeyDown={(e) => handleThemeKeyDown(e, 'light')}
                        className={cn(
                            "cursor-pointer border-2 p-5 rounded-md flex flex-col items-center justify-center gap-3 transition-all duration-normal ease-premium",
                            theme === 'light'
                                ? "border-primary bg-primary/5 scale-[1.01] shadow-card accent-visible"
                                : "border-border hover:border-muted-foreground/30 bg-muted/5"
                        )}
                    >
                        <Sun className={cn("h-8 w-8 transition-transform duration-normal ease-premium", theme === 'light' ? "text-warning scale-110" : "text-muted-foreground")} />
                        <div className="text-center space-y-1">
                            <span className="font-black text-xs uppercase tracking-wider block">Modo Claro</span>
                            <span className="text-4xs text-muted-foreground block font-bold leading-snug">Colores limpios y legibilidad óptima para luz diurna</span>
                        </div>
                    </div>

                    <div
                        role="button"
                        tabIndex={0}
                        onClick={() => changeTheme('dark')}
                        onKeyDown={(e) => handleThemeKeyDown(e, 'dark')}
                        className={cn(
                            "cursor-pointer border-2 p-5 rounded-md flex flex-col items-center justify-center gap-3 transition-all duration-normal ease-premium",
                            theme === 'dark'
                                ? "border-primary bg-primary/5 scale-[1.01] shadow-card accent-visible"
                                : "border-border hover:border-muted-foreground/30 bg-muted/5"
                        )}
                    >
                        <Moon className={cn("h-8 w-8 transition-transform duration-normal ease-premium", theme === 'dark' ? "text-primary scale-110" : "text-muted-foreground")} />
                        <div className="text-center space-y-1">
                            <span className="font-black text-xs uppercase tracking-wider block">Modo Oscuro</span>
                            <span className="text-4xs text-muted-foreground block font-bold leading-snug">Gris industrial desaturado para reducir fatiga visual</span>
                        </div>
                    </div>

                    <div
                        role="button"
                        tabIndex={0}
                        onClick={() => changeTheme('system')}
                        onKeyDown={(e) => handleThemeKeyDown(e, 'system')}
                        className={cn(
                            "cursor-pointer border-2 p-5 rounded-md flex flex-col items-center justify-center gap-3 transition-all duration-normal ease-premium",
                            theme === 'system'
                                ? "border-primary bg-primary/5 scale-[1.01] shadow-card accent-visible"
                                : "border-border hover:border-muted-foreground/30 bg-muted/5"
                        )}
                    >
                        <Monitor className={cn("h-8 w-8 transition-transform duration-normal ease-premium", theme === 'system' ? "text-primary scale-110" : "text-muted-foreground")} />
                        <div className="text-center space-y-1">
                            <span className="font-black text-xs uppercase tracking-wider block">Preferencia del Sistema</span>
                            <span className="text-4xs text-muted-foreground block font-bold leading-snug">Sincroniza automáticamente según su sistema operativo</span>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}

function InfoField({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
    return (
        <LabeledInput
            label={label}
            value={value}
            disabled
            readOnly
            icon={icon}
            className="bg-background/50 text-foreground"
            containerClassName="pointer-events-none"
        />
    )
}

function PasswordChangeCard() {
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
        <Card >
            <CardHeader>
                <CardTitle className="text-lg text-primary">Cambiar Contraseña</CardTitle>
                <CardDescription>Actualice sus credenciales de acceso</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
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
            </CardContent>
        </Card>
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
            statusKey: 'PAID'
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
                    title="Sin Ficha de Empleado"
                    description="Su cuenta de usuario no tiene un perfil de empleado asociado. Contacte al administrador si necesita vincular su ficha."
                />
            </div>
        )
    }

    return (
        <div className="flex flex-col w-full flex-1 min-h-0 space-y-6">
            {/* Sub-tab 1: Ficha de Empleado */}
            {activeSubTab === "employee" && (
                <FadeIn yOffset={10}>
                    <Card >
                        <CardHeader>
                            <CardTitle className="text-lg text-primary">Ficha de Empleado</CardTitle>
                            <CardDescription>
                                {employee.display_id} <span className="opacity-30">|</span> <StatusBadge status={employee.status} label={employee.status_display} />
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <InfoField icon={<User className="h-3.5 w-3.5" />} label="Nombre" value={contact?.name || "—"} />
                                <InfoField icon={<FileText className="h-3.5 w-3.5" />} label="RUT" value={contact?.tax_id || "—"} />
                                <InfoField icon={<Mail className="h-3.5 w-3.5" />} label="Email" value={contact?.email || "—"} />
                            </div>

                            <div className="flex items-center gap-2 pt-6 pb-2">
                                <div className="flex-1 h-px bg-border" />
                                <span className="text-3xs font-bold uppercase tracking-widest text-muted-foreground/60">Información Laboral</span>
                                <div className="flex-1 h-px bg-border" />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6 pt-2">
                                <InfoField icon={<Briefcase className="h-3.5 w-3.5" />} label="Cargo" value={employee.position || "—"} />
                                <InfoField icon={<Building2 className="h-3.5 w-3.5" />} label="Departamento" value={employee.department || "—"} />
                                <InfoField icon={<Calendar className="h-3.5 w-3.5" />} label="Fecha Ingreso" value={employee.start_date ? formatPlainDate(employee.start_date) : "—"} />
                                <InfoField icon={<FileText className="h-3.5 w-3.5" />} label="Contrato" value={employee.contract_type_display || "—"} />
                            </div>

                            <div className="flex items-center gap-2 pt-6 pb-2">
                                <div className="flex-1 h-px bg-border" />
                                <span className="text-3xs font-bold uppercase tracking-widest text-muted-foreground/60">Información Previsional</span>
                                <div className="flex-1 h-px bg-border" />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6 pt-2">
                                <InfoField icon={<ShieldCheck className="h-3.5 w-3.5" />} label="AFP" value={employee.afp_detail?.name || "—"} />
                                <InfoField icon={<ShieldCheck className="h-3.5 w-3.5" />} label="Sistema Salud" value={employee.salud_type_display || "—"} />
                                <fieldset className="notched-field pointer-events-none" aria-disabled="true">
                                    <legend className="px-1.5 text-3xs font-bold uppercase tracking-widest text-muted-foreground">
                                        Sueldo Base
                                    </legend>
                                    <div className="flex items-center gap-2 h-5 px-2 text-sm font-bold text-foreground">
                                        <CreditCard className="h-3.5 w-3.5 text-muted-foreground/60" />
                                        <MoneyDisplay amount={parseFloat(employee.base_salary || "0")} />
                                    </div>
                                </fieldset>
                                <InfoField icon={<FileText className="h-3.5 w-3.5" />} label="Jornada" value={employee.jornada_type_display || "—"} />
                            </div>
                        </CardContent>
                    </Card>
                </FadeIn>
            )}

            {/* Sub-tab 2: Liquidaciones */}
            {activeSubTab === "payrolls" && (
                <FadeIn delay={0.1} yOffset={10}>
                    <div className="flex-1 min-h-0 flex flex-col">
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
                    </div>
                </FadeIn>
            )}

            {/* Sub-tab 3: Pagos */}
            {activeSubTab === "payments" && (
                <FadeIn delay={0.2} yOffset={10}>
                    <Card className="flex-1 flex flex-col">
                        <CardHeader>
                            <CardTitle className="text-lg text-primary">Historial de Pagos y Anticipos</CardTitle>
                            <CardDescription>
                                {unifiedPayments.length} transacción(es) registrada(s)
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-0 flex-1 flex flex-col">
                            <div className="px-0 flex-1 flex flex-col">
                                <Collection.Root collection={paymentCollection}>
                                    <Collection.View
                                        table={unifiedPaymentViews.table}
                                        emptyTitle="No tiene transacciones"
                                        emptyDescription="Los anticipos y pagos de remuneraciones aparecerán aquí una vez que sean procesados."
                                    />
                                </Collection.Root>
                            </div>
                        </CardContent>
                    </Card>
                </FadeIn>
            )}

            <EmployeePayrollPreview
                payrollId={previewPayrollId}
                open={previewOpen}
                onOpenChange={setPreviewOpen}
                employee={employee}
            />

            <PayrollPaymentsDrawer
                open={paymentsOpen}
                onOpenChange={setPaymentsOpen}
                payroll={paymentsPayroll}
                allPayments={unifiedPayments}
            />
        </div>
    )
}

function PinChangeCard() {
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
        <Card >
            <CardHeader>
                <CardTitle className="text-lg text-primary">Pin de Seguridad POS</CardTitle>
                <CardDescription>Defina su PIN para operaciones en Punto de Venta</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
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
            </CardContent>
        </Card>
    )
}
