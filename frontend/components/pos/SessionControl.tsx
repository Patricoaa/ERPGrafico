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

    // Close session form state
    const [actualCash, setActualCash] = useState<string>("0")
    const [withdrawalAmount, setWithdrawalAmount] = useState<string>("0")
    const [closeNotes, setCloseNotes] = useState<string>("")
    const [cashDestinationId, setCashDestinationId] = useState<string | null>(null)
    const [justifyReason, setJustifyReason] = useState<string>("")
    const [justifyTargetId, setJustifyTargetId] = useState<string | null>(null)
    const [isJustifying, setIsJustifying] = useState(false)

    // Sync withdrawalAmount with actualCash by default
    useEffect(() => {
        setWithdrawalAmount(actualCash)
    }, [actualCash])

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
        fetchTerminals()

        // Keyboard shortcuts
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
                } else if (closeDialogOpen) {
                    handleCloseSession()
                } else if (moveDialogOpen) {
                    handleRegisterManualMovement()
                }
            }
        }

        window.addEventListener("keydown", handleKeyDown)
        return () => window.removeEventListener("keydown", handleKeyDown)
    }, [openDialogOpen, closeDialogOpen, moveDialogOpen, selectedTerminalId, openingBalance, openingJustifyReason, terminals, session])

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

    // Load available sessions when dialog opens
    useEffect(() => {
        if (openDialogOpen) {
            fetchAvailableSessions()
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

    // Autofill Destination from Terminal Default
    useEffect(() => {
        if (closeDialogOpen && currentSession && terminals.length > 0) {
            const currentTerminal = terminals.find(t => t.id === currentSession.terminal)
            if (currentTerminal && currentTerminal.default_treasury_account) {
                // Note: default_treasury_account is the ID
                setCashDestinationId(currentTerminal.default_treasury_account.toString())
            }
        }
    }, [closeDialogOpen, currentSession, terminals])

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

    const handleJustifyDifference = async () => {
        if (!currentSession) return

        const actual = parseFloat(actualCash) || 0
        const expected = currentSession.expected_cash
        const diff = actual - expected

        if (diff === 0) return

        setIsJustifying(true)
        try {
            const response = await api.post(`/treasury/pos-sessions/${currentSession.id}/register_manual_movement/`, {
                type: justifyReason,
                amount: Math.abs(diff),
                notes: `Ajuste al Cierre: ${closeNotes || 'Sin observaciones'}`,
                target_account_id: justifyReason === 'TRANSFER' ? justifyTargetId : null
            })

            setCurrentSession(response.data.session)
            onSessionChange?.(response.data.session)
            toast.success("Diferencia justificada correctamente")
            // Don't close dialog, just update session so diff disappears
        } catch (error: any) {
            toast.error(error.response?.data?.error || "Error al justificar")
        } finally {
            setIsJustifying(false)
        }
    }

    const handleCloseSession = async () => {
        if (!currentSession) return

        setSubmitting(true)
        try {
            const response = await api.post(`/treasury/pos-sessions/${currentSession.id}/close_session/`, {
                actual_cash: parseFloat(actualCash) || 0,
                withdrawal_amount: parseFloat(withdrawalAmount) || 0,
                notes: closeNotes,
                cash_destination_id: cashDestinationId ? parseInt(cashDestinationId) : null,
                justify_reason: justifyReason,
                justify_target_id: justifyTargetId
            })

            // ... (rest of logic) ...
            const audit = response.data.audit
            const difference = parseFloat(audit.difference)

            if (difference !== 0) {
                const diffType = difference > 0 ? "sobrante" : "faltante"
                toast.warning(`Caja cerrada con ${diffType} de ${formatCurrency(Math.abs(difference))}`)
            } else {
                toast.success("Caja cerrada correctamente - Cuadra perfecto!")
            }

            // Immediately fetch summary for Z Report
            const summaryResponse = await api.get(`/treasury/pos-sessions/${currentSession.id}/summary/`)
            setReportData(summaryResponse.data)
            setReportType("Z")

            // Close Closing Dialog and Open Report Dialog
            setCloseDialogOpen(false)
            setReportDialogOpen(true)

            // Reset session state
            localStorage.removeItem('shared_pos_session_id')
            setCurrentSession(null)
            onSessionChange?.(null)
            setIsSharedSession(false)
            setActualCash("0")
            setCloseNotes("")
        } catch (error: any) {
            toast.error(error.response?.data?.error || "Error al cerrar caja")
        } finally {
            setSubmitting(false)
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

    // If no session, show "Open Session" button
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
                    title="Apertura de Caja"
                    description="Seleccione un terminal y verifique el fondo inicial."
                    size="xl"
                    footer={
                        <div className="flex w-full items-center justify-between">
                            <div className="flex gap-2">
                                {(() => {
                                    const terminal = terminals.find(t => t.id === parseInt(selectedTerminalId))
                                    const expected = terminal?.default_treasury_account_balance || 0
                                    const actual = parseFloat(openingBalance) || 0
                                    if (terminal && actual !== expected) {
                                        return (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setOpeningBalance(expected.toString())}
                                                className="border-emerald-500 text-emerald-600 hover:bg-emerald-50"
                                            >
                                                <Calculator className="mr-2 h-4 w-4" />
                                                Cuadra Perfecto
                                            </Button>
                                        )
                                    }
                                    return null
                                })()}
                            </div>
                            <div className="flex gap-2">
                                <Button variant="outline" onClick={() => setOpenDialogOpen(false)}>
                                    Cancelar
                                </Button>
                                {(() => {
                                    const terminal = terminals.find(t => t.id === parseInt(selectedTerminalId))
                                    const expected = terminal?.default_treasury_account_balance || 0
                                    const actual = parseFloat(openingBalance) || 0
                                    const diff = actual - expected
                                    const hasDiff = !!selectedTerminalId && diff !== 0

                                    return (
                                        <Button
                                            onClick={handleOpenSession}
                                            disabled={submitting || (hasDiff && !openingJustifyReason)}
                                        >
                                            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                            Abrir Caja (Enter)
                                        </Button>
                                    )
                                })()}
                            </div>
                        </div>
                    }
                >
                    <Tabs defaultValue="new" className="w-full">
                        <TabsList className="grid w-full grid-cols-2 mb-6">
                            <TabsTrigger value="new">Nueva Sesión</TabsTrigger>
                            <TabsTrigger value="shared" onClick={fetchAvailableSessions}>Compartir Sesión Existente</TabsTrigger>
                        </TabsList>

                        <TabsContent value="new" className="space-y-6">
                            {(() => {
                                const terminal = terminals.find(t => t.id === parseInt(selectedTerminalId))
                                const expected = terminal?.default_treasury_account_balance || 0
                                const actual = parseFloat(openingBalance) || 0
                                const diff = actual - expected
                                const hasDiff = selectedTerminalId && diff !== 0

                                return (
                                    <div className={`grid gap-6 ${hasDiff ? 'grid-cols-1 lg:grid-cols-3' : 'grid-cols-1 md:grid-cols-2'}`}>
                                        {/* Col 1: Configuración */}
                                        <div className="space-y-4">
                                            <div className="space-y-2">
                                                <Label className={FORM_STYLES.label}>Seleccionar Terminal POS</Label>
                                                <Select value={selectedTerminalId} onValueChange={setSelectedTerminalId}>
                                                    <SelectTrigger className={cn(FORM_STYLES.input)}>
                                                        <SelectValue placeholder="Seleccione un terminal..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {terminals.map(t => (
                                                            <SelectItem key={t.id} value={t.id.toString()}>
                                                                {t.name} ({t.code})
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            {terminal && (
                                                <Card className={cn("bg-muted/30", FORM_STYLES.card)}>
                                                    <CardContent className="pt-4 space-y-2 text-sm">
                                                        <div className="flex justify-between">
                                                            <span className="text-muted-foreground">Cuenta Base:</span>
                                                            <span className="font-medium">{terminal.default_treasury_account_name}</span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span className="text-muted-foreground">Saldo en Libros:</span>
                                                            <span className="font-mono font-bold text-primary">{formatCurrency(expected)}</span>
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            )}
                                        </div>

                                        {/* Col 2: Conteo Físico */}
                                        <div className="space-y-4">
                                            <div className="space-y-2">
                                                <Label className={FORM_STYLES.label}>Fondo Inicial contado ($)</Label>
                                                <Input
                                                    type="number"
                                                    value={openingBalance}
                                                    onChange={(e) => setOpeningBalance(e.target.value)}
                                                    className={cn("text-3xl font-black h-16 text-right font-mono tracking-tight", FORM_STYLES.input)}
                                                    placeholder="0"
                                                />
                                                <p className="text-xs text-muted-foreground">
                                                    Ingrese el monto físico real que hay en la gaveta.
                                                </p>
                                            </div>
                                        </div>

                                        {/* Col 3: Diferencia de Apertura (Conditional) */}
                                        {hasDiff && (
                                            <Card className="h-full border-l-4 border-l-amber-500 shadow-sm">
                                                <CardHeader className="bg-amber-50 dark:bg-amber-950/20 pb-3">
                                                    <CardTitle className="text-amber-700 dark:text-amber-400 flex items-center gap-2 text-sm">
                                                        <AlertTriangle className="h-4 w-4" />
                                                        Diferencia en Apertura
                                                    </CardTitle>
                                                </CardHeader>
                                                <CardContent className="space-y-4 pt-4">
                                                    <div className="text-center p-3 bg-amber-50 dark:bg-amber-950/10 rounded-lg">
                                                        <div className="text-[10px] text-amber-600 dark:text-amber-500 font-bold uppercase mb-1">
                                                            {diff > 0 ? 'SOBRANTE' : 'FALTANTE'}
                                                        </div>
                                                        <div className="text-2xl font-bold text-amber-700 dark:text-amber-400">
                                                            {formatCurrency(Math.abs(diff))}
                                                        </div>
                                                    </div>

                                                    <div className="space-y-3">
                                                        <Label className="text-xs font-bold">Justificar Diferencia</Label>
                                                        <Select value={openingJustifyReason} onValueChange={setOpeningJustifyReason}>
                                                            <SelectTrigger className="h-9">
                                                                <SelectValue placeholder="Seleccione razón..." />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {diff < 0 ? (
                                                                    <>
                                                                        <SelectItem value="PARTNER_WITHDRAWAL">Retiro de Socio</SelectItem>
                                                                        <SelectItem value="TRANSFER">Traspaso Enviado (No Reg.)</SelectItem>
                                                                        <SelectItem value="THEFT">Robo / Faltante</SelectItem>
                                                                        <SelectItem value="COUNTING_ERROR">Error de Conteo</SelectItem>
                                                                        <SelectItem value="ROUNDING">Redondeo</SelectItem>
                                                                        <SelectItem value="CASHBACK">Vuelto Incorrecto</SelectItem>
                                                                        <SelectItem value="SYSTEM_ERROR">Error de Sistema</SelectItem>
                                                                        <SelectItem value="OTHER_OUT">Otro Egreso (Varios)</SelectItem>
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <SelectItem value="TRANSFER">Traspaso Recibido (No Reg.)</SelectItem>
                                                                        <SelectItem value="COUNTING_ERROR">Error de Conteo / Sobrante</SelectItem>
                                                                        <SelectItem value="ROUNDING">Redondeo</SelectItem>
                                                                        <SelectItem value="TIP">Propina</SelectItem>
                                                                        <SelectItem value="SYSTEM_ERROR">Error de Sistema</SelectItem>
                                                                        <SelectItem value="OTHER_IN">Otro Ingreso (Varios)</SelectItem>
                                                                        <SelectItem value="UNKNOWN">Desconocido</SelectItem>
                                                                    </>
                                                                )}
                                                            </SelectContent>
                                                        </Select>

                                                        {openingJustifyReason === 'TRANSFER' && (
                                                            <div className="space-y-2 border-l-2 pl-3 border-amber-200">
                                                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">
                                                                    {diff < 0 ? '¿Hacia qué cuenta?' : '¿Desde qué cuenta?'}
                                                                </Label>
                                                                <CashContainerSelector
                                                                    value={openingJustifyTargetId}
                                                                    onChange={setOpeningJustifyTargetId}
                                                                    placeholder="Seleccione cuenta..."
                                                                />
                                                            </div>
                                                        )}
                                                        <div className="bg-amber-50 dark:bg-amber-950/30 p-2 rounded text-[10px] text-amber-800 dark:text-amber-300 italic">
                                                            Se registrará un ajuste de caja automático para cuadrar el saldo contable con el físico reportado.
                                                        </div>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        )}
                                    </div>
                                )
                            })()}
                        </TabsContent>

                        <TabsContent value="shared" className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label className={FORM_STYLES.label}>Cajas Activas Disponibles</Label>
                                {availableSessions.length === 0 ? (
                                    <div className="p-4 border border-dashed rounded-xl text-center text-muted-foreground bg-muted/20">
                                        No hay cajas abiertas en este momento.
                                    </div>
                                ) : (
                                    <Select value={selectedSharedSessionId} onValueChange={setSelectedSharedSessionId}>
                                        <SelectTrigger className={cn(FORM_STYLES.input)}>
                                            <SelectValue placeholder="Seleccione una sesión abierta..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {availableSessions.map((session) => (
                                                <SelectItem key={session.id} value={session.id.toString()}>
                                                    {session.treasury_account_name} - {session.user_name} (Abierta: {new Date(session.opened_at).toLocaleTimeString()})
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                                Puede unirse a una caja abierta por otro usuario para realizar ventas en su turno (modo compartido).
                            </p>

                            <Button onClick={handleJoinSession} disabled={!selectedSharedSessionId} className="w-full mt-4" variant="secondary">
                                <Users className="mr-2 h-4 w-4" />
                                Usar Esta Caja
                            </Button>
                        </TabsContent>
                    </Tabs>
                </BaseModal>
            </>
        )
    }

    // Session is active - show status and close button
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
                                // Pre-populate expected cash
                                setActualCash(currentSession.expected_cash.toString())
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

            <BaseModal
                open={closeDialogOpen}
                onOpenChange={setCloseDialogOpen}
                title={`Cierre de Caja - ${currentSession.terminal_name}`}
                description="Verifique los montos y confirme el cierre."
                size="xl"
                footer={
                    <div className="flex w-full gap-2 sm:justify-end">
                        <Button variant="outline" onClick={() => setCloseDialogOpen(false)}>
                            Cancelar
                        </Button>
                        {(() => {
                            const actual = parseFloat(actualCash) || 0
                            const expected = currentSession.expected_cash
                            const diff = actual - expected
                            const hasDiff = diff !== 0

                            return (
                                <Button
                                    onClick={handleCloseSession}
                                    disabled={submitting || (hasDiff && !justifyReason)}
                                >
                                    {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Cerrar Caja
                                </Button>
                            )
                        })()}
                    </div>
                }
            >
                {(() => {
                    const actual = parseFloat(actualCash) || 0
                    const expected = currentSession.expected_cash
                    const diff = actual - expected
                    const hasDiff = diff !== 0

                    return (
                        <>
                            <div className={`grid gap-6 ${hasDiff ? 'grid-cols-1 lg:grid-cols-3' : 'grid-cols-1 md:grid-cols-2'}`}>
                                {/* Col 1: Resumen */}
                                <Card className={cn("h-full", FORM_STYLES.card)}>
                                    <CardHeader className="pb-2">
                                        <CardTitle className={FORM_STYLES.label}>
                                            Resumen de Sesión
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4 pt-4">
                                        <div className="space-y-2">
                                            <div className="space-y-1">
                                                <div className="flex justify-between py-1 border-b border-dashed">
                                                    <span>Fondo Inicial</span>
                                                    <span className="font-mono">{formatCurrency(currentSession.opening_balance)}</span>
                                                </div>
                                                <div className="flex justify-between py-1 border-b border-dashed">
                                                    <span>Ventas Efectivo</span>
                                                    <span className="font-mono text-emerald-600">+{formatCurrency(currentSession.total_cash_sales)}</span>
                                                </div>
                                                <div className="flex justify-between py-1 border-b border-dashed text-muted-foreground">
                                                    <span>Ventas Tarjeta</span>
                                                    <span className="font-mono">{formatCurrency(currentSession.total_card_sales)}</span>
                                                </div>
                                                <div className="flex justify-between py-1 border-b border-dashed text-muted-foreground">
                                                    <span>Ventas Transferencia</span>
                                                    <span className="font-mono">{formatCurrency(currentSession.total_transfer_sales)}</span>
                                                </div>
                                                <div className="flex justify-between py-1 border-b border-dashed text-muted-foreground">
                                                    <span>Ventas Crédito</span>
                                                    <span className="font-mono">{formatCurrency(currentSession.total_credit_sales)}</span>
                                                </div>

                                                {(currentSession.total_other_cash_inflow > 0 || currentSession.total_other_cash_outflow > 0) && (
                                                    <div className="flex justify-between py-1 border-b border-dashed">
                                                        <span>Otros Movimientos</span>
                                                        <div className="text-right font-mono text-xs">
                                                            {currentSession.total_other_cash_inflow > 0 && <span className="text-emerald-600 block">+{formatCurrency(currentSession.total_other_cash_inflow)}</span>}
                                                            {currentSession.total_other_cash_outflow > 0 && <span className="text-red-600 block">-{formatCurrency(currentSession.total_other_cash_outflow)}</span>}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="pt-4 border-t mt-auto">
                                            <div className="flex justify-between items-center text-lg font-bold">
                                                <span>Esperado</span>
                                                <span className="text-primary">{formatCurrency(expected)}</span>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Col 2: Conteo Físico */}
                                <Card className={cn("h-full", FORM_STYLES.card)}>
                                    <CardHeader className="pb-2">
                                        <CardTitle className={FORM_STYLES.label}>
                                            Conteo de Efectivo
                                        </CardTitle>
                                    </CardHeader><CardContent className="space-y-4 pt-4">
                                        <div className="space-y-2">
                                            <Label className={FORM_STYLES.label}>Efectivo en Gaveta ($)</Label>
                                            <div className="relative">
                                                <Banknote className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                                <Input
                                                    type="number"
                                                    value={actualCash}
                                                    onChange={(e) => setActualCash(e.target.value)}
                                                    placeholder="0"
                                                    className={cn("pl-10 text-2xl font-black h-14 font-mono", FORM_STYLES.input)}
                                                    autoFocus
                                                />
                                            </div>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setActualCash(expected.toString())}
                                                className="w-full mt-2 text-[10px] h-7 gap-1 border-emerald-500/30 text-emerald-600 hover:bg-emerald-50"
                                            >
                                                <Calculator className="h-3 w-3" />
                                                Cuadra Perfecto
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Col 3: Diferencia y Justificación */}
                                {hasDiff && (
                                    <Card className={cn("h-full border-l-4 shadow-sm", diff > 0 ? "border-l-blue-500" : "border-l-amber-500")}>
                                        <CardHeader className={cn("pb-3", diff > 0 ? "bg-blue-50 dark:bg-blue-950/20" : "bg-amber-50 dark:bg-amber-950/20")}>
                                            <CardTitle className={cn("flex items-center gap-2 text-sm", diff > 0 ? "text-blue-700 dark:text-blue-400" : "text-amber-700 dark:text-amber-400")}>
                                                <AlertTriangle className="h-4 w-4" />
                                                Diferencia Detallada
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-4 pt-4">
                                            <div className={cn("text-center p-3 rounded-lg", diff > 0 ? "bg-blue-50 dark:bg-blue-950/10" : "bg-amber-50 dark:bg-amber-950/10")}>
                                                <div className={cn("text-[10px] font-bold uppercase", diff > 0 ? "text-blue-600" : "text-amber-600")}>
                                                    {diff > 0 ? 'SOBRANTE' : 'FALTANTE'}
                                                </div>
                                                <div className={cn("text-2xl font-black font-mono", diff > 0 ? "text-blue-700 dark:text-blue-400" : "text-amber-700 dark:text-amber-400")}>
                                                    {formatCurrency(Math.abs(diff))}
                                                </div>
                                            </div>

                                            <div className="space-y-3">
                                                <div className="space-y-1">
                                                    <Label className="text-[10px] font-bold uppercase text-muted-foreground">Motivo de la Diferencia</Label>
                                                    <Select value={justifyReason} onValueChange={setJustifyReason}>
                                                        <SelectTrigger className={FORM_STYLES.input}>
                                                            <SelectValue placeholder="Seleccione razón..." />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {diff < 0 ? (
                                                                <>
                                                                    <SelectItem value="PARTNER_WITHDRAWAL">Retiro de Socio</SelectItem>
                                                                    <SelectItem value="TRANSFER">Traspaso Enviado (No Reg.)</SelectItem>
                                                                    <SelectItem value="THEFT">Robo / Faltante</SelectItem>
                                                                    <SelectItem value="COUNTING_ERROR">Error de Conteo</SelectItem>
                                                                    <SelectItem value="ROUNDING">Redondeo</SelectItem>
                                                                    <SelectItem value="OTHER_OUT">Otro Egreso</SelectItem>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <SelectItem value="TRANSFER">Traspaso Recibido (No Reg.)</SelectItem>
                                                                    <SelectItem value="COUNTING_ERROR">Error de Conteo / Sobrante</SelectItem>
                                                                    <SelectItem value="ROUNDING">Redondeo</SelectItem>
                                                                    <SelectItem value="TIP">Propina</SelectItem>
                                                                    <SelectItem value="OTHER_IN">Otro Ingreso</SelectItem>
                                                                </>
                                                            )}
                                                        </SelectContent>
                                                    </Select>
                                                </div>

                                                {justifyReason === 'TRANSFER' && (
                                                    <div className="space-y-1">
                                                        <Label className="text-[10px] font-medium">Cuenta Manual</Label>
                                                        <CashContainerSelector
                                                            value={justifyTargetId}
                                                            onChange={setJustifyTargetId}
                                                            placeholder="Seleccione cuenta..."
                                                        />
                                                    </div>
                                                )}

                                                <div className="space-y-1">
                                                    <Label className="text-[10px] font-medium">Notas</Label>
                                                    <Textarea
                                                        value={closeNotes}
                                                        onChange={(e) => setCloseNotes(e.target.value)}
                                                        placeholder="Detalles adicionales..."
                                                        className={cn("resize-none text-xs", FORM_STYLES.input)}
                                                        rows={2}
                                                    />
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                )}
                            </div>

                            {/* Section: Treasury Withdrawal */}
                            <div className="pt-4 border-t mt-4 space-y-4">
                                <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-widest">
                                    <Vault className="h-4 w-4" />
                                    Retiro Físico de Efectivo (Vaciado de Caja)
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <Label className={FORM_STYLES.label}>Monto a Retirar ($)</Label>
                                        <Input
                                            type="number"
                                            value={withdrawalAmount}
                                            onChange={(e) => setWithdrawalAmount(e.target.value)}
                                            className={cn("text-xl font-bold font-mono", FORM_STYLES.input)}
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className={FORM_STYLES.label}>Destino del Efectivo</Label>
                                        <CashContainerSelector
                                            value={cashDestinationId}
                                            onChange={setCashDestinationId}
                                            placeholder="Seleccione destino (ej. Bóveda)"
                                        />
                                    </div>
                                </div>
                            </div>
                        </>
                    )
                })()}
            </BaseModal>

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
