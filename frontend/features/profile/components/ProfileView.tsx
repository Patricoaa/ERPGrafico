"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { getMyProfile, changePassword, changePin, downloadPayrollPdf, downloadMultiplePayrollPdfs } from '@/features/profile/api/profileApi'
import type { MyProfile } from "@/types/profile"
import type { Payroll, SalaryAdvance, PayrollPayment } from "@/types/hr"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { Checkbox } from "@/components/ui/checkbox"
import { ColumnDef } from "@tanstack/react-table"
import { MoneyDisplay } from "@/components/shared/MoneyDisplay"
import { Form, FormField } from "@/components/ui/form"
import { cn } from "@/lib/utils"
import { motion } from "framer-motion"
import {
    Loader2, User, ShieldCheck, KeyRound, Mail, BadgeCheck,
    Building2, Briefcase, Calendar, CreditCard, Wallet,
    FileDown, Download, Eye, Clock, CheckCircle2, FileText,
    ChevronDown, ChevronRight
} from "lucide-react"
import { EmptyState, LabeledInput } from "@/components/shared"
import { EmployeePayrollPreview } from "./EmployeePayrollPreview"
import { PartnerProfileTab } from "./PartnerProfileTab"
import { DataCell, createActionsColumn } from "@/components/ui/data-table-cells"
import { CardSkeleton } from "@/components/shared"
import { ActionSlideButton } from "@/components/shared/ActionSlideButton";

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
    initialProfile?: MyProfile
}

