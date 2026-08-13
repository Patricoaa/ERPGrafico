"use client"
import { formatCurrency } from "@/lib/money"

import { showApiError } from "@/lib/errors"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"

import {
    Unlock
} from "lucide-react"
import { MovementWizard, type MovementData } from "@/features/treasury"
import { toast } from "sonner"
import { posApi } from "../api/posApi"
import { POSReport, type POSReportData } from "@/features/pos/components/POSReport"
import { SessionCloseModal } from "@/features/pos/components/SessionCloseModal"
import { SessionOpenModal } from "@/features/pos/components/SessionOpenModal"
import { ActionSlideButton } from '@/components/shared'
import { forwardRef, useImperativeHandle } from "react"

import { cn } from "@/lib/utils"
import type { POSSession, POSSessionAudit } from "@/types/pos"

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

    const [isSharedSession, setIsSharedSession] = useState(false)

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

    // State sync after SessionOpenModal opens (mode 'open') or joins (mode 'join') a session
    const handleOpenSuccess = (sessionData: POSSession, mode: 'open' | 'join') => {
        onSessionChange?.(sessionData)
        setOpenDialogOpen(false)
        setReportDialogOpen(false)
        if (mode === 'join') {
            localStorage.setItem('shared_pos_session_id', sessionData.id.toString())
            setIsSharedSession(true)
            toast.success(`Unido a la sesión de ${sessionData.user_name}`)
        } else {
            localStorage.removeItem('shared_pos_session_id')
            setIsSharedSession(false)
            toast.success("Sesión iniciada correctamente")
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
        }
    }

    if (loading) {
        return (
            <ActionSlideButton variant="muted" loading className="gap-2">
                Cargando...
            </ActionSlideButton>
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
                    Iniciar Sesión
                </Button>

                <SessionOpenModal
                    open={openDialogOpen}
                    onOpenChange={setOpenDialogOpen}
                    onSuccess={handleOpenSuccess}
                />
            </>
        )
    }

    return (
        <>
            <div className="flex items-center gap-2">
                {!hideSessionInfo && session && (
                    <>
                        <span className={cn(
                            "gap-1 px-3 py-1.5 flex items-center text-3xs font-bold uppercase rounded-full border",
                            isSharedSession ? 'bg-primary/10 text-primary border-primary/20' : 'border-success/30 text-success bg-success/5'
                        )}>
                            <div className={cn("h-2 w-2 rounded-full animate-pulse", isSharedSession ? 'bg-primary' : 'bg-success')} />
                            {isSharedSession ? "Sesión Compartida" : "Sesión Abierta"}
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
                    fixedAccountName={session.treasury_account_name ?? undefined}
                    maxOutboundAmount={session.expected_cash}
                    onComplete={handleRegisterManualMovement}
                    onCancel={() => setMoveDialogOpen(false)}
                />
            )}

        </>
    )
})

SessionControl.displayName = "SessionControl"
