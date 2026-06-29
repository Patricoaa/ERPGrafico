"use client"
import { formatCurrency } from "@/lib/money"

import { showApiError } from "@/lib/errors"
import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

import {
    Loader2, Unlock,
    Users, AlertTriangle, Search, ChevronDown, Check
} from "lucide-react"
import { MovementWizard, type MovementData } from "@/features/treasury/components/MovementWizard"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { toast } from "sonner"
import { posApi } from "../api/posApi"
import { POSReport, type POSReportData } from "@/features/pos/components/POSReport"
import { SessionCloseModal } from "@/features/pos/components/SessionCloseModal"
import { BaseModal, Numpad } from '@/components/shared'
import { TreasuryAccountSelector } from "@/components/selectors/TreasuryAccountSelector"
import { forwardRef, useImperativeHandle } from "react"

import { cn } from "@/lib/utils"
import type { POSSession, POSTerminal, AccountingSettings, TreasuryAccount, POSSessionAudit } from "@/types/pos"
import { DEFICIT_OPTIONS, SURPLUS_OPTIONS } from "@/features/pos/utils/reasons"

interface SessionControlProps {
    onSessionChange?: (session: POSSession | null) => void
    hideSessionInfo?: boolean
    session?: POSSession | null
}

export interface SessionControlHandle {
    showXReport: () => void
    refreshSession: () => Promise<void>
    showMoveDialog: () => void
    requestCloseSession: () => void
    disconnectSharedSession: () => void
    openSessionDialog: () => void
}

