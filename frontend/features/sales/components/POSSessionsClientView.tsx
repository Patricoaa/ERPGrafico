"use client"
import { useState, useEffect } from "react"

import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { useSelectedEntity } from "@/hooks/useSelectedEntity"

import { DataTableView, DataTableColumnHeader, EntityCard, StatusBadge, SegmentationBar, useSegmentation } from '@/components/shared'
import { ColumnDef } from "@tanstack/react-table"
import { DataCell } from '@/components/shared'
import { posSessionActions, type POSSessionActionsCtx } from "@/features/sales/posSessionActions"
import { toast } from "sonner"
import { POSReport } from "@/features/pos/components/POSReport"
import { SessionCloseModal } from "@/features/pos/components/SessionCloseModal"
import { fetchPOSSessionSummary } from "@/features/pos/hooks/usePOSSessions"

export interface POSSession {
    id: number
    id_display: string
    user_name: string
    treasury_account: number
    treasury_account_name: string
    opened_at: string
    closed_at: string | null
    status: 'OPEN' | 'CLOSED' | 'CLOSING'
    status_display: string
    start_amount: number
    current_cash?: number
    expected_cash: number
    terminal_name?: string
    opening_balance: number
    total_cash_sales: number
    total_card_sales: number
    total_transfer_sales: number
    total_credit_sales: number
    total_other_cash_inflow: number
    total_other_cash_outflow: number
}

interface POSSessionsClientViewProps {
    hideHeader?: boolean
}

import { usePOSSessions } from "@/features/pos/hooks/usePOSSessions"
import { posSessionSegDef } from "@/features/pos/segmentationDef"

