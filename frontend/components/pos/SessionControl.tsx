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
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
    Loader2, Lock, Unlock, Calculator, Banknote,
    CreditCard, ArrowRightLeft, FileText, Users, LogOut,
    Vault, AlertTriangle
} from "lucide-react"
import { toast } from "sonner"
import api from "@/lib/api"
import { POSReport } from "@/components/pos/POSReport"
import { SessionCloseModal } from "@/components/pos/SessionCloseModal"
import { CashContainerSelector } from "@/components/selectors/CashContainerSelector"
import { forwardRef, useImperativeHandle } from "react"
import { ActionConfirmModal } from "@/components/shared/ActionConfirmModal"
import { BaseModal } from "@/components/shared/BaseModal"
import { cn, translateStatus, formatCurrency } from "@/lib/utils"
import { FORM_STYLES } from "@/lib/styles"

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

interface POSSession {
    id: number
    terminal: number
    terminal_name?: string
    treasury_account: number
    treasury_account_name: string
    user: number
    user_name: string
    status: string
    status_display: string
    opened_at: string
    opening_balance: number
    total_cash_sales: number
    total_card_sales: number
    total_transfer_sales: number
    total_credit_sales: number
    expected_cash: number
    total_other_cash_inflow: number
    total_other_cash_outflow: number
}

interface SessionControlProps {
    onSessionChange?: (session: POSSession | null) => void
    hideSessionInfo?: boolean
    session?: POSSession | null
}

export interface SessionControlHandle {
    showXReport: () => void
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

    // Shared session selection
    const [selectedSharedSessionId, setSelectedSharedSessionId] = useState<string>("")

    // Close session state - simplified (modal handles its own state)
    // No longer needed, SessionCloseModal manages its own form state

    // Manual movement state
    const [moveType, setMoveType] = useState<string>("PARTNER_WITHDRAWAL")
    const [moveAmount, setMoveAmount] = useState<string>("0")
    const [moveNotes, setMoveNotes] = useState<string>("")
    const [transferTargetId, setTransferTargetId] = useState<string | null>(null)

    const [submitting, setSubmitting] = useState(false)
    const [isSharedSession, setIsSharedSession] = useState(false)

