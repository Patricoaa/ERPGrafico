"use client"
import { formatPlainDate } from "@/lib/utils";

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { getMyProfile, changePassword, changePin, downloadPayrollPdf, downloadMultiplePayrollPdfs } from '@/features/profile/api/profileApi'
import type { MyProfile } from "@/types/profile"
import type {Payroll} from "@/types/hr"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { ActionSlideButton, Chip, FadeIn, MoneyDisplay, StatusBadge } from '@/components/shared'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { DataTable } from '@/components/shared'
import { DataTableColumnHeader } from '@/components/shared'
import { Checkbox } from "@/components/ui/checkbox"
import { ColumnDef } from "@tanstack/react-table"

import { Form, FormField } from "@/components/ui/form"
import { cn } from "@/lib/utils"
import {
    Loader2, User, ShieldCheck, KeyRound, Mail,
    Building2, Briefcase, Calendar, CreditCard, Wallet,
    FileDown, Download, Eye, Clock, CheckCircle2, FileText,
    ChevronDown, ChevronRight, Sun, Moon, Monitor
} from "lucide-react"
import { EmptyState, LabeledInput } from "@/components/shared"
import { EmployeePayrollPreview } from "./EmployeePayrollPreview"
import { PartnerProfileTab } from "./PartnerProfileTab"
import { DataCell, createActionsColumn } from '@/components/shared'
import { CardSkeleton } from "@/components/shared"
;
import { useTheme } from "next-themes"
import { useThemeSync } from "../hooks/useThemeSync"

// --- Schemas ---
const passwordSchema = z.object({
    current_password: z.string().min(1, "Ingrese su contraseña actual"),
    new_password: z.string().min(6, "Mínimo 6 caracteres"),
    confirm_password: z.string().min(1, "Confirme la nueva contraseña"),
}).refine(data => data.new_password === data.confirm_password, {
    message: "Las contraseñas no coinciden",
    path: ["confirm_password"],
})
type PasswordFormValues = z.infer<typeof passwordSchema>

const pinSchema = z.object({
    current_password: z.string().min(1, "Ingrese su contraseña actual"),
    new_pin: z.string()
        .min(1, "El PIN no puede estar vacío")
        .max(4, "Máximo 4 dígitos")
        .regex(/^\d+$/, "El PIN debe ser solo números"),
    confirm_pin: z.string().min(1, "Confirme el nuevo PIN"),
}).refine(data => data.new_pin === data.confirm_pin, {
    message: "Los PINs no coinciden",
    path: ["confirm_pin"],
})
type PinFormValues = z.infer<typeof pinSchema>

interface ProfileViewProps {
    activeTab: string
    activeSubTab?: string
    initialProfile?: MyProfile
}

