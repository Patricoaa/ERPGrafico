"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { BaseModal } from "@/components/shared/BaseModal"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
    Loader2, Lock, Unlock, Calculator, Banknote,
    CreditCard, ArrowRightLeft, FileText, Users, LogOut,
    Vault, AlertTriangle, Search, ChevronsUpDown, Check
} from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { toast } from "sonner"
import api from "@/lib/api"
import { POSReport } from "@/components/pos/POSReport"
import { SessionCloseModal } from "@/components/pos/SessionCloseModal"
import { Numpad } from "@/components/ui/numpad"
import { TreasuryAccountSelector } from "@/components/selectors/TreasuryAccountSelector"
import { forwardRef, useImperativeHandle } from "react"
import { ActionConfirmModal } from "@/components/shared/ActionConfirmModal"
import { cn, translateStatus, formatCurrency } from "@/lib/utils"
import { FORM_STYLES } from "@/lib/styles"
import { MovementWizard, MovementData } from "@/features/treasury/components/MovementWizard"
import type { POSSession } from "@/types/pos"

interface POSTerminal {
    id: number
    name: string
    code: string
    location: string
    is_active: boolean
    default_treasury_account: number
    default_treasury_account_name: string
    default_treasury_account_balance: number
    allowed_payment_methods: string[]
}

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
}

