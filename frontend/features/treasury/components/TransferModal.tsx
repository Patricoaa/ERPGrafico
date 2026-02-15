"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format } from "date-fns"
import { CalendarIcon, ArrowRight, Landmark, Banknote, ArrowLeftRight } from "lucide-react"
import { cn, formatCurrency } from "@/lib/utils"
import api from "@/lib/api"
import { toast } from "sonner"
import { useServerDate } from "@/hooks/useServerDate"

interface TreasuryAccount {
    id: number
    name: string
    account_type: 'BANK' | 'CASH'
    current_balance: number
}

interface TransferModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess?: () => void
}

export function TransferModal({ open, onOpenChange, onSuccess }: TransferModalProps) {
    const [accounts, setAccounts] = useState<TreasuryAccount[]>([])
    const [loading, setLoading] = useState(false)
    const [submitting, setSubmitting] = useState(false)

    // Form state
    const [fromAccount, setFromAccount] = useState<string>("")
    const [toAccount, setToAccount] = useState<string>("")
    const { serverDate } = useServerDate()
    const [amount, setAmount] = useState<string>("")
    const [date, setDate] = useState<Date | undefined>(undefined)
    const [notes, setNotes] = useState("")

    useEffect(() => {
        if (serverDate && !date) {
            setDate(serverDate)
        }
    }, [serverDate])

    useEffect(() => {
        if (open) {
            fetchAccounts()
        }
    }, [open])

    const fetchAccounts = async () => {
        try {
            setLoading(true)
            const response = await api.get('/treasury/accounts/')
            setAccounts(response.data)
        } catch (error) {
            toast.error("Error al cargar cuentas.")
        } finally {
            setLoading(false)
        }
    }

    const handleSubmit = async () => {
        if (!fromAccount || !toAccount || !amount || parseFloat(amount) <= 0) {
            toast.error("Por favor completa todos los campos requeridos.")
            return
        }

        if (fromAccount === toAccount) {
            toast.error("La cuenta de origen y destino no pueden ser la misma.")
            return
        }

        try {
            setSubmitting(true)
            await api.post('/treasury/dashboard/register_transfer/', {
                from_account_id: fromAccount,
                to_account_id: toAccount,
                amount: parseFloat(amount),
                notes,
                date: date ? format(date, "yyyy-MM-dd'T'HH:mm:ss") : undefined
            })

            toast.success("Traspaso registrado correctamente.")
            onOpenChange(false)
            if (onSuccess) onSuccess()

            // Reset form
            setFromAccount("")
            setToAccount("")
            setAmount("")
            setNotes("")
        } catch (error: any) {
            console.error(error)
            toast.error(error.response?.data?.error || "Error al registrar el traspaso.")
        } finally {
            setSubmitting(false)
        }
    }

    const sourceAccount = accounts.find(a => a.id.toString() === fromAccount)
    const destAccount = accounts.find(a => a.id.toString() === toAccount)

    return (
        /* Using simplified Dialog-like structure with Card/Overlay if Radix Dialog is not directly available 
           but based on other files, Dialog should work. Assuming it works. */
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden rounded-2xl border-none shadow-2xl">
                <DialogHeader className="p-6 bg-slate-900 text-white">
                    <DialogTitle className="text-xl font-black tracking-tight flex items-center gap-2">
                        <ArrowLeftRight className="h-5 w-5 text-amber-400" />
                        Traspaso entre Cuentas
                    </DialogTitle>
                </DialogHeader>

                <div className="p-6 space-y-6 bg-white dark:bg-slate-950">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase text-muted-foreground">Origen</Label>
                            <Select value={fromAccount} onValueChange={setFromAccount}>
                                <SelectTrigger className="h-12 border-2 hover:border-primary transition-all">
                                    <SelectValue placeholder="Seleccionar" />
                                </SelectTrigger>
                                <SelectContent>
                                    {accounts.map(acc => (
                                        <SelectItem key={acc.id} value={acc.id.toString()}>
                                            <div className="flex items-center gap-2">
                                                {acc.account_type === 'BANK' ? <Landmark className="h-3 w-3" /> : <Banknote className="h-3 w-3" />}
                                                <span>{acc.name}</span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {sourceAccount && (
                                <p className="text-[10px] text-muted-foreground px-1">
                                    Disponible: <span className="font-bold">{formatCurrency(sourceAccount.current_balance)}</span>
                                </p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase text-muted-foreground">Destino</Label>
                            <Select value={toAccount} onValueChange={setToAccount}>
                                <SelectTrigger className="h-12 border-2 hover:border-primary transition-all">
                                    <SelectValue placeholder="Seleccionar" />
                                </SelectTrigger>
                                <SelectContent>
                                    {accounts.map(acc => (
                                        <SelectItem key={acc.id} value={acc.id.toString()}>
                                            <div className="flex items-center gap-2">
                                                {acc.account_type === 'BANK' ? <Landmark className="h-3 w-3" /> : <Banknote className="h-3 w-3" />}
                                                <span>{acc.name}</span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase text-muted-foreground">Monto del Traspaso</Label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-muted-foreground">$</span>
                            <Input
                                type="number"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                className="pl-8 h-12 text-lg font-black tracking-tight border-2"
                                placeholder="0"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase text-muted-foreground">Fecha</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant={"outline"}
                                        className={cn(
                                            "w-full h-12 justify-start text-left font-normal border-2",
                                            !date && "text-muted-foreground"
                                        )}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {date ? format(date, "PPP") : <span>Seleccionar</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        mode="single"
                                        selected={date}
                                        onSelect={(d) => d && setDate(d)}
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                        <div className="flex items-end pb-1">
                            {sourceAccount && destAccount && amount && (
                                <div className="p-2 rounded-lg bg-slate-50 border w-full text-center">
                                    <p className="text-[10px] text-muted-foreground uppercase leading-none">Nueva Estimación</p>
                                    <p className="text-xs font-bold text-amber-600">
                                        {formatCurrency(sourceAccount.current_balance - parseFloat(amount))}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase text-muted-foreground">Notas / Referencia</Label>
                        <Textarea
                            placeholder="Ej: Traspaso a cuenta corriente para pagos..."
                            className="text-xs border-2"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                        />
                    </div>
                </div>

                <DialogFooter className="p-6 bg-slate-50 dark:bg-slate-900/50 border-t">
                    <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={submitting || !amount || !fromAccount || !toAccount}
                        className="bg-amber-500 hover:bg-amber-600 text-white font-bold px-8 shadow-lg shadow-amber-500/20"
                    >
                        {submitting ? "Registrando..." : "Confirmar Traspaso"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