export function ProfileView({ activeTab, activeSubTab = "employee", initialProfile }: ProfileViewProps) {
    const router = useRouter()
    const [profile, setProfile] = useState<MyProfile | null>(initialProfile || null)
    const [loading, setLoading] = useState(!initialProfile)
    const [selectedPayrolls, setSelectedPayrolls] = useState<number[]>([])
    const [downloadingAll, setDownloadingAll] = useState(false)

    const fetchProfile = useCallback(async () => {
        try {
            const data = await getMyProfile()
            setProfile(data)
        } catch {
            toast.error("Error al cargar perfil")
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        if (!initialProfile) {
            requestAnimationFrame(() => {
                fetchProfile()
            })
        }
    }, [fetchProfile, initialProfile])

    const contactDetail = profile?.contact_detail || profile?.employee?.contact_detail
    const isPartner = contactDetail?.is_partner

    if (loading) {
        return (
            <div className="space-y-6">
                <CardSkeleton count={1} variant="grid" className="h-[300px]" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <CardSkeleton count={2} variant="grid" className="h-[200px]" />
                </div>
            </div>
        )
    }

    if (!profile) return null

    const handleBulkDownload = async () => {
        if (selectedPayrolls.length === 0) {
            toast.info("Seleccione las liquidaciones que desea descargar")
            return
        }
        setDownloadingAll(true)
        try {
            await downloadMultiplePayrollPdfs(selectedPayrolls)
            toast.success(`${selectedPayrolls.length} liquidación(es) descargada(s)`)
            setSelectedPayrolls([])
        } catch {
            toast.error("Error al descargar liquidaciones")
        } finally {
            setDownloadingAll(false)
        }
    }

    return (
        <Tabs value={activeTab} className="max-w-6xl mx-auto space-y-6">
            <div className="pt-0">
                <TabsContent value="account" className="mt-0 outline-none space-y-6">
                    <AccountTab user={profile.user} activeSubTab={activeSubTab} />
                </TabsContent>

                <TabsContent value="personal" className="mt-0 outline-none space-y-6">
                    <PersonalTab
                        profile={profile}
                        selectedPayrolls={selectedPayrolls}
                        onSelectedPayrollsChange={setSelectedPayrolls}
                        onBulkDownload={handleBulkDownload}
                        downloadingAll={downloadingAll}
                        activeSubTab={activeSubTab}
                    />
                </TabsContent>

                {isPartner && contactDetail && (
                    <TabsContent value="partner" className="mt-0 outline-none space-y-6">
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
function AccountTab({ user, activeSubTab }: { user: MyProfile['user']; activeSubTab?: string }) {
    const systemRoles = ['ADMIN', 'MANAGER', 'OPERATOR', 'READ_ONLY']
    const primaryRole = user.groups?.find(g => systemRoles.includes(g)) || 'Sin Rol'
    const functionalGroups = user.groups?.filter(g => !systemRoles.includes(g)) || []

    return (
        <div className="w-full space-y-8">
            {activeSubTab === "preferences" && (
                <FadeIn delay={0.1} yOffset={10}>
                    <ThemeSelectionCard />
                </FadeIn>
            )}

            {activeSubTab === "security" && (
                <>
                    {/* Password Change Card */}
                    <FadeIn delay={0.1} yOffset={10}>
                        <PasswordChangeCard />
                    </FadeIn>

                    {/* POS PIN Change Card */}
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

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="text-lg text-primary">Tema & Apariencia</CardTitle>
                    {isSyncing && (
                        <span className="text-[9px] uppercase tracking-widest font-black text-primary animate-pulse">
                            Sincronizando...
                        </span>
                    )}
                </div>
                <CardDescription>Personalice su entorno de trabajo visual</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Opción Claro */}
                    <div
                        onClick={() => changeTheme('light')}
                        className={cn(
                            "cursor-pointer border-2 p-5 rounded-xl flex flex-col items-center justify-center gap-3 transition-all duration-normal ease-premium",
                            theme === 'light'
                                ? "border-primary bg-primary/5 scale-[1.01] shadow-sm"
                                : "border-border hover:border-muted-foreground/30 bg-muted/5"
                        )}
                    >
                        <Sun className={cn("h-8 w-8 transition-transform duration-normal ease-premium", theme === 'light' ? "text-warning scale-110" : "text-muted-foreground")} />
                        <div className="text-center space-y-1">
                            <span className="font-black text-xs uppercase tracking-wider block">Modo Claro</span>
                            <span className="text-[9px] text-muted-foreground block font-bold leading-snug">Colores limpios y legibilidad óptima para luz diurna</span>
                        </div>
                    </div>

                    {/* Opción Oscuro */}
                    <div
                        onClick={() => changeTheme('dark')}
                        className={cn(
                            "cursor-pointer border-2 p-5 rounded-xl flex flex-col items-center justify-center gap-3 transition-all duration-normal ease-premium",
                            theme === 'dark'
                                ? "border-primary bg-primary/5 scale-[1.01] shadow-sm"
                                : "border-border hover:border-muted-foreground/30 bg-muted/5"
                        )}
                    >
                        <Moon className={cn("h-8 w-8 transition-transform duration-normal ease-premium", theme === 'dark' ? "text-primary scale-110" : "text-muted-foreground")} />
                        <div className="text-center space-y-1">
                            <span className="font-black text-xs uppercase tracking-wider block">Modo Oscuro</span>
                            <span className="text-[9px] text-muted-foreground block font-bold leading-snug">Gris industrial desaturado para reducir fatiga visual</span>
                        </div>
                    </div>

                    {/* Opción Sistema */}
                    <div
                        onClick={() => changeTheme('system')}
                        className={cn(
                            "cursor-pointer border-2 p-5 rounded-xl flex flex-col items-center justify-center gap-3 transition-all duration-normal ease-premium",
                            theme === 'system'
                                ? "border-primary bg-primary/5 scale-[1.01] shadow-sm"
                                : "border-border hover:border-muted-foreground/30 bg-muted/5"
                        )}
                    >
                        <Monitor className={cn("h-8 w-8 transition-transform duration-normal ease-premium", theme === 'system' ? "text-primary scale-110" : "text-muted-foreground")} />
                        <div className="text-center space-y-1">
                            <span className="font-black text-xs uppercase tracking-wider block">Preferencia del Sistema</span>
                            <span className="text-[9px] text-muted-foreground block font-bold leading-snug">Sincroniza automáticamente según su sistema operativo</span>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}

function InfoField({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
    return (
        <div className="space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
            <div className="flex items-center gap-2 h-10 px-3 rounded-sm border bg-muted/20 text-sm font-medium text-foreground">
                <span className="text-muted-foreground">{icon}</span>
                {value}
            </div>
        </div>
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
        <Card variant="transparent">
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
                            <ActionSlideButton type="submit" disabled={saving} className="rounded-sm text-xs font-bold gap-2">
                                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                                <KeyRound className="h-4 w-4" />
                                Cambiar Contraseña
                            </ActionSlideButton>
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
    selectedPayrolls,
    onSelectedPayrollsChange,
    onBulkDownload,
    downloadingAll,
    activeSubTab = "employee"
}: {
    profile: MyProfile
    selectedPayrolls: number[]
    onSelectedPayrollsChange: (ids: number[]) => void
    onBulkDownload: () => void
    downloadingAll: boolean
    activeSubTab?: string
}) {
    const router = useRouter()
    const { employee, payrolls, advances, payments } = profile

    const [previewPayrollId, setPreviewPayrollId] = useState<number | null>(null)
    const [previewOpen, setPreviewOpen] = useState(false)

    type UnifiedPayment = {
        id: string;
        date: string;
        type: 'ANTICIPO' | 'SALARIO' | 'PREVIRED';
        typeLabel: string;
        amount: string;
        payroll_display_id: string | null;
        statusLabel?: string;
    }

    const unifiedPayments: UnifiedPayment[] = [
        ...advances.map(a => ({
            id: `adv-${a.id}`,
            date: a.date,
            type: 'ANTICIPO' as const,
            typeLabel: 'Anticipo',
            amount: a.amount,
            payroll_display_id: a.payroll_display_id || null,
            statusLabel: a.is_discounted ? 'Descontado' : 'Pendiente'
        })),
        ...payments.map(p => ({
            id: `pay-${p.id}`,
            date: p.date,
            type: p.payment_type as 'SALARIO' | 'PREVIRED',
            typeLabel: p.payment_type_display || p.payment_type,
            amount: p.amount,
            payroll_display_id: p.payroll_display_id || null,
            statusLabel: 'Pagado'
        }))
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    if (!employee) {
        return (
            <div className="max-w-3xl">
                <EmptyState
                    icon={User}
                    title="Sin Ficha de Empleado"
                    description="Su cuenta de usuario no tiene un perfil de empleado asociado. Contacte al administrador si necesita vincular su ficha."
                />
            </div>
        )
    }

    // Payroll columns
    const payrollColumns: ColumnDef<Payroll>[] = [
        {
            id: "expander",
            header: () => null,
            cell: ({ row }) => {
                const pId = row.original.display_id
                const hasPayments = unifiedPayments.some(p => p.payroll_display_id === pId)
                if (!hasPayments) return null
                return (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 opacity-50 hover:opacity-100"
                        onClick={(e) => {
                            e.stopPropagation()
                            row.toggleExpanded()
                        }}
                    >
                        {row.getIsExpanded() ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </Button>
                )
            },
        },
        {
            id: "select",
            header: ({ table }) => (
                <Checkbox
                    checked={table.getIsAllPageRowsSelected()}
                    onCheckedChange={(value) => {
                        table.toggleAllPageRowsSelected(!!value)
                        if (value) {
                            onSelectedPayrollsChange(payrolls.map(p => p.id))
                        } else {
                            onSelectedPayrollsChange([])
                        }
                    }}
                    aria-label="Seleccionar todo"
                    className="translate-y-[2px]"
                />
            ),
            cell: ({ row }) => (
                <Checkbox
                    checked={selectedPayrolls.includes(row.original.id)}
                    onCheckedChange={(value) => {
                        if (value) {
                            onSelectedPayrollsChange([...selectedPayrolls, row.original.id])
                        } else {
                            onSelectedPayrollsChange(selectedPayrolls.filter(id => id !== row.original.id))
                        }
                    }}
                    aria-label="Seleccionar fila"
                    className="translate-y-[2px]"
                />
            ),
            enableSorting: false,
            enableHiding: false,
        },
        {
            accessorKey: "display_id",
            header: ({ column }) => <DataTableColumnHeader column={column} className="justify-center" title="Folio" />,
            cell: ({ row }) => <DataCell.Code className="text-center font-bold">{row.getValue("display_id")}</DataCell.Code>,
        },
        {
            accessorKey: "period_label",
            header: ({ column }) => <DataTableColumnHeader column={column} className="justify-center" title="Período" />,
            cell: ({ row }) => <DataCell.Text className="text-center text-sm">{row.getValue("period_label")}</DataCell.Text>,
        },
        {
            accessorKey: "total_haberes",
            header: ({ column }) => <DataTableColumnHeader column={column} className="justify-center" title="Haberes" />,
            cell: ({ row }) => <DataCell.Currency value={row.getValue("total_haberes")} className="text-success font-bold" />,
        },
        {
            accessorKey: "total_descuentos",
            header: ({ column }) => <DataTableColumnHeader column={column} className="justify-center" title="Descuentos" />,
            cell: ({ row }) => <DataCell.Currency value={row.getValue("total_descuentos") || "0"} className="text-destructive font-bold" />,
        },
        {
            accessorKey: "net_salary",
            header: ({ column }) => <DataTableColumnHeader column={column} className="justify-center" title="Líquido" />,
            cell: ({ row }) => <DataCell.Currency value={row.getValue("net_salary")} className="font-bold text-foreground" />,
        },
        {
            accessorKey: "remuneration_paid_status",
            header: ({ column }) => <DataTableColumnHeader column={column} className="justify-center" title="Pago" />,
            cell: ({ row }) => {
                const s = row.original.remuneration_paid_status
                return (
                    <div className="flex justify-center">
                        <StatusBadge status={s || "PENDING"} />
                    </div>
                )
            }
        },
        createActionsColumn<Payroll>({
            renderActions: (p) => (
                <>
                    <DataCell.Action
                        icon={Eye}
                        title="Ver detalle"
                        onClick={(e) => {
                            e.stopPropagation()
                            setPreviewPayrollId(p.id)
                            setPreviewOpen(true)
                        }}
                    />
                    <DataCell.Action
                        icon={FileDown}
                        title="Descargar PDF"
                        onClick={async (e) => {
                            e.stopPropagation()
                            try {
                                await downloadPayrollPdf(p.id, `${p.display_id}_${p.period_label?.replace(' ', '_')}.pdf`)
                                toast.success("Liquidación descargada")
                            } catch {
                                toast.error("Error al descargar")
                            }
                        }}
                    />
                </>
            )
        }),
    ]

    // Unified Payment columns
    const unifiedPaymentColumns: ColumnDef<UnifiedPayment>[] = [
        {
            accessorKey: "date",
            header: ({ column }) => <DataTableColumnHeader column={column} className="justify-center" title="Fecha" />,
            cell: ({ row }) => <DataCell.Date value={row.getValue("date")} className="text-center" />,
        },
        {
            accessorKey: "typeLabel",
            header: ({ column }) => <DataTableColumnHeader column={column} className="justify-center" title="Tipo" />,
            cell: ({ row }) => {
                const type = row.original.type
                const label = row.getValue("typeLabel") as string
                return (
                    <div className="flex justify-center">
                        <Chip size="xs" intent={type === 'SALARIO' ? 'success' : type === 'ANTICIPO' ? 'info' : 'warning'}>
                            {label}
                        </Chip>
                    </div>
                )
            },
        },
        {
            accessorKey: "amount",
            header: ({ column }) => <DataTableColumnHeader column={column} className="justify-center" title="Monto" />,
            cell: ({ row }) => <DataCell.Currency value={row.getValue("amount")} className="font-bold" />,
        },

        {
            accessorKey: "statusLabel",
            header: ({ column }) => <DataTableColumnHeader column={column} className="justify-center" title="Estado" />,
            cell: ({ row }) => <DataCell.Secondary className="text-center font-bold uppercase tracking-wider">{row.original.statusLabel}</DataCell.Secondary>
        }
    ]

    const contact = employee.contact_detail

    return (
        <div className="flex flex-col w-full h-full space-y-6">
            {/* Sub-tab 1: Ficha de Empleado */}
            {activeSubTab === "employee" && (
                <FadeIn yOffset={10}>
                    <Card variant="transparent">
                        <CardHeader>
                            <CardTitle className="text-lg text-primary">Ficha de Empleado</CardTitle>
                            <CardDescription>
                                {employee.display_id} <span className="opacity-30">|</span> {employee.status_display}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-6">
                            {/* Contact Info */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <InfoField icon={<User className="h-3.5 w-3.5" />} label="Nombre" value={contact?.name || "—"} />
                                <InfoField icon={<FileText className="h-3.5 w-3.5" />} label="RUT" value={contact?.tax_id || "—"} />
                                <InfoField icon={<Mail className="h-3.5 w-3.5" />} label="Email" value={contact?.email || "—"} />
                            </div>

                            {/* Section: Employment Data */}
                            <div className="flex items-center gap-2 pt-6 pb-2">
                                <div className="flex-1 h-px bg-border" />
                                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                                    Información Laboral
                                </span>
                                <div className="flex-1 h-px bg-border" />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6 pt-2">
                                <InfoField icon={<Briefcase className="h-3.5 w-3.5" />} label="Cargo" value={employee.position || "—"} />
                                <InfoField icon={<Building2 className="h-3.5 w-3.5" />} label="Departamento" value={employee.department || "—"} />
                                <InfoField icon={<Calendar className="h-3.5 w-3.5" />} label="Fecha Ingreso" value={employee.start_date ? formatPlainDate(employee.start_date) : "—"} />
                                <InfoField icon={<FileText className="h-3.5 w-3.5" />} label="Contrato" value={employee.contract_type_display || "—"} />
                            </div>

                            {/* Previsional */}
                            <div className="flex items-center gap-2 pt-6 pb-2">
                                <div className="flex-1 h-px bg-border" />
                                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                                    Información Previsional
                                </span>
                                <div className="flex-1 h-px bg-border" />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6 pt-2">
                                <InfoField icon={<ShieldCheck className="h-3.5 w-3.5" />} label="AFP" value={employee.afp_detail?.name || "—"} />
                                <InfoField icon={<ShieldCheck className="h-3.5 w-3.5" />} label="Sistema Salud" value={employee.salud_type_display || "—"} />
                                <div className="space-y-1.5">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Sueldo Base</span>
                                    <div className="flex items-center gap-2 h-10 px-3 rounded-sm border bg-muted/20 text-sm font-bold text-foreground">
                                        <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                                        <MoneyDisplay amount={parseFloat(employee.base_salary || "0")} />
                                    </div>
                                </div>
                                <InfoField icon={<Clock className="h-3.5 w-3.5" />} label="Jornada" value={employee.jornada_type_display || "—"} />
                            </div>
                        </CardContent>
                    </Card>
                </FadeIn>
            )}

            {/* Sub-tab 2: Liquidaciones */}
            {activeSubTab === "payrolls" && (
                <FadeIn delay={0.1} yOffset={10}>
                    <Card variant="transparent">
                        <CardHeader>
                            <CardTitle className="text-lg text-primary">Historial de Liquidaciones</CardTitle>
                            <CardDescription>
                                {payrolls.length} liquidación(es) registrada(s)
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-0">
                            {selectedPayrolls.length > 0 && (
                                <div className="px-6 py-2 border-b bg-muted/10 flex justify-end">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="gap-2 rounded-sm text-xs font-bold border-primary/30 text-primary hover:bg-primary/5"
                                        onClick={onBulkDownload}
                                        disabled={downloadingAll}
                                    >
                                        {downloadingAll ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                                        Descargar {selectedPayrolls.length} seleccionada(s)
                                    </Button>
                                </div>
                            )}
                            <div className="flex-1 min-h-0">
                                {payrolls.length > 0 ? (
                                    <DataTable
                                        columns={payrollColumns}
                                        data={payrolls}
                                        searchPlaceholder="Buscar por folio..."
                                        globalFilterFields={["display_id"]}
                                        defaultPageSize={10}
                                        variant="standalone"
                                        noBorder={true}
                                        useAdvancedFilter={true}
                                        toolbarClassName="px-6 pt-6 pb-2 pl-14"
                                        showToolbarSort={false}
                                        facetedFilters={[{
                                            column: "period_label",
                                            title: "Período",
                                            options: Array.from(new Set(payrolls.map(p => p.period_label))).map(label => ({ label, value: label }))
                                        }]}
                                        renderSubComponent={(row) => {
                                            const relatedPayments = unifiedPayments.filter(p => p.payroll_display_id === row.original.display_id)
                                            return (
                                                <div className="bg-muted/30 pb-4">
                                                    <div className="max-h-[300px] overflow-y-auto custom-scrollbar border-t border-b">
                                                        <DataTable
                                                            columns={unifiedPaymentColumns}
                                                            data={relatedPayments}
                                                            variant="minimal"
                                                            noBorder={true}
                                                            hidePagination={true}
                                                            defaultPageSize={100}
                                                        />
                                                    </div>
                                                </div>
                                            )
                                        }}
                                    />
                                ) : (
                                    <EmptyState
                                        context="generic"
                                        icon={FileText}
                                        title="No tiene liquidaciones"
                                        description="Las liquidaciones contabilizadas aparecerán aquí una vez que sean emitidas."
                                    />
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </FadeIn>
            )}

            {/* Sub-tab 3: Pagos */}
            {activeSubTab === "payments" && (
                <FadeIn delay={0.2} yOffset={10}>
                    <Card variant="transparent">
                        <CardHeader>
                            <CardTitle className="text-lg text-primary">Historial de Pagos y Anticipos</CardTitle>
                            <CardDescription>
                                {unifiedPayments.length} transacción(es) registrada(s)
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="px-0">
                                {unifiedPayments.length > 0 ? (
                                    <DataTable
                                        columns={unifiedPaymentColumns}
                                        data={unifiedPayments}
                                        searchPlaceholder="Buscar por tipo..."
                                        globalFilterFields={["typeLabel"]}
                                        defaultPageSize={10}
                                        variant="standalone"
                                        noBorder={true}
                                        useAdvancedFilter={true}
                                        toolbarClassName="px-6 pt-6 pb-2"
                                        showToolbarSort={false}
                                    />
                                ) : (
                                    <EmptyState
                                        context="generic"
                                        icon={CreditCard}
                                        title="No tiene transacciones"
                                        description="Los anticipos y pagos de remuneraciones aparecerán aquí una vez que sean procesados."
                                    />
                                )}
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
        <Card variant="transparent">
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
                            <ActionSlideButton type="submit" disabled={saving} className="rounded-sm text-xs font-bold gap-2">
                                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                                <Wallet className="h-4 w-4" />
                                Guardar PIN
                            </ActionSlideButton>
                        </div>
                    </form>
                </Form>
            </CardContent>
        </Card>
    )
}