    useImperativeHandle(ref, () => ({
        showXReport: () => {
            if (currentSession) {
                handleShowXReport()
            } else {
                toast.error("No hay una sesión activa para generar el reporte")
            }
        }
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
                if (openDialogOpen && selectedTerminalId) {
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
    }, [openDialogOpen, moveDialogOpen, selectedTerminalId, openingBalance, openingJustifyReason, terminals])

    // Sync state when session prop changes (controlled mode)
    useEffect(() => {
        if (session !== undefined) {
            setCurrentSession(session)
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

    // Load available sessions and terminals when dialog opens
    useEffect(() => {
        if (openDialogOpen) {
            fetchAvailableSessions()
            fetchTerminals()
        }
    }, [openDialogOpen])

    // Autofill Opening Balance and Fund Source from Terminal Default
    useEffect(() => {
        if (openDialogOpen && selectedTerminalId) {
            const terminal = terminals.find(t => t.id === parseInt(selectedTerminalId))
            if (terminal) {
                if (terminal.default_treasury_account_balance !== undefined) {
                    setOpeningBalance(terminal.default_treasury_account_balance.toString())
                }
                if (terminal.default_treasury_account) {
                    setFundSourceId(terminal.default_treasury_account.toString())
                }
            }
        }
    }, [openDialogOpen, selectedTerminalId, terminals])

    // Removed: Autofill Destination from Terminal Default
    // No longer needed - SessionCloseModal handles its own state and autofill logic

    // Autofill Opening Balance from Fund Source
    useEffect(() => {
        const fetchAccountBalance = async () => {
            if (!fundSourceId) return
            try {
                const response = await api.get(`/treasury/accounts/${fundSourceId}/`)
                // Autofill only if balance is 0 or user hasn't typed?
                // Requirement: "should load modal of initial fund equal to treasury account"
                // So we overwrite.
                if (response.data && response.data.current_balance !== undefined) {
                    setOpeningBalance(response.data.current_balance.toString())
                }
            } catch (error) {
                console.error("Error fetching account balance:", error)
            }
        }
        fetchAccountBalance()
    }, [fundSourceId])

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

    const handleRegisterManualMovement = async () => {
        if (!currentSession) return
        const amount = parseFloat(moveAmount)
        if (amount <= 0) {
            toast.error("El monto debe ser mayor a cero")
            return
        }

        // Restriction: Cannot withdraw more than available
        const isOutflow = ["PARTNER_WITHDRAWAL", "THEFT", "OTHER_OUT"].includes(moveType)
        if (isOutflow && amount > currentSession.expected_cash) {
            toast.error(`Monto insuficiente en caja. Máximo disponible: ${formatCurrency(currentSession.expected_cash)}`)
            return
        }

        if (moveType === 'TRANSFER' && !transferTargetId) {
            toast.error("Debe seleccionar una cuenta de destino")
            return
        }

        setSubmitting(true)
        try {
            const response = await api.post(`/treasury/pos-sessions/${currentSession.id}/register_manual_movement/`, {
                type: moveType,
                amount: parseFloat(moveAmount),
                notes: moveNotes,
                target_account_id: transferTargetId ? parseInt(transferTargetId) : null
            })

            setCurrentSession(response.data.session)
            onSessionChange?.(response.data.session)
            setMoveDialogOpen(false)
            setMoveAmount("0")
            setMoveNotes("")
            setTransferTargetId(null)
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
        }
    }, [openDialogOpen])

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
                                    // If only 1 terminal, auto-select it and skip to step 3
                                    if (terminals.length === 1) {
                                        setSelectedTerminalId(terminals[0].id.toString())
                                        setWizardStep(3)
                                    } else {
                                        setWizardStep(2)
                                    }
                                }}
                            >
                                <div className="p-3 rounded-full bg-emerald-100 text-emerald-600 group-hover:scale-110 transition-transform">
                                    <Unlock className="h-6 w-6" />
                                </div>
                                <div className="text-center">
                                    <span className="font-bold text-lg block">Abrir Nueva Caja</span>
                                    <span className="text-xs text-muted-foreground">Iniciar turno en un terminal</span>
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
                                            ? `${availableSessions.length} cajas disponibles`
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
                            {terminals.map(t => (
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
                                <div className="grid grid-cols-3 gap-2">
                                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                                        <Button
                                            key={n}
                                            variant="outline"
                                            className="h-14 text-xl font-bold"
                                            onClick={() => setOpeningBalance(prev => prev === "0" ? n.toString() : prev + n)}
                                        >
                                            {n}
                                        </Button>
                                    ))}
                                    <Button
                                        variant="ghost"
                                        className="h-14 text-red-500 font-bold"
                                        onClick={() => setOpeningBalance("0")}
                                    >C</Button>
                                    <Button
                                        variant="outline"
                                        className="h-14 text-xl font-bold"
                                        onClick={() => setOpeningBalance(prev => prev === "0" ? "0" : prev + "0")}
                                    >0</Button>
                                    <Button
                                        variant="ghost"
                                        className="h-14"
                                        onClick={() => setOpeningBalance(prev => prev.slice(0, -1) || "0")}
                                    >
                                        ⌫
                                    </Button>
                                </div>

                                {terminal && terminal.default_treasury_account_balance > 0 && (
                                    <Button
                                        className="w-full mt-4 bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                                        onClick={() => setOpeningBalance(terminal.default_treasury_account_balance.toString())}
                                    >
                                        Usar Base Predefinida ({formatCurrency(terminal.default_treasury_account_balance)})
                                    </Button>
                                )}
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <Button variant="outline" onClick={handlePrevStep} className="flex-1">Atrás</Button>
                            <Button onClick={handleNextStep} className="flex-1">Continuar</Button>
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
                                    <Label className="text-xs">Motivo</Label>
                                    <Select value={openingJustifyReason} onValueChange={setOpeningJustifyReason}>
                                        <SelectTrigger className="bg-white dark:bg-black/20 h-9">
                                            <SelectValue placeholder="Seleccione motivo..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="ROUNDING">Redondeo anterior</SelectItem>
                                            <SelectItem value="COUNTING_ERROR">Error de conteo</SelectItem>
                                            <SelectItem value="OTHER_IN">Ajuste de entrada</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        )}

                        <div className="flex gap-2">
                            <Button variant="ghost" onClick={handlePrevStep} className="flex-1">Corregir</Button>
                            <Button
                                onClick={handleOpenSession}
                                className="flex-[2]"
                                disabled={submitting || (hasDiff && !openingJustifyReason)}
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

                <Dialog open={openDialogOpen} onOpenChange={setOpenDialogOpen}>
                    <DialogContent className="sm:max-w-md">
                        {renderWizardStep()}
                    </DialogContent>
                </Dialog>
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


                <Button
                    variant={hideSessionInfo ? "outline" : "ghost"}
                    size={hideSessionInfo ? "sm" : "icon"}
                    onClick={() => setMoveDialogOpen(true)}
                    title="Movimiento de Caja"
                    className={hideSessionInfo ? "px-3 gap-2" : "text-muted-foreground hover:text-primary"}
                >
                    <ArrowRightLeft className="h-4 w-4" />
                    {hideSessionInfo && "Movimiento"}
                </Button>

