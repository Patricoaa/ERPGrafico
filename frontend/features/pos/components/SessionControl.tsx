"use client"

import { showApiError } from "@/lib/errors"
import { useState, useEffect } from "react"

import { MovementWizard, type MovementData } from "@/features/treasury"
import { toast } from "sonner"
import { posApi } from "../api/posApi"
import { POSReport, type POSReportData } from "@/features/pos/components/POSReport"
import { SessionCloseModal } from "@/features/pos/components/SessionCloseModal"
import { Chip, SubmitButton } from "@/components/shared"
import { forwardRef, useImperativeHandle } from "react"
import { useOperatorGate } from "../operator"

import { cn } from "@/lib/utils"
import type { POSSession } from "@/types/pos"

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
    /** Hand over a session opened or joined from `SessionOpenView` (persists shared-session state, toasts). */
    acceptOpenedSession: (session: POSSession, mode: 'open' | 'join') => void
}

export const SessionControl = forwardRef<SessionControlHandle, SessionControlProps>(({ onSessionChange, hideSessionInfo = false, session }, ref) => {
    const [loading, setLoading] = useState(session === undefined)
    const [closeDialogOpen, setCloseDialogOpen] = useState(false)
    const [reportDialogOpen, setReportDialogOpen] = useState(false)
    const [moveDialogOpen, setMoveDialogOpen] = useState(false)
    const [reportData, setReportData] = useState<POSReportData | null>(null)
    const [reportType, setReportType] = useState<"X" | "Z">("X")

    const [isSharedSession, setIsSharedSession] = useState(false)

    const { ensureOperator, forget } = useOperatorGate()

    // En cajas multiusuario, identificar al operador antes de abrir el cierre o el movimiento.
    const handleRequestClose = async () => {
        if (await ensureOperator('SESSION_CLOSE')) setCloseDialogOpen(true)
    }
    const handleShowMoveDialog = async () => {
        if (await ensureOperator('CASH_MOVEMENT')) setMoveDialogOpen(true)
    }

    useImperativeHandle(ref, () => ({
        showXReport: () => {
            if (session) {
                handleShowXReport()
            } else {
                toast.error("No hay una sesión de POS activa para generar el reporte")
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
        showMoveDialog: () => { void handleShowMoveDialog() },
        requestCloseSession: () => { void handleRequestClose() },
        disconnectSharedSession: handleDisconnect,
        acceptOpenedSession: (sessionData, mode) => handleOpenSuccess(sessionData, mode)
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
            toast.error("Error al verificar la sesión de POS activa")
        } finally {
            setLoading(false)
        }
    }

    // State sync after SessionOpenView opens (mode 'open') or joins (mode 'join') a session
    const handleOpenSuccess = (sessionData: POSSession, mode: 'open' | 'join') => {
        onSessionChange?.(sessionData)
        setReportDialogOpen(false)
        if (mode === 'join') {
            localStorage.setItem('shared_pos_session_id', sessionData.id.toString())
            setIsSharedSession(true)
            toast.success(`Unido a la sesión de POS de ${sessionData.user_name}`)
        } else {
            localStorage.removeItem('shared_pos_session_id')
            setIsSharedSession(false)
            toast.success("Sesión de POS abierta correctamente")
        }
    }

    const handleDisconnect = () => {
        localStorage.removeItem('shared_pos_session_id')
        onSessionChange?.(null)
        setIsSharedSession(false)
        toast.info("Desconectado de la sesión de POS compartida")
        setLoading(true)
        fetchCurrentSession()
    }

    // Cerrada la caja se vuelve a la pantalla de apertura; el informe Z ya no se muestra (queda
    // disponible en PDF desde el resumen del conteo y desde la sesión).
    const handleSessionCloseSuccess = () => {
        forget() // el pase de cierre ya fue consumido

        localStorage.removeItem('shared_pos_session_id')
        onSessionChange?.(null)
        setIsSharedSession(false)
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
            forget() // el pase de un solo uso ya lo consumió el backend
            toast.success(moveResponse.message)
        } catch (error: unknown) {
            showApiError(error, "Error al registrar movimiento")
        }
    }

    const reportOverlay = reportDialogOpen && (
        <div className="fixed inset-0 z-[100] bg-overlay/50 flex items-center justify-center p-4 animate-in fade-in duration-200 print:hidden text-foreground motion-reduce:animate-none">
            <div className="w-full max-w-sm animate-in zoom-in-95 duration-200 space-y-3 motion-reduce:animate-none">
                {reportData && (
                    <POSReport
                        data={reportData}
                        type={reportType}
                        title="Informe Parcial (X)"
                        onClose={() => setReportDialogOpen(false)}
                    />
                )}
            </div>
        </div>
    )

    if (loading) {
        if (hideSessionInfo) return null
        return (
            <SubmitButton variant="outline" loading className="gap-2 text-muted-foreground border-border/50">
                Cargando...
            </SubmitButton>
        )
    }

    // Sin sesión: la apertura vive en SessionOpenView (pantalla completa).
    if (!session || session.status !== 'OPEN') {
        return null
    }

    return (
        <>
            {!hideSessionInfo && (
                <div className="flex items-center gap-2">
                    <span className={cn(
                        "gap-1 px-3 py-1.5 flex items-center text-3xs font-bold uppercase rounded-full border",
                        isSharedSession ? 'bg-primary/10 text-primary border-primary/20' : 'border-success/30 text-success bg-success/5'
                    )}>
                        <div className={cn("h-2 w-2 rounded-full animate-pulse motion-reduce:animate-none", isSharedSession ? 'bg-primary' : 'bg-success')} />
                        {isSharedSession ? "Sesión de POS compartida" : "Sesión de POS abierta"}
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
                        {session.my_mode === "MULTI" && (
                            <Chip size="xs" intent="neutral">Multiusuario</Chip>
                        )}
                    </div>
                </div>
            )}

            {reportOverlay}

            <SessionCloseModal
                open={closeDialogOpen}
                onOpenChange={setCloseDialogOpen}
                session={session}
                onSuccess={handleSessionCloseSuccess}
            />

            {moveDialogOpen && (
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
