"use client"
import { formatCurrency } from "@/lib/money"

import {useState, useEffect, useMemo} from "react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { useServerDate } from "@/hooks/useServerDate"
import { Button } from "@/components/ui/button"
import { EmptyState, LabeledSelect } from '@/components/shared'
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { Calculator, Search, ChevronDown, Check, MousePointerClick, Landmark } from "lucide-react"
import { DateRangeFilter } from "@/components/shared"
import { toast } from "sonner"
import { DateRange } from "react-day-picker"

import { useVatRate } from '@/hooks/useVatRate'
import { useTerminalProviders, usePaymentMethods, useTerminalMovements, useTerminalBatchMutations } from "@/features/treasury"

import { Drawer, ActionSlideButton, CancelButton, SubmitButton, LabeledContainer, LabeledInput, LabeledCheckboxGroup, FormFooter, FormSection, SkeletonShell } from "@/components/shared"

const terminalBatchSchema = z.object({
    providerId: z.string().min(1, "Seleccione un proveedor"),
    depositMethodId: z.string().min(1, "Seleccione un método de depósito"),
    dateRange: z.object({
        from: z.date(),
        to: z.date().optional(),
    }).optional(),
    grossAmount: z.string(),
    commissionNet: z.string(),
    commissionTax: z.string(),
    reference: z.string().optional(),
})

type TerminalBatchFormValues = z.infer<typeof terminalBatchSchema>

interface TerminalBatchFormProps {
    onSuccess: () => void
    onCancel: () => void
}

