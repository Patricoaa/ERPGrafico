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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, Lock, Unlock, Calculator, Banknote, CreditCard, ArrowRightLeft, FileText } from "lucide-react"
import { toast } from "sonner"
import api from "@/lib/api"

interface TreasuryAccount {
    id: number
    name: string
    account_type: string
    allows_cash: boolean
}

interface POSSession {
    id: number
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
}

interface SessionControlProps {
    onSessionChange?: (session: POSSession | null) => void
}

export function SessionControl({ onSessionChange }: SessionControlProps) {
    const [currentSession, setCurrentSession] = useState<POSSession | null>(null)
    const [loading, setLoading] = useState(true)
    const [openDialogOpen, setOpenDialogOpen] = useState(false)
    const [closeDialogOpen, setCloseDialogOpen] = useState(false)
    const [accounts, setAccounts] = useState<TreasuryAccount[]>([])

    // Open session form state
    const [selectedAccountId, setSelectedAccountId] = useState<string>("")
    const [openingBalance, setOpeningBalance] = useState<string>("0")

    // Close session form state
    const [actualCash, setActualCash] = useState<string>("0")
    const [closeNotes, setCloseNotes] = useState<string>("")

    const [submitting, setSubmitting] = useState(false)

    // Fetch current session on mount
    useEffect(() => {
        fetchCurrentSession()
        fetchAccounts()
    }, [])

    const fetchCurrentSession = async () => {
        try {
            const response = await api.get('/treasury/pos-sessions/current/')
            if (response.data && response.data.id) {
                setCurrentSession(response.data)
                onSessionChange?.(response.data)
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

    const fetchAccounts = async () => {
        try {
            const response = await api.get('/treasury/accounts/')
            const results = response.data.results || response.data
            // Filter to cash-enabled accounts
            const cashAccounts = results.filter((a: TreasuryAccount) => a.allows_cash)
            setAccounts(cashAccounts)
        } catch (error) {
            console.error("Error fetching accounts:", error)
        }
    }

    const handleOpenSession = async () => {
        if (!selectedAccountId) {
            toast.error("Debe seleccionar una caja")
            return
        }

        setSubmitting(true)
        try {
            const response = await api.post('/treasury/pos-sessions/open_session/', {
                treasury_account_id: parseInt(selectedAccountId),
                opening_balance: parseFloat(openingBalance) || 0
            })

            setCurrentSession(response.data)
            onSessionChange?.(response.data)
            setOpenDialogOpen(false)
            toast.success("Caja abierta correctamente")
        } catch (error: any) {
            toast.error(error.response?.data?.error || "Error al abrir caja")
        } finally {
            setSubmitting(false)
        }
    }

    const handleCloseSession = async () => {
        if (!currentSession) return

        setSubmitting(true)
        try {
            const response = await api.post(`/treasury/pos-sessions/${currentSession.id}/close_session/`, {
                actual_cash: parseFloat(actualCash) || 0,
                notes: closeNotes
            })

            const audit = response.data.audit
            const difference = parseFloat(audit.difference)

            if (difference !== 0) {
                const diffType = difference > 0 ? "sobrante" : "faltante"
                toast.warning(`Caja cerrada con ${diffType} de $${Math.abs(difference).toLocaleString()}`)
            } else {
                toast.success("Caja cerrada correctamente - Cuadra perfecto!")
            }

            setCurrentSession(null)
            onSessionChange?.(null)
            setCloseDialogOpen(false)
            setActualCash("0")
            setCloseNotes("")
        } catch (error: any) {
            toast.error(error.response?.data?.error || "Error al cerrar caja")
        } finally {
            setSubmitting(false)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center gap-2 text-muted-foreground">
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
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <Unlock className="h-5 w-5" />
                                Abrir Caja
                            </DialogTitle>
                            <DialogDescription>
                                Seleccione la caja e ingrese el fondo inicial.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label>Caja</Label>
                                <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seleccione una caja" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {accounts.map((account) => (
                                            <SelectItem key={account.id} value={account.id.toString()}>
                                                {account.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Fondo de Caja Inicial ($)</Label>
                                <Input
                                    type="number"
                                    value={openingBalance}
                                    onChange={(e) => setOpeningBalance(e.target.value)}
                                    placeholder="0"
                                />
                                <p className="text-xs text-muted-foreground">
                                    Monto de efectivo con el que inicia el turno
                                </p>
                            </div>
                        </div>

                        <DialogFooter>
                            <Button variant="outline" onClick={() => setOpenDialogOpen(false)}>
                                Cancelar
                            </Button>
                            <Button onClick={handleOpenSession} disabled={submitting}>
                                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Abrir Caja
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </>
        )
    }

    // Session is active - show status and close button
    return (
        <>
            <div className="flex items-center gap-3">
                <Badge variant="outline" className="gap-1 px-3 py-1.5 border-emerald-500 text-emerald-600">
                    <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    Caja Abierta
                </Badge>
                <span className="text-sm text-muted-foreground">
                    {currentSession.treasury_account_name}
                </span>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                        // Pre-populate expected cash
                        setActualCash(currentSession.expected_cash.toString())
                        setCloseDialogOpen(true)
                    }}
                    className="gap-1"
                >
                    <Lock className="h-4 w-4" />
                    Cerrar Caja
                </Button>
            </div>

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
                                    <span>${currentSession.opening_balance.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground flex items-center gap-1">
                                        <Banknote className="h-3 w-3" /> Ventas Efectivo
                                    </span>
                                    <span>${currentSession.total_cash_sales.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground flex items-center gap-1">
                                        <CreditCard className="h-3 w-3" /> Ventas Tarjeta
                                    </span>
                                    <span>${currentSession.total_card_sales.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground flex items-center gap-1">
                                        <ArrowRightLeft className="h-3 w-3" /> Ventas Transferencia
                                    </span>
                                    <span>${currentSession.total_transfer_sales.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground flex items-center gap-1">
                                        <FileText className="h-3 w-3" /> Ventas Crédito
                                    </span>
                                    <span>${currentSession.total_credit_sales.toLocaleString()}</span>
                                </div>
                                <div className="border-t pt-2 flex justify-between font-semibold">
                                    <span>Efectivo Esperado</span>
                                    <span className="text-primary">
                                        ${currentSession.expected_cash.toLocaleString()}
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
                                    Diferencia: ${(parseFloat(actualCash) - currentSession.expected_cash).toLocaleString()}
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
        </>
    )
}
