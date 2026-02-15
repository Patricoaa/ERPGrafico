"use client"

import { useState, useEffect } from "react"
import { useServerDate } from "@/hooks/useServerDate"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { cn } from "@/lib/utils"
import { CalendarIcon, Loader2, Calculator, Info } from "lucide-react"
import api from "@/lib/api"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"

interface TerminalBatchFormProps {
    onSuccess: () => void
    onCancel: () => void
}

export function TerminalBatchForm({ onSuccess, onCancel }: TerminalBatchFormProps) {
    const [loading, setLoading] = useState(false)
    const [terminals, setTerminals] = useState<any[]>([])

    // Form State
    const [paymentMethodId, setPaymentMethodId] = useState<string>("")
    const { serverDate } = useServerDate()
    const [date, setDate] = useState<Date | undefined>(undefined)

    // Sync state with server date when available and not yet set
    useEffect(() => {
        if (serverDate && !date) {
            setDate(serverDate)
        }
    }, [serverDate])
    const [grossAmount, setGrossAmount] = useState<string>("0")
    const [commissionNet, setCommissionNet] = useState<string>("0")
    const [commissionTax, setCommissionTax] = useState<string>("0")
    const [netDeposit, setNetDeposit] = useState<string>("0")
    const [reference, setReference] = useState("")
    const [selectedMovements, setSelectedMovements] = useState<any[]>([])
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
    const [openSelection, setOpenSelection] = useState(false)

    // Validation State
    const [isValid, setIsValid] = useState(true)
    const [diff, setDiff] = useState(0)

    // Load terminals
    useEffect(() => {
        const fetchTerminals = async () => {
            try {
                const res = await api.get('/treasury/payment-methods/?method_type=CARD_TERMINAL')
                setTerminals(res.data)
            } catch (error) {
                toast.error("Error al cargar terminales")
            }
        }
        fetchTerminals()
    }, [])

    // Real-time validation
    useEffect(() => {
        const gross = parseFloat(grossAmount) || 0
        const cNet = parseFloat(commissionNet) || 0
        const cTax = parseFloat(commissionTax) || 0

        const calculatedNet = Math.round(gross - (cNet + cTax))
        setNetDeposit(calculatedNet.toString())
        setIsValid(gross > 0 && calculatedNet >= 0)
    }, [grossAmount, commissionNet, commissionTax])


    const handleAutoCalculate = async () => {
        if (!paymentMethodId || !date) {
            toast.error("Seleccione terminal y fecha")
            return
        }
        setOpenSelection(true)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!isValid) {
            toast.error("Los montos no cuadran")
            return
        }

        setLoading(true)
        try {
            const payload = {
                payment_method: paymentMethodId,
                sales_date: date ? format(date, "yyyy-MM-dd") : null,
                gross_amount: parseFloat(grossAmount),
                commission_base: parseFloat(commissionNet),
                commission_tax: parseFloat(commissionTax),
                net_amount: parseFloat(netDeposit),
                terminal_reference: reference,
                movement_ids: selectedMovements.map(m => m.id)
            }

            await api.post('/treasury/terminal-batches/', payload)
            toast.success("Liquidación registrada exitosamente")
            onSuccess()
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Error al registrar")
        } finally {
            setLoading(false)
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6 py-4">
            <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                    <div className="grid gap-2">
                        <Label>Terminal de Cobro</Label>
                        <Select value={paymentMethodId} onValueChange={setPaymentMethodId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Seleccione terminal..." />
                            </SelectTrigger>
                            <SelectContent>
                                {terminals.map(t => (
                                    <SelectItem key={t.id} value={t.id.toString()}>{t.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid gap-2">
                        <Label>Fecha de Ventas</Label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant={"outline"}
                                    className={cn(
                                        "w-full justify-start text-left font-normal",
                                        !date && "text-muted-foreground"
                                    )}
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {date ? format(date, "PPP", { locale: es }) : <span>Seleccione fecha</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                                <Calendar
                                    mode="single"
                                    selected={date}
                                    onSelect={setDate}
                                    initialFocus
                                />
                            </PopoverContent>
                        </Popover>
                    </div>

                    <div className="grid gap-2">
                        <Label>N° Lote / Referencia (Opcional)</Label>
                        <Input
                            value={reference}
                            onChange={e => setReference(e.target.value)}
                            placeholder="Ej: LOTE-123456"
                        />
                    </div>
                </div>

                <div className="space-y-4 bg-muted/30 p-4 rounded-lg border">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="text-sm font-semibold flex items-center gap-2">
                            <Calculator className="h-4 w-4" /> Cálculo de Liquidación
                        </h3>
                        <Button type="button" variant="ghost" size="sm" onClick={handleAutoCalculate} className="h-7 text-xs">
                            Cargar Ventas
                        </Button>
                    </div>

                    <div className="grid gap-2">
                        <Label>Monto Bruto (Ventas)</Label>
                        <Input
                            type="number"
                            step="1"
                            value={grossAmount}
                            onChange={e => setGrossAmount(e.target.value)}
                            disabled={selectedMovements.length > 0}
                            className={cn("font-bold", selectedMovements.length > 0 && "bg-muted")}
                        />
                        {selectedMovements.length > 0 && (
                            <p className="text-[10px] text-primary font-bold">
                                {selectedMovements.length} ventas vinculadas
                            </p>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="grid gap-2">
                            <Label className="text-xs">Comisión Neta</Label>
                            <Input
                                type="number"
                                step="1"
                                value={commissionNet}
                                onChange={e => {
                                    const val = e.target.value
                                    setCommissionNet(val)
                                    // Auto-calc tax (19% as a helper, user can override)
                                    const net = parseFloat(val) || 0
                                    setCommissionTax(Math.round(net * 0.19).toString())
                                }}
                                className="text-right"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label className="text-xs">IVA Comisión</Label>
                            <Input
                                type="number"
                                step="1"
                                value={commissionTax}
                                readOnly
                                className="text-right bg-muted"
                            />
                        </div>
                    </div>

                    <div className="grid gap-2 pt-2 border-t border-dashed border-gray-300">
                        <Label className="text-emerald-700 font-bold">Monto Neto a Depositar</Label>
                        <Input
                            type="number"
                            step="1"
                            value={netDeposit}
                            readOnly
                            className="font-bold text-lg text-right text-emerald-600 border-emerald-200 bg-emerald-50 bg-muted cursor-not-allowed"
                        />
                    </div>
                </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
                <Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button>
                <Button type="submit" disabled={loading || !isValid || !paymentMethodId}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Registrar Liquidación
                </Button>
            </div>

            <SaleSelectionModal
                open={openSelection}
                onOpenChange={setOpenSelection}
                paymentMethodId={paymentMethodId}
                date={date}
                initialSelectedIds={selectedIds}
                onConfirm={(movements, ids) => {
                    setSelectedMovements(movements)
                    setSelectedIds(ids)
                    const total = movements.reduce((sum, m) => sum + parseFloat(m.amount), 0)
                    setGrossAmount(total.toString())
                    setOpenSelection(false)
                }}
            />
        </form>
    )
}

function SaleSelectionModal({ open, onOpenChange, paymentMethodId, date, onConfirm, initialSelectedIds }: {
    open: boolean,
    onOpenChange: (open: boolean) => void,
    paymentMethodId: string,
    date: Date | undefined,
    onConfirm: (movements: any[], ids: Set<number>) => void,
    initialSelectedIds: Set<number>
}) {
    const [movements, setMovements] = useState<any[]>([])
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (open && paymentMethodId && date) {
            setLoading(true)
            const dateStr = format(date, "yyyy-MM-dd")
            api.get(`/treasury/movements/`, {
                params: {
                    payment_method_new: paymentMethodId,
                    // Remove date filter to show all pending
                    movement_type: 'INBOUND',
                    terminal_batch__isnull: 'True'
                }
            }).then(res => {
                const data = res.data.results || res.data

                // Sort: Prioritize selected date, then by date descending
                const sorted = [...data].sort((a: any, b: any) => {
                    if (a.date === dateStr && b.date !== dateStr) return -1
                    if (a.date !== dateStr && b.date === dateStr) return 1
                    return b.date.localeCompare(a.date)
                })

                setMovements(sorted)

                // Initial auto-selection: only sales for the selected date
                const next = new Set<number>()
                if (initialSelectedIds.size === 0) {
                    sorted.forEach((m: any) => {
                        if (m.date === dateStr) next.add(m.id)
                    })
                } else {
                    initialSelectedIds.forEach(id => {
                        if (sorted.some((m: any) => m.id === id)) next.add(id)
                    })
                }
                setSelectedIds(next)
            }).finally(() => setLoading(false))
        }
    }, [open, paymentMethodId, date])

    const toggleAll = () => {
        if (selectedIds.size === movements.length) {
            setSelectedIds(new Set())
        } else {
            setSelectedIds(new Set(movements.map(m => m.id)))
        }
    }

    const toggleOne = (id: number) => {
        const next = new Set(selectedIds)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        setSelectedIds(next)
    }

    const totalSelected = movements
        .filter(m => selectedIds.has(m.id))
        .reduce((sum, m) => sum + parseFloat(m.amount), 0)

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>Seleccionar Ventas a Liquidar</DialogTitle>
                    <DialogDescription>
                        Seleccione las transacciones que el proveedor incluyó en esta liquidación.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4">
                    <div className="flex items-center justify-between mb-4 px-2">
                        <div className="flex items-center gap-2">
                            <Checkbox
                                id="select-all"
                                checked={selectedIds.size === movements.length && movements.length > 0}
                                onCheckedChange={toggleAll}
                            />
                            <Label htmlFor="select-all" className="text-sm font-bold cursor-pointer">
                                Seleccionar Todas ({movements.length})
                            </Label>
                        </div>
                        <div className="text-sm font-black text-emerald-600">
                            Total: {new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP" }).format(totalSelected)}
                        </div>
                    </div>

                    <ScrollArea className="h-[300px] border rounded-md">
                        {loading ? (
                            <div className="flex items-center justify-center h-full">
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                            </div>
                        ) : movements.length === 0 ? (
                            <div className="p-8 text-center text-muted-foreground italic">
                                No se encontraron ventas pendientes para esta fecha.
                            </div>
                        ) : (
                            <div className="divide-y">
                                {movements.map((m) => (
                                    <div
                                        key={m.id}
                                        className="flex items-center gap-4 p-3 hover:bg-muted/50 cursor-pointer"
                                        onClick={() => toggleOne(m.id)}
                                    >
                                        <Checkbox
                                            checked={selectedIds.has(m.id)}
                                            onCheckedChange={() => toggleOne(m.id)}
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className="text-sm font-bold">{m.reference || 'Sin referencia'}</p>
                                                {m.date === format(date!, "yyyy-MM-dd") && (
                                                    <Badge variant="secondary" className="text-[9px] h-4 px-1 bg-primary/10 text-primary border-primary/20">Hoy</Badge>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground uppercase">
                                                <span>{m.partner_name || 'Particular'}</span>
                                                <span>•</span>
                                                <span className="font-medium">{format(new Date(m.date + 'T12:00:00'), "dd/MM/yyyy")}</span>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-black">
                                                {new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP" }).format(parseFloat(m.amount))}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </ScrollArea>
                </div>

                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
                    <Button
                        onClick={() => onConfirm(movements.filter(m => selectedIds.has(m.id)), selectedIds)}
                        disabled={selectedIds.size === 0}
                    >
                        Confirmar Selección
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

export default TerminalBatchForm