export function TerminalBatchForm({ onSuccess, onCancel }: TerminalBatchFormProps) {
    const { providers, isLoading: isProvidersLoading } = useTerminalProviders()
    const { methods, isLoading: isMethodsLoading } = usePaymentMethods()
    const { createBatch, isCreating } = useTerminalBatchMutations()
    const { serverDate, isLoading: isServerDateLoading } = useServerDate()
    const { rate } = useVatRate()
    const isFetchingInitialData = isProvidersLoading || isMethodsLoading || isServerDateLoading

    const form = useForm<TerminalBatchFormValues>({
        resolver: zodResolver(terminalBatchSchema),
        defaultValues: {
            providerId: "",
            depositMethodId: "",
            dateRange: undefined,
            grossAmount: "0",
            commissionNet: "0",
            commissionTax: "0",
            reference: "",
        }
    })

    const providerId = form.watch("providerId")
    const depositMethodId = form.watch("depositMethodId")
    const dateRange = form.watch("dateRange")
    const grossAmount = form.watch("grossAmount")
    const commissionNet = form.watch("commissionNet")
    const commissionTax = form.watch("commissionTax")

    const [selectedMovements, setSelectedMovements] = useState<any[]>([])
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
    const [openSelection, setOpenSelection] = useState(false)

    useEffect(() => {
        if (serverDate && !form.getValues("dateRange")) {
            requestAnimationFrame(() => {
                form.setValue("dateRange", { from: serverDate, to: serverDate })
            })
        }
    }, [serverDate, form])

    const gross = parseFloat(grossAmount) || 0
    const cNet = parseFloat(commissionNet) || 0
    const cTax = parseFloat(commissionTax) || 0

    const calculatedNet = Math.round(gross - (cNet + cTax))
    const netDeposit = calculatedNet.toString()
    const isValid = gross > 0 && calculatedNet >= 0

    const handleAutoCalculate = () => {
        if (!providerId || !dateRange?.from) {
            toast.error("Seleccione proveedor y fecha")
            return
        }
        setOpenSelection(true)
    }

    const onSubmit = async (values: TerminalBatchFormValues) => {
        if (!isValid) {
            toast.error("Los montos no cuadran")
            return
        }

        try {
            await createBatch({
                provider: values.providerId,
                payment_method: values.depositMethodId,
                sales_date: values.dateRange?.from ? format(values.dateRange.from, "yyyy-MM-dd") : null,
                sales_date_end: values.dateRange?.to ? format(values.dateRange.to, "yyyy-MM-dd") : null,
                gross_amount: parseFloat(values.grossAmount),
                commission_base: parseFloat(values.commissionNet),
                commission_tax: parseFloat(values.commissionTax),
                net_amount: parseFloat(netDeposit),
                terminal_reference: values.reference || "",
                movement_ids: selectedMovements.map(m => m.id)
            })
            onSuccess()
        } catch {
            // Error handled by hook
        }
    }

    return (
        <SkeletonShell isLoading={isFetchingInitialData} ariaLabel="Cargando formulario de liquidación de lote">
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-4">
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
                                                            form.setValue("providerId", p.id.toString())
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
                                <Controller
                                    name="dateRange"
                                    control={form.control}
                                    render={({ field }) => (
                                        <DateRangeFilter
                                            date={field.value}
                                            onDateChange={(d) => field.onChange(d)}
                                            variant="ghost"
                                        />
                                    )}
                                />
                            </LabeledContainer>

                            <LabeledSelect
                                label="Método de Depósito (Hacia Banco)"
                                value={depositMethodId}
                                onChange={(val) => form.setValue("depositMethodId", val)}
                                placeholder="Seleccione método de abono..."
                                options={methods
                                    .filter(m => m.allow_for_sales && m.method_type !== 'CARD_TERMINAL')
                                    .map(meth => ({ value: meth.id.toString(), label: meth.name }))}
                            />

                            <LabeledInput
                                label="N° Lote / Referencia (Opcional)"
                                value={form.watch("reference")}
                                onChange={e => form.setValue("reference", e.target.value)}
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
                                <div className="border border-none rounded-md p-2 bg-transparent flex flex-col items-center justify-center h-[280px]">
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
                                        disabled={true}
                                        className="font-bold bg-muted"
                                        hint={
                                            <div className="flex items-center gap-1.5 text-foreground font-medium">
                                                <span>{selectedMovements.length} ventas vinculadas</span>
                                                <span className="text-muted-foreground/30">•</span>
                                                <Button
                                                    type="button"
                                                    variant="link"
                                                    onClick={handleAutoCalculate}
                                                    className="text-primary hover:underline font-bold transition-all p-0 h-auto"
                                                >
                                                    Modificar Ventas
                                                </Button>
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
                                                form.setValue("commissionNet", val)
                                                const net = parseFloat(val) || 0
                                                form.setValue("commissionTax", Math.round(net * (rate / 100)).toString())
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
                            <ActionSlideButton type="submit" loading={isCreating} disabled={isCreating || !isValid || !providerId || !depositMethodId}>
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
                        form.setValue("grossAmount", total.toString())
                        setOpenSelection(false)
                    }}
                />
            </form>
        </SkeletonShell>
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
    const { data: page, isLoading: loading } = useTerminalMovements(providerId, dateRange, open)
    const rawMovements = page?.results ?? []
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())

    // Sort: Prioritize selected dates, then by date descending
    const movements = useMemo(() => {
        const dateFromStr = dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : null;
        const dateToStr = dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : dateFromStr;

        const isDateInRange = (date: string) => {
            if (!dateFromStr || !dateToStr) return false;
            return date >= dateFromStr && date <= dateToStr;
        };

        return [...rawMovements].sort((a: any, b: any) => {
            const aInRange = isDateInRange(a.date);
            const bInRange = isDateInRange(b.date);
            if (aInRange && !bInRange) return -1
            if (!aInRange && bInRange) return 1
            return b.date.localeCompare(a.date)
        })
    }, [rawMovements, dateRange])

    // Auto-select when movements load
    useEffect(() => {
        if (!open || !movements.length) return
        const dateFromStr = dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : null;
        const dateToStr = dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : dateFromStr;

        const isDateInRange = (date: string) => {
            if (!dateFromStr || !dateToStr) return false;
            return date >= dateFromStr && date <= dateToStr;
        };

        const next = new Set<number>()
        if (initialSelectedIds.size === 0) {
            movements.forEach((m: any) => {
                if (isDateInRange(m.date)) next.add(m.id)
            })
        } else {
            initialSelectedIds.forEach(id => {
                if (movements.some((m: any) => m.id === id)) next.add(id)
            })
        }
        requestAnimationFrame(() => setSelectedIds(next))
    }, [open, movements, initialSelectedIds, dateRange])

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
        .reduce((sum, m) => sum + m.amount, 0)

    return (
        <Drawer
            open={open}
            onOpenChange={onOpenChange}
            side="left"
            title="Seleccionar Ventas a Liquidar"
            subtitle="Seleccione las transacciones que el proveedor incluyó en esta liquidación."
            defaultSize="50%"
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
            <SkeletonShell isLoading={loading} ariaLabel="Cargando ventas del proveedor">
                <LabeledCheckboxGroup
                    label="Movimientos Pendientes"
                    items={movements.map((m: any) => ({
                        value: m.id,
                        label: m.reference || 'Sin referencia',
                        description: `${m.partner_name || 'Particular'} • ${format(new Date(m.date + 'T12:00:00'), "dd/MM/yyyy")}`,
                        suffix: <span className="text-sm font-black">{formatCurrency(m.amount)}</span>,
                    }))}
                    value={Array.from(selectedIds)}
                    onChange={(newValue) => setSelectedIds(new Set(newValue.map(Number)))}
                    selectAll
                    selectAllLabel={`Seleccionar Todas (${movements.length})`}
                    footer={
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-bold">Total Seleccionado</span>
                            <span className="text-sm font-black text-income">{formatCurrency(totalSelected)}</span>
                        </div>
                    }
                    maxHeight="300px"
                />
            </SkeletonShell>
        </Drawer>
    )
}

export default TerminalBatchForm
