"use client"

import { useState, useEffect, useRef } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { ActionSlideButton, Drawer } from '@/components/shared'
import {
    Form,
    FormField,
} from "@/components/ui/form"
import { settingsApi } from "../hooks"
import { showApiError } from "@/lib/errors"
import { toast } from "sonner"
import { MonitorSmartphone } from "lucide-react"
import * as LucideIcons from "lucide-react"
import { CancelButton, LabeledInput, LabeledSelect, LabeledCheckboxGroup, FormSection, FormFooter, FormSplitLayout, SkeletonShell } from "@/components/shared"
import { formDrawerWidth } from "@/lib/form-widths"

import { ActivitySidebar } from "@/features/audit/components"
import { Printer } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useReactToPrint } from "react-to-print"
import { PrintableLayout } from "@/features/_shared/transaction-drawer"
import { useDrawerIdentity, type DrawerMode } from "@/features/_shared/drawer"

export interface Terminal {
    id: number
    name: string
    code: string
    location: string
    is_active: boolean
    default_treasury_account: number | null
    default_treasury_account_name?: string
    default_treasury_account_code?: string
    allowed_treasury_accounts: TreasuryAccount[]
    allowed_payment_methods: string[]
    serial_number: string
    ip_address: string | null
    created_at?: string
    updated_at?: string
}

export interface TreasuryAccount {
    id: number
    name: string
    code: string
    account_type: string
    allows_cash: boolean
    allows_card: boolean
    allows_transfer: boolean
}

interface TerminalDrawerProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    terminal: Terminal | null
    onSuccess: () => void
    mode?: DrawerMode
}

const formSchema = z.object({
    name: z.string().min(1, "El nombre es requerido"),
    code: z.string().min(1, "El código es requerido"),
    location: z.string().optional(),
    serial_number: z.string().optional(),
    ip_address: z.string().optional(),
    allowed_treasury_account_ids: z.array(z.number()),
    default_treasury_account: z.string().optional().nullable(),
})

type FormValues = z.infer<typeof formSchema>