export const SessionControl = forwardRef<SessionControlHandle, SessionControlProps>(({ onSessionChange, hideSessionInfo = false, session }, ref) => {
    const [currentSession, setCurrentSession] = useState<POSSession | null>(session || null)
    const [loading, setLoading] = useState(!session)
    const [openDialogOpen, setOpenDialogOpen] = useState(false)
    const [closeDialogOpen, setCloseDialogOpen] = useState(false)
    const [reportDialogOpen, setReportDialogOpen] = useState(false)
    const [moveDialogOpen, setMoveDialogOpen] = useState(false)
    const [reportData, setReportData] = useState<any>(null)
    const [reportType, setReportType] = useState<"X" | "Z">("X")
    const [terminals, setTerminals] = useState<POSTerminal[]>([])
    const [availableSessions, setAvailableSessions] = useState<POSSession[]>([])

    // Open session form state
    const [selectedTerminalId, setSelectedTerminalId] = useState<string>("")
    const [openingBalance, setOpeningBalance] = useState<string>("0")
    const [fundSourceId, setFundSourceId] = useState<string | null>(null)
    const [openingJustifyReason, setOpeningJustifyReason] = useState<string>("")
    const [openingJustifyTargetId, setOpeningJustifyTargetId] = useState<string | null>(null)
    const [accountingSettings, setAccountingSettings] = useState<any>(null)

    // Fund validation for session opening
    const [openingSelectedAccount, setOpeningSelectedAccount] = useState<any>(null)
    const [openingInsufficientFunds, setOpeningInsufficientFunds] = useState(false)

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

    useEffect(() => {
        if (openDialogOpen) {
            setWizardStep(1)
            fetchAvailableSessions()
            fetchTerminals()
            // Fetch accounting settings for justification logic
            api.get('/accounting/settings/current/')
                .then(res => setAccountingSettings(res.data))
                .catch(err => console.error("Failed to load accounting settings", err))
            // Reset validation states
            setOpeningSelectedAccount(null)
            setOpeningInsufficientFunds(false)
        }
    }, [openDialogOpen])

    // Fetch selected account for transfer validation during opening
    useEffect(() => {
        if (openingJustifyTargetId && openingJustifyReason === 'TRANSFER' && selectedTerminalId) {
            const terminal = terminals.find(t => t.id === parseInt(selectedTerminalId))
            const expected = terminal?.default_treasury_account_balance || 0
            const actual = parseFloat(openingBalance) || 0
            const diff = actual - expected

            api.get(`/treasury/accounts/${openingJustifyTargetId}/`)
                .then(res => {
                    setOpeningSelectedAccount(res.data)
                    // Validate only for surplus (diff > 0 = money coming IN)
                    if (diff > 0 && res.data.current_balance !== undefined) {
                        const available = res.data.current_balance
                        const needed = Math.abs(diff)
                        setOpeningInsufficientFunds(available < needed)
                    } else {
                        setOpeningInsufficientFunds(false)
                    }
                })
                .catch(err => {
                    console.error("Failed to load account", err)
                    setOpeningSelectedAccount(null)
                    setOpeningInsufficientFunds(false)
                })
        } else {
            setOpeningSelectedAccount(null)
            setOpeningInsufficientFunds(false)
        }
    }, [openingJustifyTargetId, openingJustifyReason, selectedTerminalId, openingBalance, terminals])

    const handleRequestClose = () => {
        const confirmed = window.confirm(
            "⚠️ ATENCIÓN: Cerrar la sesión es IRREVERSIBLE.\n\n" +
            "Se generará el Reporte Z (cierre definitivo) y no podrá revertir esta acción.\n\n" +
            "¿Está seguro de que desea cerrar la caja?"
        );

        if (confirmed) {
            setCloseDialogOpen(true)
        }
    }

    useImperativeHandle(ref, () => ({
        showXReport: () => {
            if (currentSession) {
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
        disconnectSharedSession: handleDisconnect
    }))
    // Fetch current session on mount (or shared session)
    useEffect(() => {
        const storedSharedId = localStorage.getItem('shared_pos_session_id')
        if (session !== undefined) {
            setCurrentSession(session)
            setLoading(false)
            return
        }

        if (storedSharedId) {
            fetchSharedSession(parseInt(storedSharedId))
        } else {
            fetchCurrentSession()
        }
    }, [session]) // Removed all other dependencies to prevent re-initialization

    // Fetch terminals on mount (separate from session initialization)
    useEffect(() => {
        fetchTerminals()
    }, [])

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
                // Determine which action to trigger based on open dialogs
                if (openDialogOpen && selectedTerminalId && wizardStep === 4) {
                    const terminal = terminals.find(t => t.id === parseInt(selectedTerminalId))
                    const expected = terminal?.default_treasury_account_balance || 0
                    const actual = parseFloat(openingBalance) || 0
                    const diff = actual - expected
                    if (!(diff !== 0 && !openingJustifyReason)) {
                        handleOpenSession()
                    }
                } else if (moveDialogOpen) {
                    handleRegisterManualMovement()
                }
                // Note: closeDialogOpen removed - SessionCloseModal handles its own keyboard shortcuts
            }
        }

        window.addEventListener("keydown", handleKeyDown)
        return () => window.removeEventListener("keydown", handleKeyDown)
    }, [openDialogOpen, moveDialogOpen, selectedTerminalId, openingBalance, openingJustifyReason, terminals, wizardStep])

    // Sync state when session prop changes (controlled mode)
    useEffect(() => {
        if (session !== undefined) {
            setCurrentSession(session)
            // If we now have an active session, clear any stale report modal
            if (session && session.status === 'OPEN') {
                setReportDialogOpen(false)
            }
        }
    }, [session])

    const fetchSharedSession = async (id: number) => {
        try {
            const response = await api.get(`/treasury/pos-sessions/${id}/`)
            if (response.data && response.data.status === 'OPEN') {
                setCurrentSession(response.data)
                onSessionChange?.(response.data)
                setIsSharedSession(true)
            } else {
                // Invalid or closed
                localStorage.removeItem('shared_pos_session_id')
                fetchCurrentSession() // Fallback to personal session check
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
            const response = await api.get('/treasury/pos-sessions/current/')
            if (response.data && response.data.id) {
                setCurrentSession(response.data)
                onSessionChange?.(response.data)
                setIsSharedSession(false)
            } else {
                setCurrentSession(null)
                onSessionChange?.(null)
            }
        } catch (error) {
            console.error("Error fetching current session:", error)
        } finally {
            setLoading(false)
        }
    }

    const fetchTerminals = async () => {
        try {
            const response = await api.get('/treasury/pos-terminals/?active_only=true')
            const results = response.data.results || response.data
            setTerminals(results)
        } catch (error) {
            console.error("Error fetching terminals:", error)
            toast.error("Error al cargar terminales")
        }
    }

    const fetchAvailableSessions = async () => {
        try {
            const response = await api.get('/treasury/pos-sessions/?status=OPEN')
            const results = response.data.results || response.data
            setAvailableSessions(results)
        } catch (error) {
            console.error("Error fetching available sessions:", error)
        }
    }

    useEffect(() => {
        if (openDialogOpen) {
            fetchAvailableSessions()
            fetchTerminals()
        }
    }, [openDialogOpen])

    // Autofill Fund Source from Terminal Default (Keep balance at 0 as requested)
    useEffect(() => {
        if (openDialogOpen && selectedTerminalId) {
            const terminal = terminals.find(t => t.id === parseInt(selectedTerminalId))
            if (terminal) {
                if (terminal.default_treasury_account) {
                    setFundSourceId(terminal.default_treasury_account.toString())
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
            const response = await api.post('/treasury/pos-sessions/open_session/', {
                terminal_id: parseInt(selectedTerminalId),
                opening_balance: parseFloat(openingBalance),
                fund_source_id: fundSourceId ? parseInt(fundSourceId) : null,
                justify_reason: openingJustifyReason,
                justify_target_id: openingJustifyTargetId ? parseInt(openingJustifyTargetId) : null
            })

            setCurrentSession(response.data)
            onSessionChange?.(response.data)
            setIsSharedSession(false)
            setOpenDialogOpen(false)
            setReportDialogOpen(false)
            toast.success("Caja abierta correctamente")
            // Clear any stale shared session
            localStorage.removeItem('shared_pos_session_id')
        } catch (error: any) {
            toast.error(error.response?.data?.error || "Error al abrir caja")
        } finally {
            setSubmitting(false)
        }
    }

    const handleJoinSession = () => {
        if (!selectedSharedSessionId) {
            toast.error("Debe seleccionar una sesión")
            return
        }

        const session = availableSessions.find(s => s.id === parseInt(selectedSharedSessionId))
        if (session) {
            localStorage.setItem('shared_pos_session_id', session.id.toString())
            setCurrentSession(session)
            // onSessionChange passed here
            onSessionChange?.(session)
            setIsSharedSession(true)
            setOpenDialogOpen(false)
            setReportDialogOpen(false)
            toast.success(`Unido a la sesión de ${session.user_name}`)
        }
    }

    const handleDisconnect = () => {
        localStorage.removeItem('shared_pos_session_id')
        setCurrentSession(null)
        onSessionChange?.(null)
        setIsSharedSession(false)
        toast.info("Desconectado de la sesión compartida")
        // Optionally fetch personal session again
        setLoading(true)
        fetchCurrentSession()
    }

    const handleSessionCloseSuccess = async (audit: any) => {
        // Immediately fetch summary for Z Report
        if (!currentSession) return

        try {
            const summaryResponse = await api.get(`/treasury/pos-sessions/${currentSession.id}/summary/`)
            setReportData(summaryResponse.data)
            setReportType("Z")
            setReportDialogOpen(true)

            // Reset session state
            localStorage.removeItem('shared_pos_session_id')
            setCurrentSession(null)
            onSessionChange?.(null)
            setIsSharedSession(false)
        } catch (error) {
            console.error("Error fetching Z report:", error)
        }
    }

    const handleShowXReport = async () => {
        if (!currentSession) return

        setLoading(true)
        try {
            const response = await api.get(`/treasury/pos-sessions/${currentSession.id}/summary/`)
            setReportData(response.data)
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
        if (!currentSession) return

        setSubmitting(true)
        try {
            const response = await api.post(`/treasury/pos-sessions/${currentSession.id}/register_manual_movement/`, {
                type: data.moveType,
                amount: data.amount,
                notes: data.notes,
                target_account_id: data.targetAccountId || null,
                is_inflow: data.impact === 'TRANSFER' ? data.isInflowForce : (data.impact === 'IN')
            })

            setCurrentSession(response.data.session)
            onSessionChange?.(response.data.session)
            setMoveDialogOpen(false)
            toast.success(response.data.message)
        } catch (error: any) {
            toast.error(error.response?.data?.error || "Error al registrar movimiento")
        } finally {
            setSubmitting(false)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center gap-2 text-muted-foreground p-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Cargando sesión...</span>
            </div>
        )
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
                return (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="text-center space-y-2 mb-6">
                            <h3 className="text-lg font-bold">Bienvenido al POS</h3>
                            <p className="text-sm text-muted-foreground">¿Qué desea realizar hoy?</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Button
                                variant="outline"
                                className="h-32 flex flex-col items-center justify-center gap-3 border-2 hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 group transition-all"
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
                                <div className="p-3 rounded-full bg-emerald-100 text-emerald-600 group-hover:scale-110 transition-transform">
                                    <Unlock className="h-6 w-6" />
                                </div>
                                <div className="text-center">
                                    <span className="font-bold text-lg block">Abrir Nueva Caja</span>
                                    <span className="text-xs text-muted-foreground">
                                        {terminals.filter(t => !availableSessions.some(s => s.terminal === t.id)).length} terminales libres
                                    </span>
                                </div>
                            </Button>

                            <Button
                                variant="outline"
                                className="h-32 flex flex-col items-center justify-center gap-3 border-2 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/20 group transition-all"
                                disabled={availableSessions.length === 0}
                                onClick={() => setWizardStep(10)} // 10 is Join Session Flow
                            >
                                <div className="p-3 rounded-full bg-blue-100 text-blue-600 group-hover:scale-110 transition-transform">
                                    <Users className="h-6 w-6" />
                                </div>
                                <div className="text-center">
                                    <span className="font-bold text-lg block">Unirse a Caja</span>
                                    <span className="text-xs text-muted-foreground">
                                        {availableSessions.length > 0
                                            ? `${availableSessions.length} cajas activas`
                                            : "No hay cajas activas"}
                                    </span>
                                </div>
                            </Button>
                        </div>
                    </div>
                )

            case 2: // Terminal Selection
                return (
                    <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="text-center mb-4">
                            <h3 className="font-bold">Seleccione Terminal POS</h3>
                        </div>
                        <div className="grid gap-2 max-h-[300px] overflow-y-auto">
                            {terminals.filter(t => !availableSessions.some(s => s.terminal === t.id)).map(t => (
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
                                        <Badge variant="secondary" className="ml-auto">
                                            Base: {formatCurrency(t.default_treasury_account_balance)}
                                        </Badge>
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
                            <div className="w-full max-w-sm bg-muted/30 p-4 rounded-xl">
                                <div className="text-right mb-4">
                                    <div className="text-xs font-bold uppercase text-muted-foreground">Monto Ingresado</div>
                                    <div className="text-3xl font-black font-mono tracking-tight text-primary">
                                        {formatCurrency(parseFloat(openingBalance) || 0)}
                                    </div>
                                </div>
                                <Numpad
                                    value={openingBalance}
                                    onChange={setOpeningBalance}
                                    hideDisplay={true}
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
                const term = terminals.find(t => t.id === parseInt(selectedTerminalId))
                const expected = term?.default_treasury_account_balance || 0
                const actual = parseFloat(openingBalance) || 0
                const diff = actual - expected
                const hasDiff = diff !== 0

                return (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="text-center">
                            <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                                <Unlock className="h-6 w-6 text-primary" />
                            </div>
                            <h3 className="font-bold text-xl">Confirmar Apertura</h3>
                            <p className="text-muted-foreground">{term?.name}</p>
                        </div>

                        <div className="bg-card border rounded-xl p-4 space-y-3 shadow-sm">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-muted-foreground">Fondo en Sistema:</span>
                                <span className="font-medium">{formatCurrency(expected)}</span>
                            </div>
                            <div className="flex justify-between items-center text-lg font-bold border-t pt-2">
                                <span>Fondo Contado:</span>
                                <span className="text-primary">{formatCurrency(actual)}</span>
                            </div>
                        </div>

                        {hasDiff && (
                            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 space-y-3">
                                <div className="flex items-center gap-2 text-amber-700 font-bold">
                                    <AlertTriangle className="h-4 w-4" />
                                    <span>Se detectó una diferencia</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span>{diff > 0 ? "Sobrante" : "Faltante"}:</span>
                                    <span className="font-bold">{formatCurrency(Math.abs(diff))}</span>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs">Motivo (Requerido)</Label>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                role="combobox"
                                                className="w-full justify-between h-9 bg-background font-normal"
                                            >
                                                {openingJustifyReason
                                                    ? (diff < 0
                                                        ? [
                                                            { value: "COUNTING_ERROR", label: "Error de Conteo / Ajuste" },
                                                            { value: "TRANSFER", label: "Traspaso (Dinero enviado a otra caja)" },
                                                            { value: "PARTNER_WITHDRAWAL", label: "Retiro Socio" },
                                                            { value: "THEFT", label: "Faltante / Robo" },
                                                            { value: "SYSTEM_ERROR", label: "Error de Sistema" },
                                                          ].find(opt => opt.value === openingJustifyReason)?.label
                                                        : [
                                                            { value: "COUNTING_ERROR", label: "Error de Conteo / Ajuste" },
                                                            { value: "TIP", label: "Propina" },
                                                            { value: "TRANSFER", label: "Traspaso (Dinero recibido de otra caja)" },
                                                            { value: "OTHER_IN", label: "Otro Depósito" },
                                                            { value: "SYSTEM_ERROR", label: "Error de Sistema" },
                                                          ].find(opt => opt.value === openingJustifyReason)?.label
                                                      ) || "Seleccione motivo..."
                                                    : "Seleccione motivo..."}
                                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                                            <div className="p-2">
                                                <div className="flex items-center px-3 border rounded-md mb-2 bg-background">
                                                    <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                                                    <input
                                                        className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
                                                        placeholder="Buscar motivo..."
                                                        onChange={(e) => {
                                                            const val = e.target.value.toLowerCase()
                                                            const inputs = document.querySelectorAll('.justify-popover-item')
                                                            inputs.forEach((el) => {
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
                                                    {(diff < 0
                                                        ? [
                                                            { value: "COUNTING_ERROR", label: "Error de Conteo (Ajuste)" },
                                                            { value: "TRANSFER", label: "Traspaso (Dinero Enviado)" },
                                                            ...(accountingSettings?.pos_partner_withdrawal_account ? [{ value: "PARTNER_WITHDRAWAL", label: "Retiro Socio" }] : []),
                                                            ...(accountingSettings?.pos_theft_account ? [{ value: "THEFT", label: "Faltante / Robo" }] : []),
                                                            { value: "SYSTEM_ERROR", label: "Error de Sistema" },
                                                          ]
                                                        : [
                                                            { value: "COUNTING_ERROR", label: "Error de Conteo (Ajuste)" },
                                                            { value: "TIP", label: "Propina" },
                                                            { value: "TRANSFER", label: "Traspaso (Dinero Recibido)" },
                                                            { value: "OTHER_IN", label: "Otro Depósito" },
                                                            { value: "SYSTEM_ERROR", label: "Error de Sistema" },
                                                          ]).map((opt) => (
                                                            <div
                                                                key={opt.value}
                                                                className={cn(
                                                                    "justify-popover-item relative flex cursor-pointer select-none items-center rounded-sm px-2 py-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
                                                                    openingJustifyReason === opt.value && "bg-accent"
                                                                )}
                                                                onClick={() => {
                                                                    setOpeningJustifyReason(opt.value)
                                                                    document.body.click()
                                                                }}
                                                            >
                                                                <span>{opt.label}</span>
                                                                {openingJustifyReason === opt.value && <Check className="ml-auto h-4 w-4 opacity-100" />}
                                                            </div>
                                                        ))
                                                    }
                                                </div>
                                            </div>
                                        </PopoverContent>
                                    </Popover>
                                </div>

                                {/* Dynamic selector for Transfer justification */}
                                {openingJustifyReason === 'TRANSFER' && (
                                    <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                                        <Label className="text-xs">
                                            {diff < 0 ? 'Cuenta de Destino (¿A dónde se fue?)' : 'Cuenta de Origen (¿De dónde vino?)'}
                                        </Label>
                                        <TreasuryAccountSelector
                                            value={openingJustifyTargetId}
                                            onChange={setOpeningJustifyTargetId}
                                            placeholder={diff < 0 ? "Seleccione destino..." : "Seleccione origen..."}
                                            excludeId={term?.default_treasury_account}
                                        />

                                        {/* Insufficient funds warning */}
                                        {openingInsufficientFunds && openingSelectedAccount && (
                                            <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-3 space-y-1">
                                                <div className="flex items-start gap-2">
                                                    <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                                                    <div className="text-sm text-red-700 dark:text-red-300">
                                                        <div className="font-bold">Fondos Insuficientes</div>
                                                        <div className="text-xs mt-1 space-y-0.5">
                                                            <div>Disponible en {openingSelectedAccount.name}: {formatCurrency(openingSelectedAccount.current_balance || 0)}</div>
                                                            <div>Necesario: {formatCurrency(Math.abs(diff))}</div>
                                                            <div className="font-semibold">Faltante: {formatCurrency(Math.abs(diff) - (openingSelectedAccount.current_balance || 0))}</div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="flex gap-2">
                            <Button variant="ghost" onClick={handlePrevStep} className="flex-1">Corregir</Button>
                            <Button
                                onClick={handleOpenSession}
                                className="flex-[2]"
                                disabled={
                                    submitting ||
                                    (hasDiff && !openingJustifyReason) ||
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
                            <h3 className="font-bold">Unirse a Caja Existente</h3>
                            <p className="text-sm text-muted-foreground">Seleccione una caja activa para operar</p>
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
                                            <Badge variant="outline" className="text-[10px] h-5">{session.user_name}</Badge>
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



    if (!currentSession) {
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
                    title="Control de Sesión de Caja"
                >
                    <div className="py-2">
                        {renderWizardStep()}
                    </div>
                </BaseModal>
            </>
        )
    }

    // Keep existing return for Active Session...
    return (
        <>
            <div className="flex items-center gap-2">
                {!hideSessionInfo && (

                    <>
                        <Badge variant={isSharedSession ? "secondary" : "outline"} className={`gap-1 px-3 py-1.5 ${isSharedSession ? 'bg-blue-100 text-blue-800 border-blue-200' : 'border-emerald-500 text-emerald-600'}`}>
                            <div className={`h-2 w-2 rounded-full ${isSharedSession ? 'bg-blue-500' : 'bg-emerald-500'} animate-pulse`} />
                            {isSharedSession ? "Caja Compartida" : "Caja Abierta"}
                        </Badge>

                        <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-3 mr-2">
                            <span className="text-sm font-medium">
                                {currentSession.treasury_account_name}
                            </span>
                            {isSharedSession && (
                                <span className="text-xs text-muted-foreground">
                                    (Titular: {currentSession.user_name})
                                </span>
                            )}
                        </div>
                    </>
                )}


            </div>

            {/* Custom Overlay for POS Reports (X and Z) - Simplified as requested */}
            {reportDialogOpen && (
                <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4 animate-in fade-in duration-200 print:hidden text-foreground">
                    <div className="w-full max-w-sm animate-in zoom-in-95 duration-200">
                        {reportData && (
                            <POSReport
                                data={reportData}
                                type={reportType}
                                title={reportType === 'Z' ? 'Informe de Cierre (Z)' : 'Informe Parcial (X)'}
                                onClose={() => setReportDialogOpen(false)}
                            />
                        )}
                    </div>
                </div>
            )}


            {/* Session Close Modal - Using shared component */}
            {currentSession && (
                <SessionCloseModal
                    open={closeDialogOpen}
                    onOpenChange={setCloseDialogOpen}
                    session={currentSession}
                    onSuccess={handleSessionCloseSuccess}
                />
            )}

            <BaseModal
                open={moveDialogOpen}
                onOpenChange={setMoveDialogOpen}
                size="md"
                title="Movimiento de Caja Manual"
            >
                <div className="py-2">
                    {moveDialogOpen && currentSession && (
                        <MovementWizard
                            context="pos"
                            fixedAccountId={currentSession.treasury_account_id || undefined}
                            fixedAccountName={currentSession.treasury_account_name}
                            maxOutboundAmount={currentSession.expected_cash}
                            onComplete={handleRegisterManualMovement}
                            onCancel={() => setMoveDialogOpen(false)}
                        />
                    )}
                </div>
            </BaseModal>
        </>
    )
})

SessionControl.displayName = "SessionControl"