                {isSharedSession ? (
                    <Button
                        variant={hideSessionInfo ? "outline" : "ghost"}
                        size="icon"
                        onClick={handleDisconnect}
                        title="Desconectar de Caja"
                        className={hideSessionInfo ? "" : "text-muted-foreground hover:text-destructive"}
                    >
                        <LogOut className="h-4 w-4" />
                    </Button>
                ) : (
                    <Button
                        variant={hideSessionInfo ? "destructive" : "ghost"}
                        size={hideSessionInfo ? "sm" : "icon"}
                        onClick={() => {
                            // Show confirmation before allowing close (Z Report is irreversible)
                            const confirmed = window.confirm(
                                "⚠️ ATENCIÓN: Cerrar la sesión es IRREVERSIBLE.\n\n" +
                                "Se generará el Reporte Z (cierre definitivo) y no podrá revertir esta acción.\n\n" +
                                "¿Está seguro de que desea cerrar la caja?"
                            );

                            if (confirmed) {
                                setCloseDialogOpen(true)
                            }
                        }}
                        title="Cerrar Caja"
                        className={hideSessionInfo ? "px-3 gap-2" : "text-muted-foreground hover:text-destructive"}
                    >
                        <Lock className="h-4 w-4" />
                        {hideSessionInfo && "Cerrar Caja"}
                    </Button>
                )}
            </div>

            <Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader className="sr-only">
                        <DialogTitle>
                            {reportType === 'Z' ? 'Informe de Cierre (Z)' : 'Informe Parcial (X)'}
                        </DialogTitle>
                        <DialogDescription>
                            Detalles del informe de sesión
                        </DialogDescription>
                    </DialogHeader>
                    {reportData && (
                        <POSReport
                            data={reportData}
                            type={reportType}
                            title={reportType === 'Z' ? 'Informe de Cierre (Z)' : 'Informe Parcial (X)'}
                        />
                    )}
                    <DialogFooter>
                        <Button onClick={() => setReportDialogOpen(false)}>Cerrar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>


            {/* Session Close Modal - Using shared component */}
            {currentSession && (
                <SessionCloseModal
                    open={closeDialogOpen}
                    onOpenChange={setCloseDialogOpen}
                    session={currentSession}
                    onSuccess={handleSessionCloseSuccess}
                />
            )}

            <Dialog open={moveDialogOpen} onOpenChange={setMoveDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <ArrowRightLeft className="h-5 w-5" />
                            Registrar Movimiento de Caja
                        </DialogTitle>
                        <DialogDescription>
                            Registre ingresos o egresos manuales de efectivo.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label className={FORM_STYLES.label}>Tipo de Movimiento</Label>
                            <Select value={moveType} onValueChange={setMoveType}>
                                <SelectTrigger className={cn(FORM_STYLES.input)}>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="PARTNER_WITHDRAWAL">Retiro de Socio</SelectItem>
                                    <SelectItem value="TRANSFER">Traspaso a otra caja</SelectItem>
                                    <SelectItem value="THEFT">Robo / Pérdida</SelectItem>
                                    <SelectItem value="TIP">Propina (Ingreso)</SelectItem>
                                    <SelectItem value="ROUNDING">Redondeo</SelectItem>
                                    <SelectItem value="OTHER_IN">Otro Ingreso (Varios)</SelectItem>
                                    <SelectItem value="OTHER_OUT">Otro Egreso (Gastos Varios)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {moveType === 'TRANSFER' && (
                            <div className="space-y-2">
                                <Label className={FORM_STYLES.label}>Cuenta de Destino</Label>
                                <CashContainerSelector
                                    value={transferTargetId}
                                    onChange={setTransferTargetId}
                                    placeholder="Seleccione caja destino"
                                />
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label className={FORM_STYLES.label}>Monto ($)</Label>
                            <Input
                                type="number"
                                value={moveAmount}
                                onChange={(e) => setMoveAmount(e.target.value)}
                                placeholder="0"
                                className={cn("text-lg font-black h-12 text-right font-mono", FORM_STYLES.input)}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label className={FORM_STYLES.label}>Descripción / Notas</Label>
                            <Textarea
                                value={moveNotes}
                                onChange={(e) => setMoveNotes(e.target.value)}
                                placeholder="Especifique el motivo..."
                                rows={3}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setMoveDialogOpen(false)}>
                            Cancelar
                        </Button>
                        <Button onClick={handleRegisterManualMovement} disabled={submitting}>
                            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Registrar Movimiento
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
})

SessionControl.displayName = "SessionControl"
