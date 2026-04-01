"use client"

import React from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table"
import {
    Loader2, Trash2, Pencil, Sparkles, AlertCircle, DollarSign, Clock, CheckCircle2, Plus
} from "lucide-react"
import { MoneyDisplay } from "@/components/shared/MoneyDisplay"
import { cn } from "@/lib/utils"
import type { Payroll, PayrollItem } from "@/types/hr"
import { DataCell } from "@/components/ui/data-table-cells"
import { FORM_STYLES } from "@/lib/styles"
import { useConfirmAction } from "@/hooks/useConfirmAction"
import { ActionConfirmModal } from "@/components/shared/ActionConfirmModal"

interface PayrollCardProps {
    payroll: Payroll
    isPosted?: boolean
    isReadOnly?: boolean
    showEmployerContributions?: boolean
    isSalaryPaid?: boolean
    isPreviredPaid?: boolean
    onEditItem?: (item: PayrollItem) => void
    onDeleteItem?: (item: PayrollItem) => void
    onAddItem?: () => void
    payments?: any[]
    className?: string
}

function ItemRow({ item, type, isReadOnly, onEdit, onDeleteRequest }: {
    item: PayrollItem, type: 'HABER' | 'DESCUENTO', isReadOnly: boolean, onEdit?: (i: PayrollItem) => void, onDeleteRequest?: (i: PayrollItem) => void
}) {
    return (
        <TableRow className="group border-none hover:bg-muted/50 transition-colors">
            <TableCell className="py-3 pl-8">
                <div className="flex flex-col">
                    <DataCell.Text className="text-[11px] font-bold text-foreground uppercase tracking-tight">
                        {item.concept_detail?.name}
                    </DataCell.Text>
                    {item.description && (
                        <DataCell.Secondary className="text-[10px] text-muted-foreground leading-none mt-0.5 italic">
                            {item.description}
                        </DataCell.Secondary>
                    )}
                </div>
            </TableCell>
            <TableCell className="text-right py-3 tabular-nums">
                {type === 'HABER' && <DataCell.Currency value={item.amount} className="text-[11px] font-black text-emerald-600" />}
            </TableCell>
            <TableCell className="text-right py-3 pr-8 tabular-nums">
                {type === 'DESCUENTO' && <DataCell.Currency value={item.amount} className="text-[11px] font-black text-rose-500" />}
            </TableCell>
            {!isReadOnly && (
                <TableCell className="w-[80px] p-0 pr-6 text-right">
                    <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/5"
                            onClick={() => onEdit?.(item)}
                        >
                            <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 rounded-lg text-muted-foreground hover:text-rose-500 hover:bg-rose-50"
                            onClick={() => onDeleteRequest?.(item)}
                        >
                            <Trash2 className="h-3 w-3" />
                        </Button>
                    </div>
                </TableCell>
            )}
        </TableRow>
    )
}

