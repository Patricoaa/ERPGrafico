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
import { Loader2, Lock, Unlock, Calculator, Banknote, CreditCard, ArrowRightLeft, FileText, Users, LogOut } from "lucide-react"
import { toast } from "sonner"
import api from "@/lib/api"
import { POSReport } from "@/components/pos/POSReport"
import { CashContainerSelector } from "@/components/selectors/CashContainerSelector"
import { forwardRef, useImperativeHandle } from "react"
import { ActionConfirmModal } from "@/components/shared/ActionConfirmModal"
import { cn, translateStatus, formatCurrency } from "@/lib/utils"

interface POSTerminal {
    id: number
    name: string
    code: string
    location: string
    is_active: boolean
    default_treasury_account: number
    default_treasury_account_name: string
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
}

export interface SessionControlHandle {
    showXReport: () => void
}

export const SessionControl = forwardRef<SessionControlHandle, SessionControlProps>(({ onSessionChange, hideSessionInfo = false }, ref) => {
    const [currentSession, setCurrentSession] = useState<POSSession | null>(null)
    const [loading, setLoading] = useState(true)
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

    // Shared session selection
    const [selectedSharedSessionId, setSelectedSharedSessionId] = useState<string>("")

    // Close session form state
    const [actualCash, setActualCash] = useState<string>("0")
    const [closeNotes, setCloseNotes] = useState<string>("")
    const [cashDestinationId, setCashDestinationId] = useState<string | null>(null)

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
        if (storedSharedId) {
            fetchSharedSession(parseInt(storedSharedId))
        } else {
            fetchCurrentSession()
        }
        fetchTerminals()
    }, [])

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

    const handleOpenSession = async () => {
        if (!selectedTerminalId) {
            toast.error("Debe seleccionar un terminal")
            return
        }

        setSubmitting(true)
        try {
            const response = await api.post('/treasury/pos-sessions/open_session/', {
                terminal_id: parseInt(selectedTerminalId),
                opening_balance: parseFloat(openingBalance) || 0,
                fund_source_id: fundSourceId ? parseInt(fundSourceId) : null
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

    const handleCloseSession = async () => {
        if (!currentSession) return

        setSubmitting(true)
        try {
            const response = await api.post(`/treasury/pos-sessions/${currentSession.id}/close_session/`, {
                actual_cash: parseFloat(actualCash) || 0,
                notes: closeNotes,
                cash_destination_id: cashDestinationId ? parseInt(cashDestinationId) : null
            })

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

                <Dialog open={openDialogOpen} onOpenChange={setOpenDialogOpen}>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <Unlock className="h-5 w-5" />
                                Gestión de Caja
                            </DialogTitle>
                            <DialogDescription>
                                Abra una nueva caja o únase a una existente.
                            </DialogDescription>
                        </DialogHeader>

                        <Tabs defaultValue="new" className="w-full">
                            <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="new">Nueva Caja</TabsTrigger>
                                <TabsTrigger value="join">Unirse a Caja</TabsTrigger>
                            </TabsList>

                            <TabsContent value="new" className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label>Seleccionar Terminal POS</Label>
                                    <Select value={selectedTerminalId} onValueChange={setSelectedTerminalId}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Seleccione un terminal..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {terminals.length === 0 ? (
                                                <div className="p-4 text-sm text-center text-muted-foreground">
                                                    No hay terminales activos disponibles
                                                </div>
                                            ) : (
                                                terminals.map((terminal) => (
                                                    <SelectItem key={terminal.id} value={terminal.id.toString()}>
                                                        <div className="flex flex-col">
                                                            <span>{terminal.name}</span>
                                                            <span className="text-xs text-muted-foreground">
                                                                {terminal.code} • {terminal.default_treasury_account_name}
                                                            </span>
                                                        </div>
                                                    </SelectItem>
                                                ))
                                            )}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label>Fondo Inicial ($)</Label>
                                    <Input
                                        type="number"
                                        value={openingBalance}
                                        onChange={(e) => setOpeningBalance(e.target.value)}
                                        placeholder="0"
                                    />
                                </div>

                                {parseFloat(openingBalance) > 0 && (
                                    <div className="space-y-2">
                                        <Label>Origen de Fondo de Apertura</Label>
                                        <CashContainerSelector
                                            value={fundSourceId}
                                            onChange={setFundSourceId}
                                            placeholder="¿De dónde sale el efectivo?"
                                        />
                                        <p className="text-[10px] text-muted-foreground italic">
                                            Recomendado para trazabilidad física si retira dinero de una caja fuerte.
                                        </p>
                                    </div>
                                )}

                                <Button onClick={handleOpenSession} disabled={submitting} className="w-full mt-4">
                                    {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Abrir Turno Personal
                                </Button>
                            </TabsContent>

                            <TabsContent value="join" className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label>Cajas Activas Disponibles</Label>
                                    {availableSessions.length === 0 ? (
                                        <div className="p-4 border rounded-md text-center text-muted-foreground bg-muted/20">
                                            No hay cajas abiertas en este momento.
                                        </div>
                                    ) : (
                                        <Select value={selectedSharedSessionId} onValueChange={setSelectedSharedSessionId}>
                                            <SelectTrigger>
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
                    </DialogContent>
                </Dialog>
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

            <Dialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Calculator className="h-5 w-5" />
                            Cierre de Caja / Arqueo
                        </DialogTitle>
                        <DialogDescription>
                            Cuente el efectivo en caja y registre el monto.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        {/* Session Summary */}
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm">Resumen de la Sesión</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground flex items-center gap-1">
                                        <Banknote className="h-3 w-3" /> Fondo Inicial
                                    </span>
                                    <span>{formatCurrency(currentSession.opening_balance)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground flex items-center gap-1">
                                        <Banknote className="h-3 w-3" /> Ventas Efectivo
                                    </span>
                                    <span>{formatCurrency(currentSession.total_cash_sales)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground flex items-center gap-1">
                                        <CreditCard className="h-3 w-3" /> Ventas Tarjeta
                                    </span>
                                    <span>{formatCurrency(currentSession.total_card_sales)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground flex items-center gap-1">
                                        <ArrowRightLeft className="h-3 w-3" /> Ventas Transferencia
                                    </span>
                                    <span>{formatCurrency(currentSession.total_transfer_sales)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground flex items-center gap-1">
                                        <FileText className="h-3 w-3" /> Ventas Crédito
                                    </span>
                                    <span>{formatCurrency(currentSession.total_credit_sales)}</span>
                                </div>
                                {(currentSession.total_other_cash_inflow > 0 || currentSession.total_other_cash_outflow > 0) && (
                                    <>
                                        <div className="border-t my-2" />
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground flex items-center gap-1">
                                                <ArrowRightLeft className="h-3 w-3" /> Otros Ingresos
                                            </span>
                                            <span className="text-emerald-600">+{formatCurrency(currentSession.total_other_cash_inflow)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground flex items-center gap-1">
                                                <ArrowRightLeft className="h-3 w-3" /> Otros Egresos
                                            </span>
                                            <span className="text-red-600">-{formatCurrency(currentSession.total_other_cash_outflow)}</span>
                                        </div>
                                    </>
                                )}
                                <div className="border-t pt-2 flex justify-between font-semibold">
                                    <span>Efectivo Esperado</span>
                                    <span className="text-primary">
                                        {formatCurrency(currentSession.expected_cash)}
                                    </span>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Actual Cash Input */}
                        <div className="space-y-2">
                            <Label>Efectivo Contado ($)</Label>
                            <Input
                                type="number"
                                value={actualCash}
                                onChange={(e) => setActualCash(e.target.value)}
                                className="text-lg font-semibold"
                            />
                            {parseFloat(actualCash) !== currentSession.expected_cash && (
                                <p className={`text-sm font-medium ${parseFloat(actualCash) > currentSession.expected_cash
                                    ? 'text-emerald-600'
                                    : 'text-red-600'
                                    }`}>
                                    Diferencia: {formatCurrency(parseFloat(actualCash) - currentSession.expected_cash)}
                                    {parseFloat(actualCash) > currentSession.expected_cash ? ' (Sobrante)' : ' (Faltante)'}
                                </p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label>Notas (opcional)</Label>
                            <Textarea
                                value={closeNotes}
                                onChange={(e) => setCloseNotes(e.target.value)}
                                placeholder="Observaciones del arqueo..."
                                rows={2}
                            />
                        </div>

                        {parseFloat(actualCash) > 0 && (
                            <div className="space-y-2 border-t pt-4">
                                <Label>Destino del Efectivo Contado</Label>
                                <CashContainerSelector
                                    value={cashDestinationId}
                                    onChange={setCashDestinationId}
                                    placeholder="¿Dónde depositará el dinero?"
                                />
                                <p className="text-[10px] text-muted-foreground italic">
                                    El saldo del contenedor seleccionado aumentará automáticamente.
                                </p>
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCloseDialogOpen(false)}>
                            Cancelar
                        </Button>
                        <Button onClick={handleCloseSession} disabled={submitting}>
                            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Cerrar Caja
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

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
                            <Label>Motivo del Movimiento</Label>
                            <Select value={moveType} onValueChange={setMoveType}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="PARTNER_WITHDRAWAL">Retiro de Socio</SelectItem>
                                    <SelectItem value="TRANSFER">Transferencia a otra caja</SelectItem>
                                    <SelectItem value="THEFT">Robo / Pérdida</SelectItem>
                                    <SelectItem value="OTHER_IN">Otro Ingreso (Varios)</SelectItem>
                                    <SelectItem value="OTHER_OUT">Otro Egreso (Gastos Varios)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {moveType === 'TRANSFER' && (
                            <div className="space-y-2">
                                <Label>Cuenta de Destino</Label>
                                <CashContainerSelector
                                    value={transferTargetId}
                                    onChange={setTransferTargetId}
                                    placeholder="Seleccione caja destino"
                                />
                                <p className="text-[10px] text-muted-foreground">
                                    El dinero saldrá de esta caja hacia la seleccionada.
                                </p>
                            </div>
                        )}

                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <Label>Monto ($)</Label>
                                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                                    Disponible: {formatCurrency(currentSession.expected_cash)}
                                </span>
                            </div>
                            <Input
                                type="number"
                                value={moveAmount}
                                onChange={(e) => setMoveAmount(e.target.value)}
                                placeholder="0"
                                className="text-lg font-semibold"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Descripción / Notas</Label>
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