export const POSSessionsClientView = ({ hideHeader = false }: POSSessionsClientViewProps) => {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const basePeriod = { serverParamFrom: 'date_from', serverParamTo: 'date_to' }
    const { filters: segFilters, isFiltered: isSegFiltered, clearAll: clearSeg } = useSegmentation(posSessionSegDef, basePeriod)
    const { sessions, isLoading, refetch } = usePOSSessions(segFilters)

    const { entity: selectedFromUrl, clearSelection } = useSelectedEntity<POSSession>({
        endpoint: '/treasury/pos-sessions'
    })

    const [selectedSession, setSelectedSession] = useState<POSSession | null>(null)
    const [reportDialogOpen, setReportDialogOpen] = useState(false)
    const [reportData, setReportData] = useState<Record<string, unknown> | null>(null)
    const [reportType, setReportType] = useState<"X" | "Z">("X")
    const [closeDialogOpen, setCloseDialogOpen] = useState(false)

    const handleShowReport = async (session: POSSession, type: "X" | "Z") => {
        try {
            const data = await fetchPOSSessionSummary<Record<string, unknown>>(session.id)
            setReportData(data)
            setReportType(type)
            setReportDialogOpen(true)
        } catch (error) {
            console.error("Error fetching report:", error)
            toast.error("Error al generar el reporte")
        }
    }

    useEffect(() => {
        if (selectedFromUrl) {
            requestAnimationFrame(() => {
                setSelectedSession(selectedFromUrl)
                // Decide what to open. If it's closed, maybe show report Z.
                // If it's open, maybe show report X.
                // For now, let's just open report X by default if selected.
                handleShowReport(selectedFromUrl, selectedFromUrl.status === 'CLOSED' ? 'Z' : 'X')
            })
        }
    }, [selectedFromUrl])

    const handleCloseSuccess = async () => {
        if (!selectedSession) return
        try {
            const data = await fetchPOSSessionSummary<Record<string, unknown>>(selectedSession.id)
            setReportData(data)
            setReportType("Z")
            setReportDialogOpen(true)
            refetch()
        } catch (error) {
            console.error("Error fetching Z report:", error)
        }
    }

    const actionsCtx: POSSessionActionsCtx = {
        onReport: (session, type) => {
            const params = new URLSearchParams(searchParams.toString())
            params.set('selected', String(session.id))
            router.push(`${pathname}?${params.toString()}`, { scroll: false })
        },
        onCloseRegister: (session) => {
            setSelectedSession(session)
            setCloseDialogOpen(true)
        },
    }

    const columns: ColumnDef<POSSession>[] = [
        {
            accessorKey: "id",
            header: ({ column }) => <DataTableColumnHeader column={column} title="ID" className="justify-center" />,
            cell: ({ row }) => (
                <div className="flex justify-center w-full">
                    <DataCell.Code className="font-bold">SES-{row.original.id}</DataCell.Code>
                </div>
            ),
        },
        {
            accessorKey: "user_name",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Cajero" className="justify-center" />,
            cell: ({ row }) => (
                <div className="flex justify-center w-full">
                    <DataCell.Text>{row.getValue("user_name")}</DataCell.Text>
                </div>
            ),
        },
        {
            accessorKey: "opened_at",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Apertura" className="justify-center" />,
            cell: ({ row }) => (
                <div className="flex justify-center w-full">
                    <DataCell.Date value={row.getValue("opened_at")} showTime />
                </div>
            ),
        },
        {
            accessorKey: "closed_at",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Cierre" className="justify-center" />,
            cell: ({ row }) => {
                const val = row.getValue("closed_at") as string
                return (
                    <div className="flex justify-center w-full">
                        {val ? <DataCell.Date value={val} showTime /> : <span className="text-muted-foreground">-</span>}
                    </div>
                )
            },
        },
        {
            accessorKey: "start_amount",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Fondo Inicial" className="justify-center" />,
            cell: ({ row }) => (
                <div className="flex justify-center w-full">
                    <DataCell.Currency value={row.getValue("start_amount")} className="text-muted-foreground" />
                </div>
            ),
        },
        {
            accessorKey: "status",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Estado" className="justify-center" />,
            cell: ({ row }) =>
                <DataCell.Status status={row.original.status} />,
        },
        posSessionActions.column(actionsCtx),
    ]

    return (
        <div className="h-full flex flex-col">
            <div className="flex-1 min-h-0">
                <DataTableView
                    columns={columns}
                    data={sessions}
                    variant="embedded"
                    isLoading={isLoading}
                    entityLabel="pos.session"
                    segmentation={<SegmentationBar def={posSessionSegDef} basePeriod={basePeriod} />}
                    showReset={isSegFiltered}
                    onReset={clearSeg}
                    defaultPageSize={10}
                    isFiltered={isSegFiltered}
                    emptyState={{
                        context: "pos",
                        title: "Aún no hay sesiones de caja",
                        description: "Las sesiones del punto de venta aparecerán aquí al abrir caja.",
                    }}
                    renderCard={(session: POSSession) => (
                        <EntityCard onClick={() => {
                            const params = new URLSearchParams(searchParams.toString())
                            params.set('selected', String(session.id))
                            router.push(`${pathname}?${params.toString()}`, { scroll: false })
                        }} actions={posSessionActions.render(session, actionsCtx)}>
                            <EntityCard.Header
                                title={session.id_display}
                                subtitle={session.user_name}
                                trailing={<StatusBadge status={session.status} label={session.status_display} size="sm" />}
                            />
                            <EntityCard.Body>
                                <EntityCard.Field label="Cuenta" value={session.treasury_account_name} />
                                <EntityCard.Field label="Apertura" value={<DataCell.Date value={session.opened_at} showTime />} />
                            </EntityCard.Body>
                            <EntityCard.Footer className="justify-between items-center border-t bg-muted/10 py-2 px-4">
                                <span className="text-[10px] font-black text-muted-foreground uppercase">Ventas</span>
                                <DataCell.Currency value={(session.total_cash_sales ?? 0) + (session.total_card_sales ?? 0)} className="font-bold" />
                            </EntityCard.Footer>
                        </EntityCard>
                    )}
                />
            </div>

            {/* Custom Overlay for POS Reports (X and Z) - Consistency with POS */}
            {reportDialogOpen && (
                <div className="fixed inset-0 z-[100] bg-background/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200 print:hidden text-foreground">
                    <div className="w-full max-w-sm animate-in zoom-in-95 duration-200">
                        {reportData && (
                            <POSReport
                                data={reportData as any}
                                type={reportType}
                                title={reportType === 'Z' ? 'Informe de Cierre (Z)' : 'Informe Parcial (X)'}
                                onClose={() => {
                                    setReportDialogOpen(false)
                                    clearSelection()
                                }}
                            />
                        )}
                    </div>
                </div>
            )}

            {selectedSession && <SessionCloseModal open={closeDialogOpen} onOpenChange={setCloseDialogOpen} session={selectedSession as any} onSuccess={handleCloseSuccess} />}
        </div>
    )
}