export function PayrollCard({
    payroll,
    isPosted = false,
    isReadOnly = false,
    showEmployerContributions = true,
    isSalaryPaid: isSalaryPaidProp,
    isPreviredPaid: isPreviredPaidProp,
    onEditItem,
    onDeleteItem,
    onAddItem,
    payments,
    className
}: PayrollCardProps) {
    if (!payroll) return null

    const haberes = payroll.items?.filter(i =>
        i.concept_detail?.category === 'HABER_IMPONIBLE' ||
        i.concept_detail?.category === 'HABER_NO_IMPONIBLE'
    ) || []

    const workerLegalDiscounts = payroll.items?.filter(i =>
        i.concept_detail?.category === 'DESCUENTO_LEGAL_TRABAJADOR'
    ) || []

    const employerContributions = payroll.items?.filter(i =>
        i.concept_detail?.category === 'DESCUENTO_LEGAL_EMPLEADOR'
    ) || []

    const otherDiscounts = payroll.items?.filter(i =>
        i.concept_detail?.category === 'OTRO_DESCUENTO'
    ) || []

    const netSalary = parseFloat(payroll.net_salary || "0")

    // Use props if available, otherwise fallback to payroll object fields
    const isSalaryPaid = isSalaryPaidProp ?? (payroll as any).is_salary_paid ?? (payroll as any).payments?.some((p: any) => p.payment_type === 'SALARIO') ?? false
    const isPreviredPaid = isPreviredPaidProp ?? (payroll as any).is_previred_paid ?? (payroll as any).payments?.some((p: any) => p.payment_type === 'PREVIRED') ?? false

    const unifiedPayments = [
        ...(payroll.advances || []).map(a => ({
            id: `adv-${a.id}`,
            date: a.date,
            type: 'Anticipo',
            amount: parseFloat(a.amount),
            method: a.payment_method_name || "Efectivo",
            isAdvance: true
        })),
        ...(payments || []).filter(p => p.payment_type === 'SALARIO').map(p => ({
            id: `pay-${p.id}`,
            date: p.date,
            type: 'Pago Sueldo',
            amount: parseFloat(p.amount),
            method: p.notes || "Transferencia",
            isAdvance: false
        }))
    ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    const [itemToDelete, setItemToDelete] = React.useState<PayrollItem | null>(null)

    const totalPaid = unifiedPayments.reduce((acc, p) => acc + p.amount, 0)
    const pendingToPay = netSalary - totalPaid

    const itemDeleteConfirm = useConfirmAction(async () => {
        if (onDeleteItem && itemToDelete) onDeleteItem(itemToDelete)
        setItemToDelete(null)
    })

    const handleItemDeleteRequest = (item: PayrollItem) => {
        setItemToDelete(item)
        itemDeleteConfirm.requestConfirm()
    }

    return (
        <Card className={cn("max-w-4xl mx-auto shadow-2xl border-none overflow-hidden bg-white rounded-3xl", className)}>
            <div className="h-2 w-full bg-primary" />
            {/* 1. DOCUMENT HEADER */}
            <CardHeader className="pb-0 pt-8 px-10">
                <div className="flex justify-between items-start gap-8">
                    <div className="space-y-4 flex-1">
                        <div className="flex items-center gap-4">
                            <div className="p-2.5 bg-primary/10 rounded-xl text-primary shadow-sm border border-primary/5">
                                <Sparkles className="h-7 w-7" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-slate-950 tracking-tight leading-none">
                                    Liquidación de Sueldo
                                </h1>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-x-8 gap-y-3 pt-6">
                            <div className="space-y-1">
                                <p className={FORM_STYLES.label}>Datos del Empleado</p>
                                <div className="flex flex-col">
                                    <span className="text-sm font-bold text-foreground leading-tight">
                                        {payroll.employee_detail?.contact_detail?.name || payroll.employee_name || (payroll as any).employee?.name || "—"}
                                    </span>
                                    {(payroll.employee_detail?.contact_detail?.tax_id || (payroll as any).employee_tax_id || (payroll as any).employee?.tax_id) ? (
                                        <span className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mt-0.5">
                                            RUT: <span className="font-bold text-foreground">{payroll.employee_detail?.contact_detail?.tax_id || (payroll as any).employee_tax_id || (payroll as any).employee?.tax_id}</span>
                                        </span>
                                    ) : (
                                        <span className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mt-0.5">RUT: —</span>
                                    )}
                                    <span className="text-[10px] text-primary/70 font-bold uppercase tracking-widest mt-1">
                                        {payroll.employee_detail?.position || (payroll as any).employee_position || (payroll as any).employee?.position || "Personal"} <span className="opacity-30">|</span> {payroll.employee_detail?.department || (payroll as any).employee_department || (payroll as any).employee?.department || "General"}
                                    </span>
                                </div>
                            </div>
                            <div className="space-y-1 text-right">
                                <p className={FORM_STYLES.label}>Periodo Laboral</p>
                                <div className="flex flex-col">
                                    <span className="text-sm font-bold text-foreground leading-tight">
                                        {payroll.period_label}
                                    </span>
                                    <span className="text-[11px] text-muted-foreground font-medium uppercase tracking-widest mt-0.5">
                                        Folio <span className="opacity-30">|</span> <span className="font-bold text-primary/80">{payroll.display_id}</span>
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {!isReadOnly && (
                        <div className="hidden sm:flex flex-col items-end gap-3 shrink-0">
                            <Badge variant="outline" className={cn(
                                "px-4 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-xl shadow-sm border-none ring-1 ring-inset",
                                isPosted
                                    ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20"
                                    : "bg-amber-50 text-amber-700 ring-amber-600/20"
                            )}>
                                {payroll.status_display}
                            </Badge>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-2 pt-3 pb-0 opacity-60">
                    <div className="flex-1 h-px bg-slate-200" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/40 px-3">
                        Asistencia y Base
                    </span>
                    <div className="flex-1 h-px bg-slate-200" />
                </div>

                {/* STATS BAR */}
                <div className="mt-1 grid grid-cols-4 border rounded-2xl overflow-hidden bg-muted/50 shadow-sm border/60 divide-x divide-slate-200/60">
                    <div className="p-4 text-center space-y-1">
                        <p className={FORM_STYLES.label}>Días Pactados</p>
                        <p className="text-sm font-bold text-foreground">{payroll.agreed_days || 0}</p>
                    </div>
                    <div className="p-4 text-center space-y-1">
                        <p className={FORM_STYLES.label}>Ausencias</p>
                        <p className="text-sm font-bold text-rose-600">{payroll.absent_days || 0}</p>
                    </div>
                    <div className="p-4 text-center space-y-1">
                        <p className={FORM_STYLES.label}>Trabajados</p>
                        <p className="text-sm font-bold text-foreground">{payroll.worked_days || 0}</p>
                    </div>
                    <div className="p-4 text-center space-y-1 bg-primary/[0.03]">
                        <p className={cn(FORM_STYLES.label, "text-primary/70")}>Sueldo Base</p>
                        <div className="flex items-center justify-center gap-1">
                            <span className="text-[10px] font-bold text-primary/40">$</span>
                            <MoneyDisplay amount={parseFloat(payroll.base_salary || "0")} className="text-sm font-black text-primary" />
                        </div>
                    </div>
                </div>
            </CardHeader>


            <CardContent className="px-10 py-8">
                {/* 2. CONSOLIDATED DETAIL TABLE */}
                <div className="flex items-center gap-2 pt-2 pb-6">
                    <div className="flex-1 h-px bg-slate-200" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/40 px-3">
                        Detalle de Conceptos
                    </span>
                    <div className="flex-1 h-px bg-slate-200" />
                </div>

                <div className="border border/60 rounded-2xl overflow-hidden shadow-sm bg-white transition-all">
                    <Table>
                        <TableHeader className="bg-muted/80 border-b border/60 transition-colors">
                            <TableRow className="hover:bg-transparent border-none py-1">
                                <TableHead className={cn(FORM_STYLES.label, "h-11 pl-8 text-muted-foreground")}>Conceptos de Remuneración</TableHead>
                                <TableHead className={cn(FORM_STYLES.label, "h-11 text-emerald-600 text-right")}>Haberes (+)</TableHead>
                                <TableHead className={cn(FORM_STYLES.label, "h-11 text-rose-500 text-right pr-8")}>Descuentos (-)</TableHead>
                                {!isReadOnly && <TableHead className="h-11 w-[80px]"></TableHead>}
                            </TableRow>
                        </TableHeader>

                        <TableBody>
                            {/* HABERES SECTION */}
                            {haberes.map(item => (
                                <ItemRow key={item.id} item={item} type="HABER" isReadOnly={isReadOnly} onEdit={onEditItem} onDeleteRequest={handleItemDeleteRequest} />
                            ))}

                            <TableRow className="bg-muted/30 hover:bg-muted/30 border-y">
                                <TableCell className="py-2 pl-6 text-[11px] font-black text-muted-foreground uppercase tracking-wider">Subtotal Haberes</TableCell>
                                <TableCell className="py-2 text-right">
                                    <MoneyDisplay amount={parseFloat(payroll.total_haberes || "0")} className="text-sm font-black text-emerald-600" />
                                </TableCell>
                                <TableCell colSpan={isReadOnly ? 1 : 2}></TableCell>
                            </TableRow>

                            {/* DESCUENTOS SECTION */}
                            {workerLegalDiscounts.map(item => (
                                <ItemRow key={item.id} item={item} type="DESCUENTO" isReadOnly={isReadOnly} onEdit={onEditItem} onDeleteRequest={handleItemDeleteRequest} />
                            ))}
                            {otherDiscounts.map(item => (
                                <ItemRow key={item.id} item={item} type="DESCUENTO" isReadOnly={isReadOnly} onEdit={onEditItem} onDeleteRequest={handleItemDeleteRequest} />
                            ))}

                            <TableRow className="bg-muted/80 hover:bg-muted/80 border-y border/60 transition-colors">
                                <TableCell className="py-2.5 pl-8 text-[11px] font-black text-muted-foreground uppercase tracking-wider">Subtotal Descuentos</TableCell>
                                <TableCell></TableCell>
                                <TableCell className="py-2.5 text-right pr-8">
                                    <MoneyDisplay amount={parseFloat(payroll.total_descuentos || "0")} className="text-sm font-black text-rose-600" />
                                </TableCell>
                                {!isReadOnly && <TableCell></TableCell>}
                            </TableRow>
                        </TableBody>
                    </Table>
                </div>


                {!isReadOnly && onAddItem && (
                    <div className="mt-4 flex justify-end">
                        <Button
                            variant="outline"
                            size="sm"
                            className="rounded-xl text-[10px] font-bold uppercase tracking-wider h-9 px-4 gap-2 border-dashed bg-primary/5 border-primary/20 text-primary hover:bg-primary/10 transition-all shadow-sm"
                            onClick={onAddItem}
                        >
                            <Plus className="h-3.5 w-3.5" /> Agregar Concepto Manual
                        </Button>
                    </div>
                )}

                {/* 3. TOTALS & FINAL CALCULATION */}
                <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                    <div className="space-y-4 pt-2">
                        {/* APORTES PATRONALES (ONLY IF ALLOWED) */}
                        {showEmployerContributions && employerContributions.length > 0 && (
                            <div className="space-y-4 p-5 bg-muted/50 rounded-2xl border border/60">
                                <h3 className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2 mb-2">
                                    <AlertCircle className="h-3 w-3" /> Costo Empresa / Aportes Patronales
                                </h3>
                                <div className="space-y-2.5">
                                    {employerContributions.map(c => (
                                        <div key={c.id} className="flex justify-between items-center text-[11px] group/item">
                                            <span className="text-muted-foreground group-hover/item:text-foreground transition-colors">{c.concept_detail?.name}</span>
                                            <MoneyDisplay amount={parseFloat(c.amount)} className="font-bold text-foreground" />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* NOTES SECTION */}
                        {payroll.notes && (
                            <div className="p-4 space-y-2">
                                <span className={FORM_STYLES.label}>Observaciones</span>
                                <p className="text-xs text-muted-foreground italic leading-relaxed">"{payroll.notes}"</p>
                            </div>
                        )}
                    </div>

                    <div className="space-y-4">
                        {/* THE LIQUID CARD */}
                        <div className="p-7 rounded-3xl bg-primary shadow-xl shadow-primary/20 border-none text-white relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                                <DollarSign className="h-20 w-20" />
                            </div>
                            <div className="relative z-10 flex flex-col gap-1">
                                <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-80">Líquido a Percibir</p>
                                <MoneyDisplay amount={netSalary} className="text-5xl font-black tracking-tighter" />
                            </div>
                        </div>

                        {/* HISTORIAL DE PAGOS (Moved to right column) */}
                        {(unifiedPayments.length > 0) && (
                            <div className="bg-muted/50 rounded-2xl border border/60 p-5 space-y-4">
                                <div className="flex justify-between items-center pb-2 border-b border/60">
                                    <h4 className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Historial de Pagos</h4>
                                    <span className={cn(FORM_STYLES.label, "text-muted-foreground opacity-20 uppercase tracking-widest")}>Recibos</span>
                                </div>
                                <div className="space-y-3">
                                    {unifiedPayments.map(p => (
                                        <div key={p.id} className="flex justify-between items-center group/pay">
                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-2">
                                                    <span className={cn(
                                                        "text-[10px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter",
                                                        p.isAdvance ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                                                    )}>
                                                        {p.type}
                                                    </span>
                                                    <span className="text-[11px] font-black text-foreground uppercase tracking-tight">
                                                        {p.method.split(' - ')[0].split(' (')[0]}
                                                    </span>
                                                </div>
                                                <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-tighter mt-1 opacity-60">
                                                    {new Date(p.date).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                </span>
                                            </div>
                                            <MoneyDisplay amount={p.amount} className="text-xs font-black text-foreground tabular-nums" />
                                        </div>
                                    ))}
                                </div>
                                {pendingToPay > 0 && isPosted && (
                                    <div className="pt-3 border-t border/60 flex justify-between items-center">
                                        <span className="text-[10px] font-black uppercase text-amber-600 tracking-wider">Saldo Pendiente de Pago</span>
                                        <MoneyDisplay amount={pendingToPay} className="text-sm font-black text-amber-700" />
                                    </div>
                                )}
                            </div>
                        )}

                        {/* STATUS MESSAGE FOR EMPLOYEE */}
                        {isPosted && isSalaryPaid && (
                            <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-between transition-all hover:shadow-md">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-emerald-100 rounded-xl">
                                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Remuneración Pagada</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* 4. LEGAL FOOTER */}
                <div className="mt-20 pt-10 border-t border-slate-100 grid grid-cols-2 gap-24">
                    <div className="space-y-4">
                        <div className="h-[1px] w-full bg-slate-200 mb-2"></div>
                        <p className={cn(FORM_STYLES.label, "text-center text-muted-foreground/40")}>Firma del Empleador</p>
                    </div>
                    <div className="space-y-4">
                        <div className="h-[1px] w-full bg-slate-200 mb-2"></div>
                        <p className={cn(FORM_STYLES.label, "text-center text-muted-foreground/40")}>Firma del Trabajador</p>
                    </div>
                </div>
                <div className="mt-16 text-center space-y-2">
                    <p className="text-[10px] text-muted-foreground/50 font-bold uppercase tracking-[0.3em]">
                        Documento Oficial de Remuneraciones
                    </p>
                    <p className="text-[9px] text-muted-foreground/30 font-medium italic">
                        Generado por el Módulo de RRHH • {new Date().toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })}
                    </p>
                </div>

            </CardContent>

            <ActionConfirmModal
                open={itemDeleteConfirm.isOpen}
                onOpenChange={(open) => { 
                    if (!open) {
                        itemDeleteConfirm.cancel()
                        setItemToDelete(null)
                    }
                }}
                onConfirm={itemDeleteConfirm.confirm}
                title="Eliminar Línea"
                description={`¿Eliminar línea: ${itemToDelete?.concept_detail?.name || 'Item'}?`}
                variant="destructive"
            />
        </Card>
    )
}