export function TerminalDrawer({ open, onOpenChange, terminal, onSuccess, mode: modeProp }: TerminalDrawerProps) {
    const [loading, setLoading] = useState(false)
    const [isFetchingDeps, setIsFetchingDeps] = useState(false)
    const [treasuryAccounts, setTreasuryAccounts] = useState<TreasuryAccount[]>([])

    const mode: DrawerMode = modeProp ?? (terminal ? 'edit' : 'create')
    const isView = mode === 'view'
    const printRef = useRef<HTMLDivElement>(null)
    const handlePrint = useReactToPrint({ contentRef: printRef })

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: "",
            code: "",
            location: "",
            serial_number: "",
            ip_address: "",
            allowed_treasury_account_ids: [],
            default_treasury_account: "",
        },
    })

    const lastResetId = useRef<number | undefined>(undefined)
    const wasOpen = useRef(false)

    useEffect(() => {
        if (!open) {
            wasOpen.current = false
            return
        }

        const currentId = terminal?.id
        const isNewOpen = !wasOpen.current
        const isNewData = currentId !== lastResetId.current

        if (isNewOpen) {
            fetchTreasuryAccounts()
        }

        if (isNewOpen || isNewData) {
            if (terminal) {
                const allowedIds = terminal.allowed_treasury_accounts?.map(acc => acc.id) || []
                form.reset({
                    name: terminal.name || "",
                    code: terminal.code || "",
                    location: terminal.location || "",
                    serial_number: terminal.serial_number || "",
                    ip_address: terminal.ip_address || "",
                    allowed_treasury_account_ids: allowedIds,
                    default_treasury_account: terminal.default_treasury_account?.toString() || "",
                })
            } else {
                form.reset({
                    name: "",
                    code: "",
                    location: "",
                    serial_number: "",
                    ip_address: "",
                    allowed_treasury_account_ids: [],
                    default_treasury_account: "",
                })
            }
            lastResetId.current = currentId
            wasOpen.current = true
        }
    }, [open, terminal, form])

    const isFetchingInitialData = open && isFetchingDeps

    const fetchTreasuryAccounts = async () => {
        setIsFetchingDeps(true)
        try {
            const allAccounts = await settingsApi.getTreasuryAccounts()
            const validAccounts = allAccounts.filter((a: TreasuryAccount) =>
                a.allows_cash || a.allows_card || a.allows_transfer
            )
            setTreasuryAccounts(validAccounts)
        } catch (error) {
            showApiError(error, "Error al cargar cuentas de tesorería")
        } finally {
            setIsFetchingDeps(false)
        }
    }

    const toggleAccountSelection = (accountId: number, currentSelections: number[], onChange: (val: number[]) => void, defaultAccountValue: string | null | undefined, setDefaultAccount: (val: string) => void) => {
        const account = treasuryAccounts.find(a => a.id === accountId)
        const isSelected = currentSelections.includes(accountId)

        if (!isSelected) {
            if (account?.allows_cash) {
                const hasCashDetails = treasuryAccounts
                    .filter(a => currentSelections.includes(a.id) && a.allows_cash)

                if (hasCashDetails.length > 0) {
                    toast.warning("Solo se permite una cuenta de efectivo por terminal.")
                    return
                }
            }
            onChange([...currentSelections, accountId])
        } else {
            if (defaultAccountValue === accountId.toString()) {
                setDefaultAccount("")
            }
            onChange(currentSelections.filter(id => id !== accountId))
        }
    }

    const onSubmit = async (data: FormValues) => {
        if (data.allowed_treasury_account_ids.length === 0) {
            toast.error("Seleccione al menos una cuenta de tesorería")
            return
        }

        const cashAccountsCount = treasuryAccounts
            .filter(a => data.allowed_treasury_account_ids.includes(a.id) && a.allows_cash).length

        if (cashAccountsCount > 1) {
            toast.error("Solo puede haber una cuenta de Efectivo vinculada.")
            return
        }

        const payload = {
            name: data.name,
            code: data.code,
            location: data.location,
            allowed_treasury_account_ids: data.allowed_treasury_account_ids,
            default_treasury_account: (data.default_treasury_account && data.default_treasury_account !== "__none__") ? parseInt(data.default_treasury_account) : null,
            is_active: true
        }

        try {
            setLoading(true)
            if (terminal) {
                await settingsApi.updatePosTerminal(terminal.id, payload)
                toast.success("Terminal actualizado")
            } else {
                await settingsApi.createPosTerminal(payload)
                toast.success("Terminal creado")
            }
            onSuccess()
            onOpenChange(false)
        } catch (error: unknown) {
            showApiError(error, "Error al guardar terminal")
        } finally {
            setLoading(false)
        }
    }

    const identity = useDrawerIdentity('treasury.terminal', mode, terminal, {
        subtitle: (
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                {terminal?.code && (
                    <>
                        <span>{terminal.code}</span>
                        <span className="opacity-30">|</span>
                    </>
                )}
                <span>{form.watch("name") || "Configuración básica del TPV"}</span>
            </div>
        ),
    })

    return (
        <>
            {isView && terminal?.id && (
                <PrintableLayout ref={printRef} title="Terminal" displayId={`#${terminal.id}`}>
                    <div className="text-[9px] space-y-1 mb-2">
                        <div className="flex justify-between">
                            <span>Nombre:</span>
                            <span>{terminal.name ?? '-'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Código:</span>
                            <span>{terminal.code ?? '-'}</span>
                        </div>
                    </div>
                </PrintableLayout>
            )}
            <Drawer
                open={open}
                onOpenChange={onOpenChange}
                side="left"
                defaultSize={formDrawerWidth("complex", !!terminal)}
                mode={mode}
                title={identity.title}
                icon={identity.icon}
                headerActions={(mode === 'view' || mode === 'edit') && terminal?.id && (
                    <Button variant="ghost" size="icon" onClick={() => handlePrint()}>
                        <Printer className="h-4 w-4" />
                    </Button>
                )}
                subtitle={identity.subtitle}
                footer={isView ? undefined : (
                    <FormFooter
                        actions={
                            <>
                                <CancelButton onClick={() => onOpenChange(false)} />
                                <ActionSlideButton type="submit" form="terminal-form" loading={loading}>
                                    {terminal ? "Guardar Cambios" : "Crear Terminal"}
                                </ActionSlideButton>
                            </>
                        }
                    />
                )}
            >
                <SkeletonShell isLoading={isFetchingInitialData} ariaLabel="Cargando formulario de terminal" className="flex-1 flex flex-col">
                    <FormSplitLayout
                        showSidebar={!!terminal?.id}
                        sidebar={
                            terminal?.id && (
                                <ActivitySidebar
                                    entityId={terminal.id}
                                    entityType="terminal"
                                />
                            )
                        }
                    >
                        <Form {...form}>
                            <form id="terminal-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 px-6 pb-6 pt-6">
                                <fieldset disabled={isView} className="contents">
                                    {/* Section 1: Device Identity */}
                                    <div className="space-y-4">
                                        <FormSection title="Identificación del Dispositivo" icon={MonitorSmartphone} />
                                        <div className="grid grid-cols-2 gap-4">
                                            <FormField
                                                control={form.control}
                                                name="name"
                                                render={({ field, fieldState }) => (
                                                    <LabeledInput
                                                        label="Nombre de Terminal"
                                                        placeholder="Ej: Caja Principal"
                                                        error={fieldState.error?.message}
                                                        required
                                                        {...field}
                                                    />
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="code"
                                                render={({ field, fieldState }) => (
                                                    <LabeledInput
                                                        label="Código"
                                                        placeholder="TERM-01"
                                                        className="uppercase"
                                                        error={fieldState.error?.message}
                                                        required
                                                        {...field}
                                                    />
                                                )}
                                            />
                                        </div>
                                    </div>

                                    {/* Section 2: Connectivity & Location */}
                                    <div className="space-y-4">
                                        <FormSection title="Conectividad y Ubicación" icon={LucideIcons.Wifi || MonitorSmartphone} />
                                        <div className="grid grid-cols-2 gap-4">
                                            <FormField
                                                control={form.control}
                                                name="serial_number"
                                                render={({ field, fieldState }) => (
                                                    <LabeledInput
                                                        label="N° Serie / Hardware"
                                                        placeholder="SN-XXXX"
                                                        error={fieldState.error?.message}
                                                        {...field}
                                                    />
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="ip_address"
                                                render={({ field, fieldState }) => (
                                                    <LabeledInput
                                                        label="IP / Dirección de Red"
                                                        placeholder="192.168.1.XX"
                                                        error={fieldState.error?.message}
                                                        {...field}
                                                    />
                                                )}
                                            />
                                            <div className="col-span-2">
                                                <FormField
                                                    control={form.control}
                                                    name="location"
                                                    render={({ field, fieldState }) => (
                                                        <LabeledInput
                                                            label="Ubicación Física"
                                                            placeholder="Ej: Entrada Principal, Piso 1"
                                                            error={fieldState.error?.message}
                                                            {...field}
                                                        />
                                                    )}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Section 3: Treasury Accounts */}
                                    <div className="space-y-4">
                                        <FormSection title="Tesorería y Cuentas" icon={LucideIcons.Library || MonitorSmartphone} />

                                        <FormField
                                            control={form.control}
                                            name="allowed_treasury_account_ids"
                                            render={({ field }) => {
                                                const handleChange = (newValue: (string | number)[]) => {
                                                    const oldSet = new Set<string | number>(field.value || [])
                                                    for (const id of newValue) {
                                                        if (!oldSet.has(id)) {
                                                            const account = treasuryAccounts.find(a => a.id === id)
                                                            if (account?.allows_cash) {
                                                                const hasCash = (field.value || []).some((selectedId: number) =>
                                                                    treasuryAccounts.find(a => a.id === selectedId)?.allows_cash
                                                                )
                                                                if (hasCash) {
                                                                    toast.warning("Solo se permite una cuenta de efectivo por terminal.")
                                                                    return
                                                                }
                                                            }
                                                        }
                                                    }
                                                    const removed = (field.value || []).filter((id) => !newValue.includes(id))
                                                    for (const id of removed) {
                                                        if (form.getValues("default_treasury_account") === String(id)) {
                                                            form.setValue("default_treasury_account", "")
                                                        }
                                                    }
                                                    field.onChange(newValue)
                                                }
                                                return (
                                                    <LabeledCheckboxGroup
                                                        label="Cuentas Permitidas"
                                                        items={treasuryAccounts.map((acc) => ({
                                                            value: acc.id,
                                                            label: acc.name,
                                                            suffix: (
                                                                <div className="flex gap-1.5">
                                                                    {acc.allows_cash && <span className="text-[10px] font-black text-success uppercase tracking-widest">Efectivo</span>}
                                                                    {acc.allows_card && <span className="text-[10px] font-bold text-primary uppercase tracking-tighter">Tarjeta</span>}
                                                                    {acc.allows_transfer && <span className="text-[10px] font-bold text-primary/60 uppercase tracking-tighter">Transf</span>}
                                                                </div>
                                                            ),
                                                        }))}
                                                        value={field.value || []}
                                                        onChange={handleChange}
                                                        suffix={
                                                            <span className="px-1.5 py-0.5 rounded-full bg-muted/50 text-[9px] font-mono font-black text-muted-foreground uppercase">
                                                                {field.value.length} SELECCIONADAS
                                                            </span>
                                                        }
                                                    />
                                                )
                                            }}
                                        />

                                        {form.watch("allowed_treasury_account_ids").length > 0 && (
                                            <FormField
                                                control={form.control}
                                                name="default_treasury_account"
                                                render={({ field, fieldState }) => (
                                                    <LabeledSelect
                                                        label="Cuenta Predeterminada (Apertura de Sesión)"
                                                        error={fieldState.error?.message}
                                                        onChange={field.onChange}
                                                        value={field.value || ""}
                                                        placeholder="Seleccionar..."
                                                        options={[
                                                            { value: "__none__", label: "-- Ninguna (Solicitar al iniciar) --" },
                                                            ...treasuryAccounts
                                                                .filter(acc => form.watch("allowed_treasury_account_ids").includes(acc.id))
                                                                .map(acc => ({ value: acc.id.toString(), label: acc.name })),
                                                        ]}
                                                    />
                                                )}
                                            />
                                        )}
                                    </div>
                                </fieldset>
                            </form>
                        </Form>
                    </FormSplitLayout>
                </SkeletonShell>
            </Drawer>
        </>
    )
}