export function ProfileView({ activeTab, initialProfile }: ProfileViewProps) {
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
            fetchProfile() 
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
        <Tabs value={activeTab} className="space-y-4">
            <div className="pt-0">
                <TabsContent value="account" className="mt-0 outline-none space-y-6">
                    <AccountTab user={profile.user} />
                </TabsContent>

                <TabsContent value="personal" className="mt-0 outline-none space-y-6">
                    <PersonalTab
                        profile={profile}
                        selectedPayrolls={selectedPayrolls}
                        onSelectedPayrollsChange={setSelectedPayrolls}
                        onBulkDownload={handleBulkDownload}
                        downloadingAll={downloadingAll}
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
function AccountTab({ user }: { user: MyProfile['user'] }) {
    const systemRoles = ['ADMIN', 'MANAGER', 'OPERATOR', 'READ_ONLY']
    const primaryRole = user.groups?.find(g => systemRoles.includes(g)) || 'Sin Rol'
    const functionalGroups = user.groups?.filter(g => !systemRoles.includes(g)) || []

    return (
        <div className="w-full space-y-8">
            {/* User Information Card */}
            <motion.div
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.4 }}
            >
                <Card className="border shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b bg-muted/30">
                        <div className="flex items-center gap-3">
                            <User className="h-5 w-5" />
                            <div>
                                <h3 className="text-sm font-bold tracking-tight">Información de la Cuenta</h3>
                                <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Datos de acceso al sistema</p>
                            </div>
                        </div>
                    </div>
                    <CardContent className="p-6 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <InfoField icon={<User className="h-3.5 w-3.5" />} label="Usuario" value={user.username} />
                            <InfoField icon={<Mail className="h-3.5 w-3.5" />} label="Email" value={user.email || "Sin email"} />
                            <InfoField icon={<BadgeCheck className="h-3.5 w-3.5" />} label="Nombre Completo" value={`${user.first_name || ''} ${user.last_name || ''}`.trim() || "Sin nombre"} />
                            <div className="space-y-1.5">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Estado</span>
                                <div>
                                    <Badge variant="outline" className={cn(
                                        "text-[9px] uppercase font-bold",
                                        user.is_active
                                            ? "text-success border-success/30 bg-success/10"
                                            : "text-destructive border-destructive/30 bg-destructive/5"
                                    )}>
                                        {user.is_active ? "Activo" : "Inactivo"}
                                    </Badge>
                                </div>
                            </div>
                        </div>

                        {/* Section: Role & Groups */}
                        <div className="flex items-center gap-2 pt-2 pb-2">
                            <div className="flex-1 h-px bg-border" />
                            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                                Rol y Equipos
                            </span>
                            <div className="flex-1 h-px bg-border" />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-1.5">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Rol del Sistema</span>
                                <div>
                                    <Badge className="text-[9px] uppercase font-bold">{primaryRole}</Badge>
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Equipos Funcionales</span>
                                <div className="flex flex-wrap gap-1.5">
                                    {functionalGroups.length > 0 ? functionalGroups.map(g => (
                                        <Badge key={g} variant="outline" className="text-[9px]">{g}</Badge>
                                    )) : (
                                        <span className="text-xs text-muted-foreground italic">Sin equipos asignados</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </motion.div>

            {/* Password Change Card */}
            <motion.div
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.4, delay: 0.1 }}
            >
                <PasswordChangeCard />
            </motion.div>

            {/* POS PIN Change Card */}
            <motion.div
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.4, delay: 0.2 }}
            >
                <PinChangeCard />
            </motion.div>
        </div>
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
        <Card className="border shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b bg-muted/30">
                <div className="flex items-center gap-3">
                    <KeyRound className="h-5 w-5" />
                    <div>
                        <h3 className="text-sm font-bold tracking-tight">Cambiar Contraseña</h3>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Actualice sus credenciales de acceso</p>
                    </div>
                </div>
            </div>
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
}: {
    profile: MyProfile
    selectedPayrolls: number[]
    onSelectedPayrollsChange: (ids: number[]) => void
    onBulkDownload: () => void
    downloadingAll: boolean
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
                        <DataCell.Badge variant={s === 'PAID' ? 'success' : s === 'PARTIAL' ? 'warning' : 'outline'}>
                            {s === 'PAID' ? 'Pagado' : s === 'PARTIAL' ? 'Parcial' : 'Pendiente'}
                        </DataCell.Badge>
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
                        <DataCell.Badge variant={type === 'SALARIO' ? 'success' : type === 'ANTICIPO' ? 'info' : 'warning'}>
                            {label}
                        </DataCell.Badge>
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
        <div className="w-full">
            <Accordion type="multiple" defaultValue={["employee", "payrolls", "payments"]} className="w-full space-y-6">

                {/* Employee Card */}
                <AccordionItem value="employee" className="border-none">
                    <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.4 }}>
                        <Card className="border shadow-sm overflow-hidden">
                            <AccordionTrigger className="hover:no-underline px-6 py-4 border-b bg-muted/30 [&[data-state=open]>div>svg]:rotate-180">
                                <div className="flex items-center gap-3">
                                    <BadgeCheck className="h-5 w-5" />
                                    <div className="text-left">
                                        <h3 className="text-sm font-bold tracking-tight">Ficha de Empleado</h3>
                                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-normal">
                                            {employee.display_id} <span className="opacity-30">|</span> {employee.status_display}
                                        </p>
                                    </div>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className="p-0 border-t-0">
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
                                        <InfoField icon={<Calendar className="h-3.5 w-3.5" />} label="Fecha Ingreso" value={employee.start_date ? new Date(employee.start_date).toLocaleDateString('es-CL') : "—"} />
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
                            </AccordionContent>
                        </Card>
                    </motion.div>
                </AccordionItem>

                <AccordionItem value="payrolls" className="border-none">
                    <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.4, delay: 0.1 }}>
                        <Card className="border shadow-sm overflow-hidden">
                            <AccordionTrigger className="hover:no-underline px-6 py-4 border-b bg-muted/30 [&[data-state=open]>div>svg]:rotate-180">
                                <div className="flex items-center justify-between w-full">
                                    <div className="flex items-center gap-3">
                                        <FileText className="h-5 w-5" />
                                        <div className="text-left">
                                            <h3 className="text-sm font-bold tracking-tight">Historial de Liquidaciones</h3>
                                            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-normal">
                                                {payrolls.length} liquidación(es) registrada(s)
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className="p-0 border-t-0">
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
                                <div className="px-0">
                                    {payrolls.length > 0 ? (
                                        <DataTable
                                            columns={payrollColumns}
                                            data={payrolls}
                                            searchPlaceholder="Buscar por folio..."
                                            globalFilterFields={["display_id"]}
                                            defaultPageSize={10}
                                            cardMode={false}
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
                            </AccordionContent>
                        </Card>
                    </motion.div>
                </AccordionItem>
            </Accordion>

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
        <Card className="border shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b bg-muted/30">
                <div className="flex items-center gap-3">
                    <Wallet className="h-5 w-5" />
                    <div>
                        <h3 className="text-sm font-bold tracking-tight">Pin de Seguridad POS</h3>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Defina su PIN para operaciones en Punto de Venta</p>
                    </div>
                </div>
            </div>
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
                            <ActionSlideButton type="submit" disabled={saving} className="rounded-lg text-xs font-bold gap-2">
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
