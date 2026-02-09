"use client"

import { useState, useEffect } from "react"
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

interface TerminalBatchFormProps {
    onSuccess: () => void
    onCancel: () => void
}

export function TerminalBatchForm({ onSuccess, onCancel }: TerminalBatchFormProps) {
    const [loading, setLoading] = useState(false)
    const [terminals, setTerminals] = useState<any[]>([])

    // Form State
    const [paymentMethodId, setPaymentMethodId] = useState<string>("")
    const [date, setDate] = useState<Date | undefined>(new Date())
    const [grossAmount, setGrossAmount] = useState<string>("0")
    const [commissionNet, setCommissionNet] = useState<string>("0")
    const [commissionTax, setCommissionTax] = useState<string>("0")
    const [netDeposit, setNetDeposit] = useState<string>("0")
    const [reference, setReference] = useState("")

    // Validation State
    const [isValid, setIsValid] = useState(true)
    const [diff, setDiff] = useState(0)

    // Load terminals
    useEffect(() => {
        const fetchTerminals = async () => {
            try {
                const res = await api.get('/treasury/payment-methods/?is_terminal=true')
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
        const commNet = parseFloat(commissionNet) || 0
        const commTax = parseFloat(commissionTax) || 0
        const net = parseFloat(netDeposit) || 0

        const calculatedNet = gross - (commNet + commTax)
        const difference = net - calculatedNet

        setDiff(difference)
        setIsValid(Math.abs(difference) < 1) // Tolerance of 1 peso
    }, [grossAmount, commissionNet, commissionTax, netDeposit])


    const handleAutoCalculate = async () => {
        if (!paymentMethodId || !date) {
            toast.error("Seleccione terminal y fecha")
            return
        }

        const dateStr = format(date, "yyyy-MM-dd")
        setLoading(true)
        try {
            // Fetch sales for this day/terminal
            // This endpoint might need to be created or use existing movements filter
            const res = await api.get(`/treasury/movements/`, {
                params: {
                    payment_method_id: paymentMethodId,
                    date: dateStr,
                    movement_type: 'INBOUND',
                    is_batch_pending: true // Filter for not yet batched
                }
            })

            const movements = res.data.results || res.data
            const total = movements.reduce((sum: number, m: any) => sum + parseFloat(m.amount), 0)

            setGrossAmount(total.toString())
            toast.success(`Ventas encontradas: $${total}`)

        } catch (error) {
            toast.error("Error al obtener ventas")
        } finally {
            setLoading(false)
        }
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
                payment_method_id: paymentMethodId,
                sales_date: date ? format(date, "yyyy-MM-dd") : null,
                gross_amount: parseFloat(grossAmount),
                commission_base: parseFloat(commissionNet),
                commission_tax: parseFloat(commissionTax),
                net_amount: parseFloat(netDeposit),
                terminal_reference: reference
            }

            await api.post('/treasury/terminal-batches/create_batch/', payload)
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
                            className="font-bold"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="grid gap-2">
                            <Label className="text-xs">Comisión Neta</Label>
                            <Input
                                type="number"
                                step="1"
                                value={commissionNet}
                                onChange={e => setCommissionNet(e.target.value)}
                                className="text-right"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label className="text-xs">IVA Comisión</Label>
                            <Input
                                type="number"
                                step="1"
                                value={commissionTax}
                                onChange={e => setCommissionTax(e.target.value)}
                                className="text-right"
                            />
                        </div>
                    </div>

                    <div className="grid gap-2 pt-2 border-t border-dashed border-gray-300">
                        <Label className="text-emerald-700 font-bold">Monto Neto a Depositar</Label>
                        <Input
                            type="number"
                            step="1"
                            value={netDeposit}
                            onChange={e => setNetDeposit(e.target.value)}
                            className={cn(
                                "font-bold text-lg text-right",
                                isValid ? "text-emerald-600 border-emerald-200 bg-emerald-50" : "text-destructive border-destructive/50 bg-destructive/10"
                            )}
                        />
                        {!isValid && (
                            <p className="text-[10px] text-destructive text-right font-medium">
                                Diferencia: {diff > 0 ? '+' : ''}{diff} (Revisar montos)
                            </p>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
                <Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button>
                <Button type="submit" disabled={loading || !isValid}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Registrar Liquidación
                </Button>
            </div>
        </form>
    )
}
