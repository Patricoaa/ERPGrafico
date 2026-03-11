"use client"

import { useState, useEffect, useCallback, use } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import {
    getPayroll, postPayroll, recalculatePayroll, deletePayroll,
    createPayrollItem, updatePayrollItem, deletePayrollItem,
    getPayrollConcepts, generateProformaPayroll
} from "@/lib/hr/api"
import type { Payroll, PayrollItem, PayrollConcept } from "@/types/hr"
import { PageHeader } from "@/components/shared/PageHeader"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog"
import {
    Form, FormControl, FormField, FormItem, FormLabel, FormMessage
} from "@/components/ui/form"
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select"
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table"
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from "@/components/ui/alert-dialog"
import {
    Loader2, Plus, Trash2, Pencil, ArrowLeft, BookOpen,
    TrendingUp, TrendingDown, DollarSign, ShieldCheck, AlertCircle, Sparkles
} from "lucide-react"
import { MoneyDisplay } from "@/components/shared/MoneyDisplay"
import { cn } from "@/lib/utils"

const itemSchema = z.object({
    concept: z.string().min(1, "Concepto requerido"),
    description: z.string().optional(),
    amount: z.string().min(1).refine(v => parseFloat(v) >= 0, "El monto debe ser mayor o igual a 0"),
})
type ItemFormValues = z.infer<typeof itemSchema>

interface Props {
    params: Promise<{ id: string }>
}

