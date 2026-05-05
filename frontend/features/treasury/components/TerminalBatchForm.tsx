"use client"

import { showApiError } from "@/lib/errors"
import { useState, useEffect } from "react"
import { useServerDate } from "@/hooks/useServerDate"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { LabeledSelect } from "@/components/shared"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { Loader2, Calculator, Info, Search, ChevronDown, Check, MousePointerClick, RefreshCcw, Landmark } from "lucide-react"
import { DateRangeFilter, PeriodValidationDateInput } from "@/components/shared"
import { toast } from "sonner"
import { DateRange } from "react-day-picker"
import { Checkbox } from "@/components/ui/checkbox"
import { BaseModal } from "@/components/shared/BaseModal"
import { ScrollArea } from "@/components/ui/scroll-area"
import api from "@/lib/api"
import { EmptyState } from "@/components/shared/EmptyState"
import { ActionSlideButton } from "@/components/shared/ActionSlideButton"
import { CancelButton, SubmitButton, LabeledContainer, LabeledInput, FormFooter, FormSection } from "@/components/shared"

interface TerminalBatchFormProps {
    onSuccess: () => void
    onCancel: () => void
}

export function TerminalBatchForm({ onSuccess, onCancel }: TerminalBatchFormProps) {
    const [loading, setLoading] = useState(false)
    const [providers, setProviders] = useState<any[]>([])
    const [paymentMethods, setPaymentMethods] = useState<any[]>([])

    // Form State
    const [providerId, setProviderId] = useState<string>("")
    const [depositMethodId, setDepositMethodId] = useState<string>("")
    const { serverDate } = useServerDate()
    const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined)
    const [isDateValid, setIsDateValid] = useState(true)

    // Sync state with server date when available and not yet set
    useEffect(() => {
        if (serverDate && !dateRange) {
            requestAnimationFrame(() => setDateRange({ from: serverDate, to: serverDate }))
        }
    }, [serverDate])
    const [grossAmount, setGrossAmount] = useState<string>("0")
    const [commissionNet, setCommissionNet] = useState<string>("0")
    const [commissionTax, setCommissionTax] = useState<string>("0")
    const [reference, setReference] = useState("")
    const [selectedMovements, setSelectedMovements] = useState<any[]>([])
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
    const [openSelection, setOpenSelection] = useState(false)

    // Load providers and deposit methods
    useEffect(() => {
        let isMounted = true
        const fetchData = async () => {
            try {
                const [provRes, methRes] = await Promise.all([
                    api.get('/treasury/terminal-providers/'),
                    api.get('/treasury/payment-methods/')
                ])
                if (isMounted) {
                    requestAnimationFrame(() => {
                        setProviders(provRes.data.results || provRes.data)
                        setPaymentMethods(methRes.data.results || methRes.data)
                    })
                }
            } catch (error) {
                if (isMounted) toast.error("Error al cargar datos")
            }
        }
        requestAnimationFrame(() => fetchData())
        return () => { isMounted = false }
    }, [])

    // Derived values for real-time validation
    const gross = parseFloat(grossAmount) || 0
    const cNet = parseFloat(commissionNet) || 0
    const cTax = parseFloat(commissionTax) || 0

    const calculatedNet = Math.round(gross - (cNet + cTax))
    const netDeposit = calculatedNet.toString()
    const isValid = gross > 0 && calculatedNet >= 0


    const handleAutoCalculate = async () => {
        if (!providerId || !dateRange?.from) {
            toast.error("Seleccione proveedor y fecha")
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
                provider: providerId,
                payment_method: depositMethodId,
                sales_date: dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : null,
                sales_date_end: dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : null,
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
        } catch (error: unknown) {
            showApiError(error, "Error al registrar")
        } finally {
            setLoading(false)
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6 py-4">
            <div className="grid grid-cols-2 gap-8">
                <div className="space-y-6">
                    <FormSection title="Configuración de Lote" icon={Landmark} className="pt-0" />

                    <div className="space-y-4">
                        <LabeledContainer label="Proveedor de Pago">
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        className="w-full justify-between font-normal text-sm h-[1.5rem] py-0 px-3 border-none shadow-none focus-visible:ring-0 bg-transparent hover:bg-transparent"
                                    >
                                        {providerId
                                            ? providers.find(p => p.id.toString() === providerId)?.name
                                            : "Seleccione proveedor..."}
                                        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                                    <div className="p-2">
                                        <div className="flex items-center px-3 border rounded-md mb-2 bg-background">
                                            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                                            <input
                                                className={cn("flex h-9 w-full rounded-md bg-transparent py-1 text-sm outline-none placeholder:text-muted-foreground")}
                                                placeholder="Buscar terminal..."
                                                onChange={(e) => {
                                                    const val = e.target.value.toLowerCase()
                                                    const items = document.querySelectorAll('.terminal-item')
                                                    items.forEach((el) => {
                                                        if (el.textContent?.toLowerCase().includes(val)) {
                                                            (el as HTMLElement).style.display = 'flex'
                                                        } else {
                                                            (el as HTMLElement).style.display = 'none'
                                                        }
                                                    })
                                                }}
                                            />
                                        </div>
                                        <div className="max-h-[200px] overflow-y-auto space-y-1">
                                            {providers.map((p) => (
                                                <div
                                                    key={p.id}
                                                    className={cn(
                                                        "terminal-item relative flex cursor-pointer select-none items-center rounded-sm px-2 py-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
                                                        providerId === p.id.toString() && "bg-accent"
                                                    )}
                                                    onClick={() => {
                                                        setProviderId(p.id.toString())
                                                        document.body.click()
                                                    }}
                                                >
                                                    <span>{p.name}</span>
                                                    {providerId === p.id.toString() && (
                                                        <Check className="ml-auto h-4 w-4 opacity-100" />
                                                    )}
                                                </div>
                                            ))}
                                            {providers.length === 0 && (
                                                <EmptyState context="generic" variant="minimal" description="No hay proveedores disponibles" />
                                            )}
                                        </div>
                                    </div>
                                </PopoverContent>
                            </Popover>
                        </LabeledContainer>

                        <LabeledContainer label="Fechas de Venta">
                            <DateRangeFilter
                                date={dateRange}
                                onDateChange={setDateRange}
                                className="w-full"
                            />
                        </LabeledContainer>

                        <LabeledSelect
                            label="Método de Depósito (Hacia Banco)"
                            value={depositMethodId}
                            onChange={setDepositMethodId}
                            placeholder="Seleccione método de abono..."
                            options={paymentMethods
                                .filter(m => m.allow_for_sales && m.method_type !== 'CARD_TERMINAL')
                                .map(meth => ({ value: meth.id.toString(), label: meth.name }))}
                        />

                        <LabeledInput
                            label="N° Lote / Referencia (Opcional)"
                            value={reference}
                            onChange={e => setReference(e.target.value)}
                            placeholder="Ej: LOTE-123456"
                        />
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="flex justify-between items-center h-8">
                        <FormSection title="Liquidación y Cálculos" icon={Calculator} className="flex-1 pt-0" />
                    </div>

                    <div className="space-y-4">
                        {selectedMovements.length === 0 ? (
                            <div className="border border-none rounded-xl p-2 bg-transparent flex flex-col items-center justify-center h-[280px]">
                                <EmptyState
                                    context="treasury"
                                    variant="compact"
                                    title="Pendiente de Selección"
                                    description={(!providerId || !dateRange?.from)
                                        ? "Seleccione proveedor y rango de fechas para cargar ventas."
                                        : "Vincule las ventas del terminal para calcular el lote automáticamente."
                                    }
                                    action={
                                        <ActionSlideButton
                                            type="button"
                                            onClick={handleAutoCalculate}
                                            disabled={!providerId || !dateRange?.from}
                                            icon={MousePointerClick}
                                            className="min-w-[200px]"
                                        >
                                            Vincular Ventas
                                        </ActionSlideButton>
                                    }
                                />
                            </div>
                        ) : (
                            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-500">
                                <LabeledInput
                                    label="Monto Bruto (Ventas)"
                                    type="number"
                                    step="1"
                                    value={grossAmount}
                                    onChange={e => setGrossAmount(e.target.value)}
                                    disabled={true}
                                    className="font-bold bg-muted"
                                    hint={
                                        <div className="flex items-center gap-1.5 text-foreground font-medium">
                                            <span>{selectedMovements.length} ventas vinculadas</span>
                                            <span className="text-muted-foreground/30">•</span>
                                            <button
                                                type="button"
                                                onClick={handleAutoCalculate}
                                                className="text-primary hover:underline font-bold transition-all"
                                            >
                                                Modificar Ventas
                                            </button>
                                        </div>
                                    }
                                />

                                <div className="grid grid-cols-2 gap-3">
                                    <LabeledInput
                                        label="Comisión Neta"
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
                                    <LabeledInput
                                        label="IVA Comisión"
                                        type="number"
                                        step="1"
                                        value={commissionTax}
                                        readOnly
                                        className="text-right bg-muted"
                                    />
                                </div>


                                <LabeledInput
                                    label="Monto Neto a Depositar"
                                    labelClassName="text-income font-bold"
                                    type="number"
                                    step="1"
                                    value={netDeposit}
                                    readOnly
                                    className="font-bold text-lg text-right text-income border-income/20 bg-income/5 cursor-not-allowed"
                                />
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <FormFooter
                actions={
                    <>
                        <CancelButton onClick={onCancel} />
                        <ActionSlideButton type="submit" loading={loading} disabled={loading || !isValid || !providerId || !depositMethodId || !isDateValid}>
                            Registrar Liquidación
                        </ActionSlideButton>
                    </>
                }
            />

            <SaleSelectionModal
                open={openSelection}
                onOpenChange={setOpenSelection}
                providerId={providerId}
                dateRange={dateRange}
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

function SaleSelectionModal({ open, onOpenChange, providerId, dateRange, onConfirm, initialSelectedIds }: {
    open: boolean,
    onOpenChange: (open: boolean) => void,
    providerId: string,
    dateRange: DateRange | undefined,
    onConfirm: (movements: any[], ids: Set<number>) => void,
    initialSelectedIds: Set<number>
}) {
    const [movements, setMovements] = useState<any[]>([])
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        let isMounted = true
        if (open && providerId && dateRange?.from) {
            requestAnimationFrame(() => {
                if (isMounted) setLoading(true)
            })

            const params: any = {
                terminal_provider: providerId,
                movement_type: 'INBOUND',
                terminal_batch__isnull: 'True'
            }

            if (dateRange?.from) {
                params.date_from = format(dateRange.from, "yyyy-MM-dd")
            }
            if (dateRange?.to) {
                params.date_to = format(dateRange.to, "yyyy-MM-dd")
            }

            api.get(`/treasury/movements/`, {
                params
            }).then((res: any) => {
                if (!isMounted) return
                const data = res.data.results || res.data

                // Sort: Prioritize selected dates, then by date descending
                const dateFromStr = dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : null;
                const dateToStr = dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : dateFromStr;

                const isDateInRange = (date: string) => {
                    if (!dateFromStr || !dateToStr) return false;
                    return date >= dateFromStr && date <= dateToStr;
                };

                const sorted = [...data].sort((a: any, b: any) => {
                    const aInRange = isDateInRange(a.date);
                    const bInRange = isDateInRange(b.date);
                    if (aInRange && !bInRange) return -1
                    if (!aInRange && bInRange) return 1
                    return b.date.localeCompare(a.date)
                })

                setMovements(sorted)
                requestAnimationFrame(() => {
                    // Initial auto-selection: only sales for the selected date range
                    const next = new Set<number>()
                    if (initialSelectedIds.size === 0) {
                        sorted.forEach((m: any) => {
                            if (isDateInRange(m.date)) next.add(m.id)
                        })
                    } else {
                        initialSelectedIds.forEach(id => {
                            if (sorted.some((m: any) => m.id === id)) next.add(id)
                        })
                    }
                    setSelectedIds(next)
                })
            }).finally(() => {
                if (isMounted) requestAnimationFrame(() => setLoading(false))
            })
        }
        return () => { isMounted = false }
    }, [open, providerId, dateRange])

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
        <BaseModal
            open={open}
            onOpenChange={onOpenChange}
            title="Seleccionar Ventas a Liquidar"
            description="Seleccione las transacciones que el proveedor incluyó en esta liquidación."
            className="sm:max-w-[600px]"
            footer={(
                <FormFooter
                    actions={
                        <>
                            <CancelButton onClick={() => onOpenChange(false)} />
                            <SubmitButton
                                onClick={() => onConfirm(movements.filter(m => selectedIds.has(m.id)), selectedIds)}
                                disabled={selectedIds.size === 0}
                                icon={null}
                            >
                                Confirmar Selección
                            </SubmitButton>
                        </>
                    }
                />
            )}
        >
            <div className="py-2">
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
                    <div className="text-sm font-black text-income">
                        Total: {new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP" }).format(totalSelected)}
                    </div>
                </div>

                <div className="h-[300px] border rounded-md relative overflow-hidden">
                    {loading ? (
                        <div className="flex items-center justify-center h-full">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : movements.length === 0 ? (
                        <div className="p-8">
                            <EmptyState
                                context="search"
                                variant="compact"
                                description="No se encontraron ventas pendientes para esta fecha."
                            />
                        </div>
                    ) : (
                        <ScrollArea className="h-full">
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
                        </ScrollArea>
                    )}
                </div>
            </div>
        </BaseModal>
    )
}

export default TerminalBatchForm