export const SessionControl = forwardRef<SessionControlHandle, SessionControlProps>(({ onSessionChange, hideSessionInfo = false, session }, ref) => {
    const [loading, setLoading] = useState(session === undefined)
    const [openDialogOpen, setOpenDialogOpen] = useState(false)
    const [closeDialogOpen, setCloseDialogOpen] = useState(false)
    const [reportDialogOpen, setReportDialogOpen] = useState(false)
    const [moveDialogOpen, setMoveDialogOpen] = useState(false)
    const [reportData, setReportData] = useState<POSReportData | null>(null)
    const [reportType, setReportType] = useState<"X" | "Z">("X")
    const [lastAudit, setLastAudit] = useState<POSSessionAudit | null>(null)
    const [terminals, setTerminals] = useState<POSTerminal[]>([])
    const [availableSessions, setAvailableSessions] = useState<POSSession[]>([])
    const [dataLoading, setDataLoading] = useState(false)
    const [, setDataError] = useState(false)


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

    const selectedTerminal = useMemo(() => terminals.find(t => t.id === parseInt(selectedTerminalId)), [terminals, selectedTerminalId])
    const expectedBalance = selectedTerminal?.default_treasury_account_balance || 0
    const actualBalance = parseFloat(openingBalance) || 0
    const openingDiff = actualBalance - expectedBalance

    // Shared session selection
    const [selectedSharedSessionId, setSelectedSharedSessionId] = useState<string>("")

    // Close session state - simplified (modal handles its own state)
    // No longer needed, SessionCloseModal manages its own form state

    const [submitting, setSubmitting] = useState(false)
    const [isSharedSession, setIsSharedSession] = useState(false)

    // Open Session Wizard State
    const [wizardStep, setWizardStep] = useState<number>(1)
    // 1: Mode Selection (Review context)
    // 2: Terminal Selection (if multiple)
    // 3: Initial Fund (Numpad)
    // 4: Confirmation

    const loadInitialData = () => {
        setDataLoading(true)
        setDataError(false)
        Promise.all([
            fetchTerminals(),
            fetchAvailableSessions(),
        ]).finally(() => setDataLoading(false))
    }

    useEffect(() => {
        if (openDialogOpen) {
            requestAnimationFrame(() => {
                setWizardStep(1)
                loadInitialData()
                // Fetch accounting settings for justification logic
                posApi.getAccountingSettings()
                    .then(data => requestAnimationFrame(() => setAccountingSettings(data)))
                    .catch(err => console.error("Failed to load accounting settings", err))
                // Reset validation states
                setOpeningSelectedAccount(null)
                setOpeningInsufficientFunds(false)
            })
        }
    }, [openDialogOpen])

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

    const handleRequestClose = () => {
        setCloseDialogOpen(true)
    }

    useImperativeHandle(ref, () => ({
        showXReport: () => {
            if (session) {
                handleShowXReport()
            } else {
                toast.error("No hay una sesión activa para generar el reporte")
            }
        },
        refreshSession: async () => {
            const storedSharedId = localStorage.getItem('shared_pos_session_id')
            if (storedSharedId) {
                await fetchSharedSession(parseInt(storedSharedId))
            } else {
                await fetchCurrentSession()
            }
        },
        showMoveDialog: () => setMoveDialogOpen(true),
        requestCloseSession: handleRequestClose,
        disconnectSharedSession: handleDisconnect,
        openSessionDialog: () => setOpenDialogOpen(true)
    }))
    // Fetch current session on mount (uncontrolled mode fallback)
    useEffect(() => {
        if (session !== undefined) {
            setLoading(false)
            return
        }

        const storedSharedId = localStorage.getItem('shared_pos_session_id')
        if (storedSharedId) {
            fetchSharedSession(parseInt(storedSharedId))
        } else {
            fetchCurrentSession()
        }
    }, [session])

    // Fetch terminals on mount
    useEffect(() => {
        fetchTerminals()
    }, [])

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
                // Determine which action to trigger based on open dialogs
                if (openDialogOpen && selectedTerminalId && wizardStep === 4 && !submitting) {
                    const canSubmit = !(openingDiff !== 0 && !openingJustifyReason)
                        && !(openingJustifyReason === 'TRANSFER' && !openingJustifyTargetId)
                        && !openingInsufficientFunds
                    if (canSubmit) {
                        handleOpenSession()
                    }
                }
                // Note: closeDialogOpen removed - SessionCloseModal handles its own keyboard shortcuts
            }
        }

        window.addEventListener("keydown", handleKeyDown)
        return () => window.removeEventListener("keydown", handleKeyDown)
    }, [openDialogOpen, moveDialogOpen, selectedTerminalId, openingBalance, openingJustifyReason, terminals, wizardStep, submitting, openingInsufficientFunds, openingJustifyTargetId])

    const fetchSharedSession = async (id: number) => {
        try {
            const sessionData = await posApi.getSession(id)
            if (sessionData && (sessionData as POSSession).status === 'OPEN') {
                onSessionChange?.(sessionData)
                setIsSharedSession(true)
            } else {
                localStorage.removeItem('shared_pos_session_id')
                fetchCurrentSession()
            }
        } catch (error) {
            console.error("Error fetching shared session:", error)
            localStorage.removeItem('shared_pos_session_id')
            fetchCurrentSession()
        } finally {
            setLoading(false)
        }
    }

    const fetchCurrentSession = async () => {
        try {
            const sessionData = await posApi.getCurrentSession()
            if (sessionData && (sessionData as POSSession).id) {
                onSessionChange?.(sessionData)
                setIsSharedSession(false)
            } else {
                onSessionChange?.(null)
            }
        } catch (error) {
            console.error("Error fetching current session:", error)
            toast.error("Error al verificar sesión activa")
        } finally {
            setLoading(false)
        }
    }

    const fetchTerminals = async () => {
        try {
            const terminalsData = await posApi.getTerminals()
            const terminalsResponse = terminalsData as { results?: POSTerminal[] } | POSTerminal[]
            const results = Array.isArray(terminalsResponse) ? terminalsResponse : (terminalsResponse.results ?? [])
            setTerminals(results)
        } catch (error) {
            console.error("Error fetching terminals:", error)
            toast.error("Error al cargar terminales")
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

    // Autofill Fund Source from Terminal Default (Keep balance at 0 as requested)
    useEffect(() => {
        if (openDialogOpen && selectedTerminalId) {
            const terminal = terminals.find(t => t.id === parseInt(selectedTerminalId))
            if (terminal) {
                if (terminal.default_treasury_account) {
                    requestAnimationFrame(() => setFundSourceId(terminal.default_treasury_account.toString()))
                }
            }
        }
    }, [openDialogOpen, selectedTerminalId, terminals])

    // Removed: Autofill Destination from Terminal Default
    // No longer needed - SessionCloseModal handles its own state and autofill logic

    // Removed: Autofill Opening Balance from Fund Source (User wants start at 0)

    const handleOpenSession = async () => {
        if (!selectedTerminalId) {
            toast.error("Debe seleccionar un terminal")
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

            onSessionChange?.(sessionData)
            setIsSharedSession(false)
            setOpenDialogOpen(false)
            setReportDialogOpen(false)
            toast.success("Caja abierta correctamente")
            localStorage.removeItem('shared_pos_session_id')
        } catch (error: unknown) {
            showApiError(error, "Error al abrir caja")
        } finally {
            setSubmitting(false)
        }
    }

    const handleJoinSession = () => {
        if (!selectedSharedSessionId) {
            toast.error("Debe seleccionar una sesión")
            return
        }

        const foundSession = availableSessions.find(s => s.id === parseInt(selectedSharedSessionId))
        if (foundSession) {
            localStorage.setItem('shared_pos_session_id', foundSession.id.toString())
            onSessionChange?.(foundSession)
            setIsSharedSession(true)
            setOpenDialogOpen(false)
            setReportDialogOpen(false)
            toast.success(`Unido a la sesión de ${foundSession.user_name}`)
        }
    }

    const handleDisconnect = () => {
        localStorage.removeItem('shared_pos_session_id')
        onSessionChange?.(null)
        setIsSharedSession(false)
        toast.info("Desconectado de la sesión compartida")
        setLoading(true)
        fetchCurrentSession()
    }

    const handleSessionCloseSuccess = async (audit: POSSessionAudit) => {
        if (!session) return

        setLastAudit(audit)

        localStorage.removeItem('shared_pos_session_id')
        onSessionChange?.(null)
        setIsSharedSession(false)

        try {
            const summaryData = await posApi.getSessionSummary(session.id)
            setReportData(summaryData)
            setReportType("Z")
            setReportDialogOpen(true)
        } catch (error) {
            console.error("Error fetching Z report:", error)
            toast.error("Sesión cerrada correctamente, pero no se pudo cargar el reporte Z")
        }
    }

    const handleShowXReport = async () => {
        if (!session) return

        setLoading(true)
        try {
            const reportData = await posApi.getSessionSummary(session.id)
            setReportData(reportData)
            setReportType("X")
            setReportDialogOpen(true)
        } catch (error) {
            console.error("Error fetching X Report:", error)
            toast.error("Error al generar el reporte parcial")
        } finally {
            setLoading(false)
        }
    }

    const handleRegisterManualMovement = async (data: MovementData) => {
        if (!session) return

        setSubmitting(true)
        try {
            const moveResult = await posApi.registerManualMovement(session.id, {
                type: data.moveType,
                amount: data.amount,
                notes: data.notes,
                target_account_id: data.targetAccountId || null,
                is_inflow: data.impact === 'TRANSFER' ? data.isInflowForce : (data.impact === 'IN')
            })

            const moveResponse = moveResult as { session: POSSession; message: string }
            onSessionChange?.(moveResponse.session)
            setMoveDialogOpen(false)
            toast.success(moveResponse.message)
        } catch (error: unknown) {
            showApiError(error, "Error al registrar movimiento")
        } finally {
            setSubmitting(false)
        }
    }

    // ... (keep existing effects for fetching logic)

    const handleNextStep = () => {
        setWizardStep(prev => prev + 1)
    }

    const handlePrevStep = () => {
        setWizardStep(prev => prev - 1)
    }

    const renderWizardStep = () => {
        switch (wizardStep) {
            case 1: // Context / Actions
                if (dataLoading) {
                    return (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="text-center space-y-2 mb-6">
                                <h3 className="text-lg font-bold">Bienvenido a la terminal de POS</h3>
                            </div>
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                <span className="ml-3 text-sm text-muted-foreground">Cargando terminales...</span>
                            </div>
                        </div>
                    )
                }
                return (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="text-center space-y-2 mb-6">
                            <h3 className="text-lg font-bold">Bienvenido a la terminal de POS</h3>
                            <p className="text-sm text-muted-foreground">¿Qué desea realizar hoy?</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Button
                                variant="outline"
                                className="h-20 flex flex-col items-center justify-center border-2 hover:border-success hover:bg-success/5 group"
                                onClick={() => {
                                    // Filter active terminals (those generally available) against those ALREADY in a session (busy)
                                    const availableTerminals = terminals.filter(t => !availableSessions.some(s => s.terminal === t.id))

                                    // If only 1 terminal available, auto-select it and skip to step 3
                                    if (availableTerminals.length === 1) {
                                        setSelectedTerminalId(availableTerminals[0].id.toString())
                                        setWizardStep(3)
                                    } else {
                                        setWizardStep(2)
                                    }
                                }}
                                disabled={terminals.filter(t => !availableSessions.some(s => s.terminal === t.id)).length === 0}
                            >
                                <Unlock className="h-6 w-6" />
                                <div className="text-center">
                                    <span className="font-bold text-lg block">Abrir Nueva Terminal</span>
                                    <span className="text-xs text-muted-foreground">
                                        {terminals.filter(t => !availableSessions.some(s => s.terminal === t.id)).length} terminales libres
                                    </span>
                                </div>
                            </Button>

                            <Button
                                variant="outline"
                                className="h-32 flex flex-col items-center justify-center gap-3 border-2 hover:border-primary hover:bg-primary/10 group transition-all"
                                disabled={availableSessions.length === 0}
                                onClick={() => setWizardStep(10)} // 10 is Join Session Flow
                            >
                                <Users className="h-6 w-6" />
                                <div className="text-center">
                                    <span className="font-bold text-lg block">Unirse a Terminal</span>
                                    <span className="text-xs text-muted-foreground">
                                        {availableSessions.length > 0
                                            ? `${availableSessions.length} terminales activas`
                                            : "No hay terminales activas"}
                                    </span>
                                </div>
                            </Button>
                        </div>
                    </div>
                )

            case 2: // Terminal Selection
                const freeTerminals = terminals.filter(t => !availableSessions.some(s => s.terminal === t.id))
                if (freeTerminals.length === 0 && !dataLoading) {
                    return (
                        <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="text-center mb-4">
                                <h3 className="font-bold">Seleccione Terminal POS</h3>
                            </div>
                            <div className="flex flex-col items-center justify-center py-8 gap-3 text-center">
                                <AlertTriangle className="h-8 w-8 text-muted-foreground" />
                                <p className="text-sm text-muted-foreground">No hay terminales disponibles</p>
                                <p className="text-xs text-muted-foreground">
                                    Todas las terminales están ocupadas o no se pudieron cargar.
                                </p>
                                <Button variant="outline" size="sm" onClick={loadInitialData}>
                                    Reintentar
                                </Button>
                            </div>
                            <Button variant="ghost" onClick={handlePrevStep} className="w-full">Volver</Button>
                        </div>
                    )
                }
                return (
                    <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="text-center mb-4">
                            <h3 className="font-bold">Seleccione Terminal POS</h3>
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
                                        handleNextStep() // Auto advance on selection
                                    }}
                                >
                                    <div className="text-left">
                                        <div className="font-bold">{t.name}</div>
                                        <div className="text-xs opacity-70">{t.location}</div>
                                    </div>
                                    {t.default_treasury_account_balance > 0 && (
                                        <span className="ml-auto text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full border border-muted-foreground/20 bg-muted/30 text-muted-foreground">
                                            Base: {formatCurrency(t.default_treasury_account_balance)}
                                        </span>
                                    )}
                                </Button>
                            ))}
                        </div>
                        <Button variant="ghost" onClick={handlePrevStep} className="w-full">Volver</Button>
                    </div>
                )

            case 3: // Initial Fund (Numpad)
                const terminal = terminals.find(t => t.id === parseInt(selectedTerminalId))
                return (
                    <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="text-center space-y-1">
                            <h3 className="font-bold text-lg">{terminal?.name}</h3>
                            <p className="text-sm text-muted-foreground">Ingrese el fondo inicial en caja</p>
                        </div>

                        <div className="flex justify-center">
                            <div className="w-full max-w-sm bg-muted/30 p-4 rounded-md">
                                <Numpad
                                    value={openingBalance}
                                    onChange={setOpeningBalance}
                                    label="Monto Ingresado"
                                    displayValue={formatCurrency(parseFloat(openingBalance) || 0)}
                                    allowDecimal={true}
                                    className="w-full max-w-full shadow-none border-0 p-0"
                                    onConfirm={handleNextStep}
                                    confirmLabel="Continuar"
                                    onExactAmount={
                                        (terminal && terminal.default_treasury_account_balance > 0)
                                            ? () => setOpeningBalance(terminal.default_treasury_account_balance.toString())
                                            : undefined
                                    }
                                    exactAmountLabel={
                                        (terminal && terminal.default_treasury_account_balance > 0)
                                            ? `Base: ${formatCurrency(terminal.default_treasury_account_balance)}`
                                            : undefined
                                    }
                                />
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <Button variant="outline" onClick={handlePrevStep} className="w-full">Atrás</Button>
                        </div>
                    </div>
                )

            case 4: // Confirmation & Justification
                return (
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

                        <div className="flex gap-2">
                            <Button variant="ghost" onClick={handlePrevStep} className="flex-1">Corregir</Button>
                            <Button
                                onClick={handleOpenSession}
                                className="flex-[2]"
                                disabled={
                                    submitting ||
                                    (openingDiff !== 0 && !openingJustifyReason) ||
                                    (openingJustifyReason === 'TRANSFER' && !openingJustifyTargetId) ||
                                    openingInsufficientFunds
                                }
                            >
                                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Confirmar Apertura
                            </Button>
                        </div>
                    </div>
                )

            case 10: // Shared Session Selection
                return (
                    <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="text-center mb-4">
                            <h3 className="font-bold">Unirse a terminal existente</h3>
                            <p className="text-sm text-muted-foreground">Seleccione una terminal activa para operar</p>
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
                                            <span className="text-[10px] h-5 px-1.5 font-bold uppercase rounded-full border border-muted-foreground/20 bg-muted/10 text-muted-foreground flex items-center">{session.user_name}</span>
                                        </div>
                                        <div className="text-xs opacity-70 mt-1">Abierta: {new Date(session.opened_at).toLocaleTimeString()}</div>
                                    </div>
                                </Button>
                            ))}
                        </div>
                        <div className="flex gap-2 mt-4">
                            <Button variant="ghost" onClick={() => setWizardStep(1)} className="flex-1">Volver</Button>
                            <Button onClick={handleJoinSession} disabled={!selectedSharedSessionId} className="flex-1">Unirse</Button>
                        </div>
                    </div>
                )

            default: return null
        }
    }

    if (loading) {
        return (
            <Button variant="default" disabled className="gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Cargando...
            </Button>
        )
    }

    if (!session || session.status !== 'OPEN') {
        return (
            <>
                <Button
                    variant="default"
                    onClick={() => setOpenDialogOpen(true)}
                    className="gap-2"
                >
                    <Unlock className="h-4 w-4" />
                    Abrir Caja
                </Button>

                <BaseModal
                    open={openDialogOpen}
                    onOpenChange={setOpenDialogOpen}
                    size="lg"
                    title={wizardStep === 1 ? "Nueva Sesión" : wizardStep === 2 ? "Seleccionar Terminal" : wizardStep === 3 ? "Fondo Inicial" : wizardStep === 4 ? "Confirmar Apertura" : wizardStep === 10 ? "Unirse a Sesión" : "Control de Sesión"}
                >
                    <div className="py-2">
                        {renderWizardStep()}
                    </div>
                </BaseModal>
            </>
        )
    }

    return (
        <>
            <div className="flex items-center gap-2">
                {!hideSessionInfo && session && (
                    <>
                        <span className={cn(
                            "gap-1 px-3 py-1.5 flex items-center text-[10px] font-bold uppercase rounded-full border",
                            isSharedSession ? 'bg-primary/10 text-primary border-primary/20' : 'border-success/30 text-success bg-success/5'
                        )}>
                            <div className={cn("h-2 w-2 rounded-full animate-pulse", isSharedSession ? 'bg-primary' : 'bg-success')} />
                            {isSharedSession ? "Caja Compartida" : "Caja Abierta"}
                        </span>

                        <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-3 mr-2">
                            <span className="text-sm font-medium">
                                {session.treasury_account_name}
                            </span>
                            {isSharedSession && (
                                <span className="text-xs text-muted-foreground">
                                    (Titular: {session.user_name})
                                </span>
                            )}
                        </div>
                    </>
                )}
            </div>

            {reportDialogOpen && (
                <div className="fixed inset-0 z-[100] bg-overlay/50 flex items-center justify-center p-4 animate-in fade-in duration-200 print:hidden text-foreground">
                    <div className="w-full max-w-sm animate-in zoom-in-95 duration-200 space-y-3">
                        {reportData && (
                            <POSReport
                                data={reportData}
                                type={reportType}
                                title={reportType === 'Z' ? 'Informe de Cierre (Z)' : 'Informe Parcial (X)'}
                                onClose={() => setReportDialogOpen(false)}
                            />
                        )}
                        {lastAudit && reportType === 'Z' && (
                            <div className="bg-card border rounded-md p-4 space-y-2 shadow-card text-sm">
                                <div className="font-bold text-xs uppercase text-muted-foreground">Resultado del Conteo</div>
                                <div className="flex justify-between">
                                    <span>Esperado:</span>
                                    <span className="font-mono">{formatCurrency(Number(lastAudit.expected_amount))}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Real:</span>
                                    <span className="font-mono">{formatCurrency(Number(lastAudit.actual_amount))}</span>
                                </div>
                                <div className="flex justify-between font-bold border-t pt-2">
                                    <span>Diferencia:</span>
                                    <span className={cn("font-mono", Number(lastAudit.difference) !== 0 ? "text-warning" : "text-success")}>
                                        {formatCurrency(Number(lastAudit.difference))}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {session && (
                <SessionCloseModal
                    open={closeDialogOpen}
                    onOpenChange={setCloseDialogOpen}
                    session={session}
                    onSuccess={handleSessionCloseSuccess}
                />
            )}

            {moveDialogOpen && session && (
                <MovementWizard
                    open={moveDialogOpen}
                    onOpenChange={setMoveDialogOpen}
                    context="pos"
                    fixedAccountId={typeof session.treasury_account === 'object' ? session.treasury_account?.id : (session.treasury_account as number || undefined)}
                    fixedAccountName={session.treasury_account_name}
                    maxOutboundAmount={session.expected_cash}
                    onComplete={handleRegisterManualMovement}
                    onCancel={() => setMoveDialogOpen(false)}
                />
            )}

        </>
    )
})

SessionControl.displayName = "SessionControl"