export default function PayrollDetailPage({ params }: Props) {
    const resolvedParams = use(params)
    const router = useRouter()
    const payrollId = parseInt(resolvedParams.id)

    const [payroll, setPayroll] = useState<Payroll | null>(null)
    const [concepts, setConcepts] = useState<PayrollConcept[]>([])
    const [loading, setLoading] = useState(true)
    const [posting, setPosting] = useState(false)
    const [generating, setGenerating] = useState(false)
    const [editingItem, setEditingItem] = useState<PayrollItem | null>(null)

    const fetchPayroll = useCallback(async () => {
        try {
            const [payrollData, conceptsData] = await Promise.all([
                getPayroll(payrollId),
                getPayrollConcepts()
            ])
            setPayroll(payrollData)
            setConcepts(conceptsData)
        } catch {
            toast.error("Error al cargar liquidación")
        } finally {
            setLoading(false)
        }
    }, [payrollId])

    useEffect(() => { fetchPayroll() }, [fetchPayroll])

    const handlePost = async () => {
        setPosting(true)
        try {
            const updated = await postPayroll(payrollId)
            setPayroll(updated)
            toast.success("Liquidación contabilizada")
        } catch (e: any) {
            toast.error(e?.response?.data?.detail || "Error al contabilizar")
        } finally {
            setPosting(false)
        }
    }

    const handleGenerateProforma = async () => {
        if (!payroll) return
        setGenerating(true)
        try {
            const updated = await generateProformaPayroll({
                employee: payroll.employee,
                period_year: payroll.period_year,
                period_month: payroll.period_month
            })
            setPayroll(updated)
            toast.success("Propuesta generada exitosamente")
        } catch (e: any) {
            toast.error(e?.response?.data?.detail || "Error al generar propuesta")
        } finally {
            setGenerating(false)
        }
    }

    const handleDeletePayroll = async () => {
        if (!confirm("¿Eliminar esta liquidación? Esta acción no se puede deshacer.")) return
        try {
            await deletePayroll(payrollId)
            toast.success("Liquidación eliminada")
            router.push('/hr/payrolls')
        } catch {
            toast.error("Error al eliminar liquidación")
        }
    }

    const handleDeleteItem = async (item: PayrollItem) => {
        try {
            await deletePayrollItem(payrollId, item.id)
            toast.success("Línea eliminada")
            fetchPayroll()
        } catch {
            toast.error("Error al eliminar")
        }
    }

    if (loading) {
        return (
            <div className="flex h-[400px] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    if (!payroll) return null

    const haberes = payroll.items?.filter(i => 
        i.concept_detail?.category === 'HABER_IMPONIBLE' || 
        i.concept_detail?.category === 'HABER_NO_IMPONIBLE'
    ) || []
    
    const legalDiscounts = payroll.items?.filter(i => 
        i.concept_detail?.category === 'DESCUENTO_LEGAL_TRABAJADOR' ||
        i.concept_detail?.category === 'DESCUENTO_LEGAL_EMPLEADOR'
    ) || []
    
    const otherDiscounts = payroll.items?.filter(i => 
        i.concept_detail?.category === 'OTRO_DESCUENTO'
    ) || []

    const isPosted = payroll.status === 'POSTED'

    return (
        <div className="flex-1 space-y-6 p-8 pt-6 max-w-5xl mx-auto">
            <PageHeader
                title={`Liquidación ${payroll.display_id}`}
                description={`${payroll.employee_detail?.contact_detail?.name} — ${payroll.period_label}`}
            >
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => router.push('/hr/payrolls')}>
                        <ArrowLeft className="h-4 w-4 mr-1" /> Volver
                    </Button>
                    <Badge
                        variant="secondary"
                        className={cn(
                            "text-[10px] font-bold uppercase",
                            isPosted
                                ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                                : "bg-amber-500/10 text-amber-600 border-amber-500/20"
                        )}
                    >
                        {payroll.status_display}
                    </Badge>
                    
                    {!isPosted && (
                        <>
                            <Button 
                                variant="outline" 
                                size="sm" 
                                className="gap-2 border-primary/30 text-primary hover:bg-primary/5"
                                onClick={handleGenerateProforma}
                                disabled={generating}
                            >
                                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                                Propuesta Inicial
                            </Button>

                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button size="sm" className="gap-2" disabled={posting}>
                                        {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookOpen className="h-4 w-4" />}
                                        Contabilizar
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>¿Contabilizar liquidación?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            Se generarán los asientos contables asociados a los haberes y retenciones legales.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction onClick={handlePost}>Contabilizar</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </>
                    )}
                    {payroll.status === 'DRAFT' && (
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                            onClick={handleDeletePayroll}
                        >
                            <Trash2 className="h-4 w-4 mr-1" /> Eliminar
                        </Button>
                    )}
                </div>
            </PageHeader>

            <div className="grid grid-cols-3 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-bold">
                            <TrendingUp className="h-3.5 w-3.5 text-emerald-500" /> Total Haberes
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <MoneyDisplay amount={parseFloat(payroll.total_haberes)} className="text-2xl font-black text-emerald-600" />
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-bold">
                            <TrendingDown className="h-3.5 w-3.5 text-rose-500" /> Total Descuentos
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <MoneyDisplay amount={parseFloat(payroll.total_descuentos)} className="text-2xl font-black text-rose-600" />
                    </CardContent>
                </Card>
                <Card className="border-primary/30 bg-primary/5">
                    <CardHeader className="pb-2">
                        <CardDescription className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-bold text-primary/70">
                            <DollarSign className="h-3.5 w-3.5 text-primary" /> Sueldo Líquido
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <MoneyDisplay amount={parseFloat(payroll.net_salary)} className="text-2xl font-black text-primary" />
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* HABERES */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-3">
                        <div>
                            <CardTitle className="text-sm flex items-center gap-2">
                                <TrendingUp className="h-4 w-4 text-emerald-500" /> Haberes
                            </CardTitle>
                        </div>
                        {!isPosted && (
                            <PayrollItemDialog
                                payrollId={payrollId}
                                concepts={concepts.filter(c => c.category.startsWith('HABER'))}
                                item={editingItem && (editingItem.concept_detail?.category.startsWith('HABER')) ? editingItem : null}
                                onSaved={fetchPayroll}
                                onEditCleared={() => setEditingItem(null)}
                                trigger={
                                    <Button variant="outline" size="sm" className="gap-1 h-7 text-xs">
                                        <Plus className="h-3.5 w-3.5" /> Agregar
                                    </Button>
                                }
                            />
                        )}
                    </CardHeader>
                    <CardContent className="p-0">
                        <ItemsTable
                            items={haberes}
                            isPosted={isPosted}
                            onEdit={setEditingItem}
                            onDelete={handleDeleteItem}
                            accentColor="text-emerald-600"
                        />
                    </CardContent>
                </Card>

                {/* DESCUENTOS */}
                <div className="space-y-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-3">
                            <CardTitle className="text-sm flex items-center gap-2">
                                <ShieldCheck className="h-4 w-4 text-amber-500" /> Legales / Previred
                            </CardTitle>
                            {!isPosted && (
                                <PayrollItemDialog
                                    payrollId={payrollId}
                                    concepts={concepts.filter(c => c.category === 'DESCUENTO_LEGAL_TRABAJADOR' || c.category === 'DESCUENTO_LEGAL_EMPLEADOR')}
                                    item={editingItem && (editingItem.concept_detail?.category === 'DESCUENTO_LEGAL_TRABAJADOR' || editingItem.concept_detail?.category === 'DESCUENTO_LEGAL_EMPLEADOR') ? editingItem : null}
                                    onSaved={fetchPayroll}
                                    onEditCleared={() => setEditingItem(null)}
                                    trigger={
                                        <Button variant="outline" size="sm" className="gap-1 h-7 text-xs">
                                            <Plus className="h-3.5 w-3.5" /> Agregar
                                        </Button>
                                    }
                                />
                            )}
                        </CardHeader>
                        <CardContent className="p-0">
                            <ItemsTable
                                items={legalDiscounts}
                                isPosted={isPosted}
                                onEdit={setEditingItem}
                                onDelete={handleDeleteItem}
                                accentColor="text-amber-600"
                            />
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-3">
                            <CardTitle className="text-sm flex items-center gap-2">
                                <TrendingDown className="h-4 w-4 text-rose-500" /> Otros Descuentos
                            </CardTitle>
                            {!isPosted && (
                                <PayrollItemDialog
                                    payrollId={payrollId}
                                    concepts={concepts.filter(c => c.category === 'OTRO_DESCUENTO')}
                                    item={editingItem && editingItem.concept_detail?.category === 'OTRO_DESCUENTO' ? editingItem : null}
                                    onSaved={fetchPayroll}
                                    onEditCleared={() => setEditingItem(null)}
                                    trigger={
                                        <Button variant="outline" size="sm" className="gap-1 h-7 text-xs">
                                            <Plus className="h-3.5 w-3.5" /> Agregar
                                        </Button>
                                    }
                                />
                            )}
                        </CardHeader>
                        <CardContent className="p-0">
                            <ItemsTable
                                items={otherDiscounts}
                                isPosted={isPosted}
                                onEdit={setEditingItem}
                                onDelete={handleDeleteItem}
                                accentColor="text-rose-600"
                            />
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}

function ItemsTable({ items, isPosted, onEdit, onDelete, accentColor }: { 
    items: PayrollItem[], isPosted: boolean, onEdit: (i: PayrollItem) => void, onDelete: (i: PayrollItem) => void, accentColor: string 
}) {
    if (items.length === 0) return <div className="px-4 py-6 text-center text-xs text-muted-foreground italic">Sin movimientos</div>
    return (
        <Table>
            <TableBody>
                {items.map(item => (
                    <TableRow key={item.id} className="group">
                        <TableCell className="py-2">
                            <div className="flex flex-col">
                                <span className="text-xs font-semibold">{item.concept_detail?.name}</span>
                                {item.description && <span className="text-[10px] text-muted-foreground">{item.description}</span>}
                            </div>
                        </TableCell>
                        <TableCell className="text-right py-2 px-4">
                            <MoneyDisplay amount={parseFloat(item.amount)} className={cn("text-xs font-bold", accentColor)} />
                        </TableCell>
                        {!isPosted && (
                            <TableCell className="w-[80px] p-0 pr-2">
                                <div className="flex justify-end gap-1">
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(item)}>
                                        <Pencil className="h-3 w-3" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-rose-500" onClick={() => { if (confirm("¿Eliminar?")) onDelete(item) }}>
                                        <Trash2 className="h-3 w-3" />
                                    </Button>
                                </div>
                            </TableCell>
                        )}
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    )
}

function PayrollItemDialog({ payrollId, item, concepts, onSaved, onEditCleared, trigger }: {
    payrollId: number, item: PayrollItem | null, concepts: PayrollConcept[], onSaved: () => void, onEditCleared: () => void, trigger?: React.ReactNode
}) {
    const [open, setOpen] = useState(false)
    const [saving, setSaving] = useState(false)

    useEffect(() => { if (item) setOpen(true) }, [item])

    const form = useForm<ItemFormValues>({
        resolver: zodResolver(itemSchema),
        defaultValues: { concept: "", description: "", amount: "0" }
    })

    useEffect(() => {
        if (item) {
            form.reset({
                concept: item.concept.toString(),
                description: item.description,
                amount: item.amount,
            })
        } else if (open) {
            form.reset({ concept: concepts[0]?.id.toString() || "", description: "", amount: "0" })
        }
    }, [item, open, concepts, form])

    const onSubmit = async (data: ItemFormValues) => {
        setSaving(true)
        try {
            const payload = { ...data, concept: parseInt(data.concept), payroll: payrollId }
            if (item) {
                await updatePayrollItem(payrollId, item.id, payload as any)
            } else {
                await createPayrollItem(payrollId, payload as any)
            }
            onSaved()
            setOpen(false)
            onEditCleared()
        } catch {
            toast.error("Error al guardar ítem")
        } finally {
            setSaving(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) onEditCleared() }}>
            {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
            <DialogContent className="sm:max-w-[400px]">
                <DialogHeader>
                    <DialogTitle>{item ? "Editar Línea" : "Agregar Línea"}</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField control={form.control} name="concept" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Concepto</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        {concepts.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="amount" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Monto ($)</FormLabel>
                                <FormControl><Input {...field} type="number" /></FormControl>
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="description" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Descripción Opcional</FormLabel>
                                <FormControl><Input {...field} /></FormControl>
                            </FormItem>
                        )} />
                        <DialogFooter>
                            <Button type="submit" disabled={saving}>
                                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Guardar
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
