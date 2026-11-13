"use client"
import { formatPlainDate } from "@/lib/utils";

import { useState, useMemo } from "react"

import { toast } from "sonner"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { changePassword, downloadPayrollPdf, downloadMultiplePayrollPdfs } from '@/features/profile/api/profileApi'
import { useMyProfile } from '../context/ProfileProvider'
import type { MyProfile } from "@/types/profile"
import type { Payroll } from "@/types/hr"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { SubmitButton, FadeIn, MoneyDisplay, Section, type BulkAction } from "@/components/shared"
import { Form, FormField } from "@/components/ui/form"
import { cn } from "@/lib/utils"
import {
    User, KeyRound,
    Download,
    Check, Sun, Moon, Monitor,
    ShieldCheck, Users,
} from "lucide-react"
import { EmptyState, LabeledInput, StatusBadge } from "@/components/shared"
import { EmployeePayrollModal } from "./EmployeePayrollModal"
import { PartnerProfileTab } from "./PartnerProfileTab"
import { profilePayrollActions, type ProfilePayrollActionsCtx } from './profilePayrollActions'
import { PayrollPaymentsModal } from './PayrollPaymentsModal'

import { Collection, useEntityCollection } from "@/components/entity-view"
import { payrollEntity, payrollViews } from "../entity-view/payroll.entity"
import type { UnifiedPayment } from "../entity-view/unifiedPayment.entity"

import { useTheme } from "next-themes"
import { useThemeSync } from "../hooks/useThemeSync"
import { passwordSchema } from "../schema"
import type { PasswordFormValues } from "../schema"

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
                        <RolesSection />
                    </FadeIn>

                    <FadeIn delay={0.2} yOffset={10}>
                        <PasswordChangeSection />
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

    return (
        <Section
            as="h2"
            title="Tema y apariencia"
            description="Personalice su entorno de trabajo visual."
            actions={isSyncing ? <span role="status" className="shrink-0 text-xs font-normal normal-case tracking-normal text-muted-foreground">Guardando…</span> : undefined}
        >
            {options.map(({ value, label, description, icon: Icon }) => {
                const selected = theme === value
                return (
                    <Section.Row
                        key={value}
                        leading={<Icon className={cn("h-4 w-4", selected ? "text-foreground" : "text-muted-foreground")} aria-hidden="true" />}
                        title={label}
                        description={description}
                        onClick={() => changeTheme(value)}
                        pressed={selected}
                        actions={selected ? <Check className="h-4 w-4 shrink-0 text-foreground" aria-label="Seleccionado" /> : undefined}
                        className="min-h-16"
                    />
                )
            })}
        </Section>
    )
}

function RolesSection() {
    const { profile } = useMyProfile()
    const user = profile?.user
    const roles = user?.groups?.filter(g => g.kind === "ROLE") ?? []
    const teams = user?.groups?.filter(g => g.kind === "TEAM") ?? []

    const chip = "inline-flex items-center rounded px-2 py-0.5 text-xs font-medium bg-foreground/10 text-foreground"

    return (
        <Section as="h2" title="Roles y equipos" description="Accesos y grupos asignados a su cuenta.">
            <Section.Row
                leading={<ShieldCheck className="h-4 w-4 text-muted-foreground" aria-hidden="true" />}
                title="Roles"
                description={
                    user?.is_superuser ? (
                        <span className={chip}>Superusuario</span>
                    ) : roles.length > 0 ? (
                        <span className="flex flex-wrap gap-1.5 pt-1">
                            {roles.map(r => <span key={r.id} className={chip}>{r.name}</span>)}
                        </span>
                    ) : (
                        "Sin roles asignados"
                    )
                }
            />
            <Section.Row
                leading={<Users className="h-4 w-4 text-muted-foreground" aria-hidden="true" />}
                title="Equipos"
                description={
                    teams.length > 0 ? (
                        <span className="flex flex-wrap gap-1.5 pt-1">
                            {teams.map(t => <span key={t.id} className={chip}>{t.name}</span>)}
                        </span>
                    ) : (
                        "Sin equipos asignados"
                    )
                }
            />
        </Section>
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
            <Section.Header as="h2" title="Cambiar contraseña" description="Actualice sus credenciales de acceso." />
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
    ].sort((a, b) => b.date.localeCompare(a.date)), [advances, payments])

    const payrollCollection = useEntityCollection(payrollEntity, { rows: payrolls }, { pagination: { mode: "client", pageSize: 10 } })

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
                        <Section.Header
                            as="h2"
                            title="Ficha de Personal"
                            description={employee.display_id}
                            actions={<StatusBadge status={employee.status} label={employee.status_display} />}
                        />
                        <Section title="Datos personales">
                            <Section.Row variant="stat" plain title="Nombre" value={contact?.name || "—"} />
                            <Section.Row variant="stat" plain title="RUT" value={contact?.tax_id || "—"} />
                            <Section.Row variant="stat" plain title="Correo electrónico" value={contact?.email || "—"} />
                        </Section>

                        <Section title="Información laboral">
                            <Section.Row variant="stat" plain title="Cargo" value={employee.position || "—"} />
                            <Section.Row variant="stat" plain title="Departamento" value={employee.department || "—"} />
                            <Section.Row variant="stat" plain title="Fecha de ingreso" value={employee.start_date ? formatPlainDate(employee.start_date) : "—"} />
                            <Section.Row variant="stat" plain title="Tipo de contrato" value={employee.contract_type_display || "—"} />
                        </Section>

                        <Section title="Previsión y remuneración">
                            <Section.Row variant="stat" plain title="AFP" value={employee.afp_detail?.name || "—"} />
                            <Section.Row variant="stat" plain title="Sistema de salud" value={employee.salud_type_display || "—"} />
                            <Section.Row variant="stat" title="Sueldo base" value={<MoneyDisplay amount={parseFloat(employee.base_salary || "0")} />} />
                            <Section.Row variant="stat" plain title="Jornada" value={employee.jornada_type_display || "—"} />
                        </Section>
                    </section>
                </FadeIn>
            )}

            {/* Sub-tab 2: Liquidaciones */}
            {activeSubTab === "payrolls" && (
                <FadeIn delay={0.1} yOffset={10}>
                    <Section.Scope>
                        <section className="flex flex-1 min-h-0 flex-col">
                            <Section.Header as="h2" title="Liquidaciones" description="Consulta y descarga tus liquidaciones emitidas." className="mb-4" />
                            <div className="min-w-0 flex flex-1 min-h-0 flex-col">
                                <Collection.Root
                                    collection={payrollCollection}
                                    selection="bulk"
                                    actions={profilePayrollActions.forCollection(profilePayrollActionsCtx)}
                                    onOpen={(payroll) => { setPreviewPayrollId(payroll.id); setPreviewOpen(true) }}
                                >
                                    <Collection.View
                                        table={payrollViews.table}
                                        variant="embedded"
                                        emptyTitle="No tiene liquidaciones"
                                        emptyDescription="Las liquidaciones contabilizadas aparecerán aquí una vez que sean emitidas."
                                    />
                                    <Collection.BulkBar actions={bulkDownloadAction} />
                                </Collection.Root>
                            </div>
                        </section>
                    </Section.Scope>
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
