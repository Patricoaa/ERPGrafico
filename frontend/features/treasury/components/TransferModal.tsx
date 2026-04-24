"use client"

import { showApiError } from "@/lib/errors"
import { useState, useEffect } from "react"
import { BaseModal, LabeledInput, LabeledSelect, LabeledContainer } from "@/components/shared"
import { SubmitButton, CancelButton } from "@/components/shared/ActionButtons"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { format } from "date-fns"
import { CalendarIcon, ArrowLeftRight, Landmark, Banknote } from "lucide-react"
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
            requestAnimationFrame(() => setDate(serverDate))
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
        } catch (error: unknown) {
            console.error(error)
            showApiError(error, "Error al registrar el traspaso.")
        } finally {
            setSubmitting(false)
        }
    }

    const sourceAccount = accounts.find(a => a.id.toString() === fromAccount)
    const destAccount = accounts.find(a => a.id.toString() === toAccount)

    const footerContent = (
        <div className="flex w-full gap-2 justify-end">
            <CancelButton onClick={() => onOpenChange(false)} disabled={submitting} />
            <SubmitButton
                loading={submitting}
                onClick={handleSubmit}
                disabled={submitting || !amount || !fromAccount || !toAccount}
                className="bg-warning hover:bg-warning/90 text-warning-foreground font-bold px-8 shadow-lg shadow-warning/20"
            >
                Confirmar Traspaso
            </SubmitButton>
        </div>
    )

    return (
        <BaseModal
            open={open}
            onOpenChange={onOpenChange}
            variant="transaction"
            title={
                <span className="flex items-center gap-2">
                    <ArrowLeftRight className="h-5 w-5 opacity-80" />
                    Traspaso entre Cuentas
                </span>
            }
            footer={footerContent}
            className="max-w-lg rounded-lg"
            contentClassName="bg-card p-6"
        >
            <div className="space-y-6 pt-4">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <LabeledSelect
                            label="Origen"
                            value={fromAccount}
                            onChange={setFromAccount}
                            placeholder="Seleccionar"
                            options={accounts.map(acc => ({
                                value: acc.id.toString(),
                                label: (
                                    <div className="flex items-center gap-2">
                                        {acc.account_type === 'BANK' ? <Landmark className="h-3 w-3" /> : <Banknote className="h-3 w-3" />}
                                        <span>{acc.name}</span>
                                    </div>
                                )
                            }))}
                        />
                        {sourceAccount && (
                            <p className="text-[10px] text-muted-foreground px-1">
                                Disponible: <span className="font-bold">{formatCurrency(sourceAccount.current_balance)}</span>
                            </p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <LabeledSelect
                            label="Destino"
                            value={toAccount}
                            onChange={setToAccount}
                            placeholder="Seleccionar"
                            options={accounts.map(acc => ({
                                value: acc.id.toString(),
                                label: (
                                    <div className="flex items-center gap-2">
                                        {acc.account_type === 'BANK' ? <Landmark className="h-3 w-3" /> : <Banknote className="h-3 w-3" />}
                                        <span>{acc.name}</span>
                                    </div>
                                )
                            }))}
                        />
                    </div>
                </div>

                <LabeledInput
                    label="Monto del Traspaso"
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    icon={<span className="font-bold text-muted-foreground">$</span>}
                    placeholder="0"
                    className="text-lg font-black tracking-tight"
                />

                <div className="grid grid-cols-2 gap-4">
                    <LabeledContainer label="Fecha" icon={<CalendarIcon className="h-4 w-4 opacity-50" />}>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant={"ghost"}
                                    className={cn(
                                        "w-full pl-3 text-left font-normal border-none shadow-none focus-visible:ring-0 bg-transparent hover:bg-transparent h-auto py-2",
                                        !date && "text-muted-foreground"
                                    )}
                                >
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
                    </LabeledContainer>

                    <div className="flex items-end pb-1">
                        {sourceAccount && destAccount && amount && (
                            <div className="p-2 rounded-lg bg-muted/30 border w-full text-center">
                                <p className="text-[10px] text-muted-foreground uppercase leading-none">Nueva Estimación</p>
                                <p className="text-xs font-bold text-warning">
                                    {formatCurrency(sourceAccount.current_balance - parseFloat(amount))}
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                <LabeledInput
                    label="Notas / Referencia"
                    as="textarea"
                    placeholder="Ej: Traspaso a cuenta corriente para pagos..."
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                />
            </div>
        </BaseModal>
    )
}

export default TransferModal
