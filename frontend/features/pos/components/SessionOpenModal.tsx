"use client"
import { useState, useEffect } from "react"
import { formatCurrency } from "@/lib/money"

import { showApiError } from "@/lib/errors"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

import {
    Loader2, Unlock,
    Users, AlertTriangle, Search, ChevronDown, Check, CheckCircle2
} from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { toast } from "sonner"
import { posApi } from "../api/posApi"
import { GenericWizard, Numpad, Chip, type WizardStep } from '@/components/shared'
import { TreasuryAccountSelector } from "@/components/selectors/TreasuryAccountSelector"
import { useTouchMode } from "@/hooks/useTouchMode"

import { cn } from "@/lib/utils"
import type { POSSession, POSTerminal, AccountingSettings, TreasuryAccount } from "@/types/pos"
import { DEFICIT_OPTIONS, SURPLUS_OPTIONS } from "@/features/pos/utils/reasons"

interface SessionOpenModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    /** Called after a session is opened (`mode: 'open'`) or joined (`mode: 'join'`) */
    onSuccess: (session: POSSession, mode: 'open' | 'join') => void
    onClose?: () => void
}

export function SessionOpenModal({
    open,
    onOpenChange,
    onSuccess,
    onClose
}: SessionOpenModalProps) {
    const { isTouchMode } = useTouchMode()

    const [terminals, setTerminals] = useState<POSTerminal[]>([])
    const [availableSessions, setAvailableSessions] = useState<POSSession[]>([])
    const [dataLoading, setDataLoading] = useState(false)

    // Open Session Wizard State
    const [mode, setMode] = useState<'open' | 'join'>('open')
    const [stepIndex, setStepIndex] = useState(0)
    const [currentStepIndex, setCurrentStepIndex] = useState(0)

    // Open session form state
    const [selectedTerminalId, setSelectedTerminalId] = useState<string>("")
    const [openingBalance, setOpeningBalance] = useState<string>("0")
    const [fundSourceId, setFundSourceId] = useState<string | null>(null)
    const [openingJustifyReason, setOpeningJustifyReason] = useState<string>("")
    const [openingJustifyTargetId, setOpeningJustifyTargetId] = useState<string | null>(null)
    const [accountingSettings, setAccountingSettings] = useState<AccountingSettings | null>(null)

    // Fund validation for session opening
    const [openingSelectedAccount, setOpeningSelectedAccount] = useState<TreasuryAccount | null>(null)
    const [openingInsufficientFunds, setOpeningInsufficientFunds] = useState(false)
    const [justifySearchTerm, setJustifySearchTerm] = useState("")
    const [openingJustifyOpen, setOpeningJustifyOpen] = useState(false)

    // Shared session selection
    const [selectedSharedSessionId, setSelectedSharedSessionId] = useState<string>("")

    const [submitting, setSubmitting] = useState(false)

    const freeTerminals = terminals.filter(t => !availableSessions.some(s => s.terminal === t.id))
    const needsTerminalSelection = freeTerminals.length > 1

    const selectedTerminal = terminals.find(t => t.id === parseInt(selectedTerminalId))
    const expectedBalance = selectedTerminal?.default_treasury_account_balance || 0
    const actualBalance = parseFloat(openingBalance) || 0
    const openingDiff = actualBalance - expectedBalance

    const canConfirm = !(openingDiff !== 0 && !openingJustifyReason)
        && !(openingJustifyReason === 'TRANSFER' && !openingJustifyTargetId)
        && !openingInsufficientFunds

    const fetchTerminals = async () => {
        try {
            const terminalsData = await posApi.getTerminals()
            const terminalsResponse = terminalsData as { results?: POSTerminal[] } | POSTerminal[]
            const results = Array.isArray(terminalsResponse) ? terminalsResponse : (terminalsResponse.results ?? [])
            setTerminals(results)
        } catch (error) {
            console.error("Error fetching terminals:", error)
            toast.error("Error al cargar puntos de venta")
        }
    }

    const fetchAvailableSessions = async () => {
        try {
            const sessionsData = await posApi.getSessions({ status: 'OPEN' })
            const sessionsResponse = sessionsData as { results?: POSSession[] } | POSSession[]
            const results = Array.isArray(sessionsResponse) ? sessionsResponse : (sessionsResponse.results ?? [])
            setAvailableSessions(results)
        } catch (error) {
            console.error("Error fetching available sessions:", error)
            toast.error("Error al cargar sesiones activas")
        }
    }

    const loadInitialData = () => {
        setDataLoading(true)
        Promise.all([
            fetchTerminals(),
            fetchAvailableSessions(),
        ]).finally(() => setDataLoading(false))
    }

    useEffect(() => {
        if (!open) return
        requestAnimationFrame(() => {
            setMode('open')
            setStepIndex(0)
            setCurrentStepIndex(0)
            setSelectedTerminalId("")
            setOpeningBalance("0")
            setFundSourceId(null)
            setOpeningJustifyReason("")
            setOpeningJustifyTargetId(null)
            setSelectedSharedSessionId("")
            setOpeningSelectedAccount(null)
            setOpeningInsufficientFunds(false)
            setJustifySearchTerm("")
            setOpeningJustifyOpen(false)
            loadInitialData()
            // Fetch accounting settings for justification logic
            posApi.getAccountingSettings()
                .then(data => requestAnimationFrame(() => setAccountingSettings(data)))
                .catch(err => console.error("Failed to load accounting settings", err))
        })
    }, [open])

    // Autofill Fund Source from Terminal Default (Keep balance at 0 as requested)
    useEffect(() => {
        if (open && selectedTerminalId) {
            const terminal = terminals.find(t => t.id === parseInt(selectedTerminalId))
            if (terminal?.default_treasury_account) {
                requestAnimationFrame(() => setFundSourceId(terminal.default_treasury_account.toString()))
            }
        }
    }, [open, selectedTerminalId, terminals])

    // Fetch selected account for transfer validation during opening
    useEffect(() => {
        if (openingJustifyReason === 'TRANSFER' && selectedTerminalId) {
            if (openingDiff < 0 && fundSourceId) {
                // Deficit: cash went TO target; check if POS treasury had enough to send
                posApi.getTreasuryAccount(Number(fundSourceId))
                    .then((data: TreasuryAccount) => {
                        requestAnimationFrame(() => {
                            setOpeningSelectedAccount(data)
                            if (data.current_balance !== undefined) {
                                const needed = Math.abs(openingDiff)
                                setOpeningInsufficientFunds(data.current_balance < needed)
                            } else {
                                setOpeningInsufficientFunds(false)
                            }
                        })
                    })
                    .catch(err => {
                        console.error("Failed to load treasury account", err)
                        requestAnimationFrame(() => {
                            setOpeningSelectedAccount(null)
                            setOpeningInsufficientFunds(false)
                        })
                    })
            } else if (openingDiff > 0 && openingJustifyTargetId) {
                // Surplus: cash came FROM target; check if that account had enough
                posApi.getTreasuryAccount(Number(openingJustifyTargetId))
                    .then((data: TreasuryAccount) => {
                        requestAnimationFrame(() => {
                            setOpeningSelectedAccount(data)
                            if (data.current_balance !== undefined) {
                                const needed = Math.abs(openingDiff)
                                setOpeningInsufficientFunds(data.current_balance < needed)
                            } else {
                                setOpeningInsufficientFunds(false)
                            }
                        })
                    })
                    .catch(err => {
                        console.error("Failed to load account", err)
                        requestAnimationFrame(() => {
                            setOpeningSelectedAccount(null)
                            setOpeningInsufficientFunds(false)
                        })
                    })
            } else {
                requestAnimationFrame(() => {
                    setOpeningSelectedAccount(null)
                    setOpeningInsufficientFunds(false)
                })
            }
        } else {
            requestAnimationFrame(() => {
                setOpeningSelectedAccount(null)
                setOpeningInsufficientFunds(false)
            })
        }
    }, [openingJustifyTargetId, openingJustifyReason, selectedTerminalId, openingDiff, fundSourceId])

    const handleOpenSession = async () => {
        if (!selectedTerminalId) {
            toast.error("Debe seleccionar un punto de venta")
            return
        }

        setSubmitting(true)
        try {
            const sessionData = await posApi.openSession({
                terminal_id: parseInt(selectedTerminalId),
                opening_balance: parseFloat(openingBalance),
                fund_source_id: fundSourceId ? parseInt(fundSourceId) : null,
                justify_reason: openingJustifyReason,
                justify_target_id: openingJustifyTargetId ? parseInt(openingJustifyTargetId) : null
            })

            onSuccess?.(sessionData, 'open')
            onOpenChange(false)
        } catch (error: unknown) {
            showApiError(error, "Error al iniciar sesión")
        } finally {
            setSubmitting(false)
        }
    }

    const handleJoinSession = async () => {
        if (!selectedSharedSessionId) {
            toast.error("Debe seleccionar una sesión")
            return
        }

        const foundSession = availableSessions.find(s => s.id === parseInt(selectedSharedSessionId))
        if (foundSession) {
            onSuccess?.(foundSession, 'join')
            onOpenChange(false)
        }
    }

    // Absolute step index for a given mode + step id (array shape is mode/terminal-count driven)
    const indexOf = (nextMode: 'open' | 'join', id: string): number => {
        if (nextMode === 'join') return id === 'join' ? 1 : 0
        if (id === 'mode') return 0
        if (id === 'terminal') return 1
        if (id === 'fund') return needsTerminalSelection ? 2 : 1
        return needsTerminalSelection ? 3 : 2 // confirm
    }

    const jumpTo = (nextMode: 'open' | 'join', id: string) => {
        setMode(nextMode)
        setStepIndex(indexOf(nextMode, id))
    }

    // Step 1: Mode Selection
    const modeStepContent = (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            {dataLoading ? (
                <>
                    <div className="text-center space-y-2 mb-6">
                        <h3 className="text-lg font-bold">Bienvenido al Punto de Venta</h3>
                    </div>
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        <span className="ml-3 text-sm text-muted-foreground">Cargando puntos de venta...</span>
                    </div>
                </>
            ) : (
                <>
                    <div className="text-center space-y-2 mb-6">
                        <h3 className="text-lg font-bold">Bienvenido al Punto de Venta</h3>
                        <p className="text-sm text-muted-foreground">¿Qué desea realizar hoy?</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Button
                            variant="outline"
                            className="h-20 flex flex-col items-center justify-center border-2 hover:border-success hover:bg-success/5 group"
                            onClick={() => {
                                // If only 1 terminal available, auto-select it and skip terminal selection
                                if (freeTerminals.length === 1) {
                                    setSelectedTerminalId(freeTerminals[0].id.toString())
                                    jumpTo('open', 'fund')
                                } else {
                                    jumpTo('open', 'terminal')
                                }
                            }}
                            disabled={freeTerminals.length === 0}
                        >
                            <Unlock className="h-6 w-6" />
                            <div className="text-center">
                                <span className="font-bold text-lg block">Abrir Punto de Venta</span>
                                <span className="text-xs text-muted-foreground">
                                    {freeTerminals.length} puntos de venta libres
                                </span>
                            </div>
                        </Button>

                        <Button
                            variant="outline"
                            className="h-32 flex flex-col items-center justify-center gap-3 border-2 hover:border-primary hover:bg-primary/10 group transition-all"
                            disabled={availableSessions.length === 0}
                            onClick={() => jumpTo('join', 'join')}
                        >
                            <Users className="h-6 w-6" />
                            <div className="text-center">
                                <span className="font-bold text-lg block">Unirse a Punto de Venta</span>
                                <span className="text-xs text-muted-foreground">
                                    {availableSessions.length > 0
                                        ? `${availableSessions.length} puntos de venta activos`
                                        : "No hay puntos de venta activos"}
                                </span>
                            </div>
                        </Button>
                    </div>
                </>
            )}
        </div>
    )

    // Step 2: Terminal Selection
    const terminalStepContent = freeTerminals.length === 0 ? (
        <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="text-center mb-4">
                <h3 className="font-bold">Seleccione Punto de Venta</h3>
            </div>
            <div className="flex flex-col items-center justify-center py-8 gap-3 text-center">
                <AlertTriangle className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No hay puntos de venta disponibles</p>
                <p className="text-xs text-muted-foreground">
                    Todos los puntos de venta están ocupados o no se pudieron cargar.
                </p>
                <Button variant="outline" size="sm" onClick={loadInitialData}>
                    Reintentar
                </Button>
            </div>
        </div>
    ) : (
        <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="text-center mb-4">
                <h3 className="font-bold">Seleccione Punto de Venta</h3>
            </div>
            <div className="grid gap-2 max-h-[300px] overflow-y-auto">
                {freeTerminals.map(t => (
                    <Button
                        key={t.id}
                        variant={selectedTerminalId === t.id.toString() ? "default" : "outline"}
                        className={cn(
                            "justify-start h-auto py-3 px-4",
                            selectedTerminalId === t.id.toString() && "border-primary"
                        )}
                        onClick={() => {
                            setSelectedTerminalId(t.id.toString())
                            jumpTo('open', 'fund') // Auto advance on selection
                        }}
                    >
                        <div className="text-left">
                            <div className="font-bold">{t.name}</div>
                            <div className="text-xs opacity-70">{t.location}</div>
                        </div>
                        {t.default_treasury_account_balance > 0 && (
                            <Chip size="xs" intent="neutral" className="ml-auto">
                                Base: {formatCurrency(t.default_treasury_account_balance)}
                            </Chip>
                        )}
                    </Button>
                ))}
            </div>
        </div>
    )

    // Step 3: Initial Fund (Numpad)
    const fundStepContent = (
        <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="text-center space-y-1">
                <h3 className="font-bold text-lg">{selectedTerminal?.name}</h3>
                <p className="text-sm text-muted-foreground">Ingrese el fondo inicial</p>
            </div>

            <div className="flex justify-center">
                <div className="w-full max-w-sm bg-muted/30 p-4 rounded-md">
                    <Numpad
                        value={openingBalance}
                        onChange={setOpeningBalance}
                        title="Monto Ingresado"
                        displayValue={formatCurrency(parseFloat(openingBalance) || 0)}
                        allowDecimal={true}
                        className="w-full max-w-full shadow-none border-0 p-0"
                        onConfirm={() => jumpTo('open', 'confirm')}
                        confirmLabel="Continuar"
                        onExactAmount={
                            (selectedTerminal && selectedTerminal.default_treasury_account_balance > 0)
                                ? () => setOpeningBalance(selectedTerminal.default_treasury_account_balance.toString())
                                : undefined
                        }
                        exactAmountLabel={
                            (selectedTerminal && selectedTerminal.default_treasury_account_balance > 0)
                                ? `Base: ${formatCurrency(selectedTerminal.default_treasury_account_balance)}`
                                : undefined
                        }
                    />
                </div>
            </div>
        </div>
    )

    // Step 4: Confirmation & Justification
    const confirmStepContent = (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="text-center">
                <Unlock className="h-6 w-6 text-muted-foreground" />
                <h3 className="font-bold text-xl">Confirmar Apertura</h3>
                <p className="text-muted-foreground">{selectedTerminal?.name}</p>
            </div>

            <div className="bg-card border rounded-md p-4 space-y-3 shadow-card">
                <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Fondo en Sistema:</span>
                    <span className="font-medium">{formatCurrency(expectedBalance)}</span>
                </div>
                <div className="flex justify-between items-center text-lg font-bold border-t pt-2">
                    <span>Fondo Contado:</span>
                    <span className="text-primary">{formatCurrency(actualBalance)}</span>
                </div>
            </div>

            {(() => {
                const reasons = openingDiff < 0
                    ? (() => {
                        let opts = [...DEFICIT_OPTIONS]
                        if (!accountingSettings?.pos_partner_withdrawal_account) opts = opts.filter(o => o.value !== 'PARTNER_WITHDRAWAL')
                        if (!accountingSettings?.pos_theft_account) opts = opts.filter(o => o.value !== 'THEFT')
                        return opts
                    })()
                    : [...SURPLUS_OPTIONS]

                const selectedLabel = reasons.find(r => r.value === openingJustifyReason)?.label

                return openingDiff !== 0 && (
                    <div className="bg-warning/10 border border-warning/20 rounded-md p-4 space-y-3">
                        <div className="flex items-center gap-2 text-warning font-bold">
                            <AlertTriangle className="h-4 w-4" />
                            <span>Se detectó una diferencia</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span>{openingDiff > 0 ? "Sobrante" : "Faltante"}:</span>
                            <span className="font-bold">{formatCurrency(Math.abs(openingDiff))}</span>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs">Motivo (Requerido)</Label>
                            <Popover open={openingJustifyOpen} onOpenChange={(open) => { setOpeningJustifyOpen(open); if (!open) setJustifySearchTerm("") }}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        className="w-full justify-between h-9 bg-background font-normal"
                                    >
                                        {selectedLabel || "Seleccione motivo..."}
                                        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                                    <div className="p-2">
                                        <div className="flex items-center px-3 border rounded-sm mb-2 bg-background">
                                            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                                            <input
                                                className="flex h-10 w-full rounded-sm bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
                                                placeholder="Buscar motivo..."
                                                value={justifySearchTerm}
                                                onChange={(e) => setJustifySearchTerm(e.target.value)}
                                            />
                                        </div>
                                        <div className="max-h-[200px] overflow-y-auto space-y-1">
                                            {reasons
                                                .filter(r => !justifySearchTerm || r.label.toLowerCase().includes(justifySearchTerm.toLowerCase()))
                                                .map((opt) => (
                                                    <div
                                                        key={opt.value}
                                                        className={cn(
                                                            "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
                                                            openingJustifyReason === opt.value && "bg-accent"
                                                        )}
                                                        onClick={() => {
                                                            setOpeningJustifyReason(opt.value)
                                                            setJustifySearchTerm("")
                                                            setOpeningJustifyOpen(false)
                                                        }}
                                                    >
                                                        <span>{opt.label}</span>
                                                        {openingJustifyReason === opt.value && <Check className="ml-auto h-4 w-4 opacity-100" />}
                                                    </div>
                                                ))}
                                            {reasons.length > 0 && justifySearchTerm && !reasons.some(r => r.label.toLowerCase().includes(justifySearchTerm.toLowerCase())) && (
                                                <div className="px-2 py-4 text-center text-sm text-muted-foreground">Sin resultados</div>
                                            )}
                                        </div>
                                    </div>
                                </PopoverContent>
                            </Popover>
                        </div>

                        {openingJustifyReason === 'TRANSFER' && (
                            <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                                <Label className="text-xs">
                                    {openingDiff < 0 ? 'Cuenta de Destino (¿A dónde se fue?)' : 'Cuenta de Origen (¿De dónde vino?)'}
                                </Label>
                                <TreasuryAccountSelector
                                    value={openingJustifyTargetId}
                                    onChange={setOpeningJustifyTargetId}
                                    placeholder={openingDiff < 0 ? "Seleccione destino..." : "Seleccione origen..."}
                                    excludeId={selectedTerminal?.default_treasury_account}
                                />

                                {openingInsufficientFunds && openingSelectedAccount && (
                                    <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3 space-y-1">
                                        <div className="flex items-start gap-2">
                                            <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                                            <div className="text-sm text-destructive">
                                                <div className="font-bold">Fondos Insuficientes</div>
                                                <div className="text-xs mt-1 space-y-0.5">
                                                    <div>Disponible en {openingSelectedAccount.name}: {formatCurrency(openingSelectedAccount.current_balance || 0)}</div>
                                                    <div>Necesario: {formatCurrency(Math.abs(openingDiff))}</div>
                                                    <div className="font-semibold">Faltante: {formatCurrency(Math.abs(openingDiff) - (openingSelectedAccount.current_balance || 0))}</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )
            })()}
        </div>
    )

    // Join Session Flow
    const joinStepContent = (
        <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="text-center mb-4">
                <h3 className="font-bold">Unirse a una sesión existente</h3>
                <p className="text-sm text-muted-foreground">Seleccione una sesión activa para operar</p>
            </div>
            <div className="grid gap-2">
                {availableSessions.map((session) => (
                    <Button
                        key={session.id}
                        variant={selectedSharedSessionId === session.id.toString() ? "default" : "outline"}
                        className="justify-start h-auto py-3 px-4"
                        onClick={() => setSelectedSharedSessionId(session.id.toString())}
                    >
                        <div className="text-left w-full">
                                <div className="font-bold flex justify-between">
                                    <span>{session.treasury_account_name}</span>
                                    <Chip size="xs" intent="neutral" className="ml-auto">{session.user_name}</Chip>
                                </div>
                            <div className="text-xs opacity-70 mt-1">Abierta: {new Date(session.opened_at).toLocaleTimeString()}</div>
                        </div>
                    </Button>
                ))}
            </div>
        </div>
    )

    const steps: WizardStep[] = [
        {
            id: 'mode',
            title: 'Modo de Apertura',
            component: modeStepContent,
            isValid: true
        },
        ...(mode === 'join'
            ? [{
                id: 'join',
                title: 'Unirse a Sesión',
                component: joinStepContent,
                isValid: !!selectedSharedSessionId
            } as WizardStep]
            : [
                ...(needsTerminalSelection ? [{
                    id: 'terminal',
                    title: 'Seleccionar Punto de Venta',
                    component: terminalStepContent,
                    isValid: !!selectedTerminalId
                } as WizardStep] : []),
                {
                    id: 'fund',
                    title: 'Fondo Inicial',
                    component: fundStepContent,
                    isValid: true
                },
                {
                    id: 'confirm',
                    title: 'Confirmar Apertura',
                    component: confirmStepContent,
                    isValid: canConfirm
                }
            ] as WizardStep[])
    ]

    // Keyboard shortcut: Enter submits the confirmation step
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
                if (open && steps[currentStepIndex]?.id === 'confirm' && !submitting && canConfirm) {
                    handleOpenSession()
                }
            }
        }

        window.addEventListener("keydown", handleKeyDown)
        return () => window.removeEventListener("keydown", handleKeyDown)
    }, [open, steps, currentStepIndex, canConfirm, submitting])

    return (
        <GenericWizard
            open={open}
            onOpenChange={(val) => {
                if (!val) onClose?.()
                onOpenChange(val)
            }}
            title="Apertura de Sesión"
            steps={steps}
            initialStep={stepIndex}
            onComplete={mode === 'join' ? handleJoinSession : handleOpenSession}
            isCompleting={submitting}
            completeButtonLabel={mode === 'join' ? "Unirse" : "Confirmar Apertura"}
            completeButtonIcon={<CheckCircle2 className="h-4 w-4" />}
            size="lg"
            touchMode={isTouchMode}
            onStepChange={setCurrentStepIndex}
        />
    )
}
