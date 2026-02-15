"use client"

import { useState, useEffect, lazy, Suspense } from "react"
import { DataTable } from "@/components/ui/data-table"
import { ColumnDef } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { Plus, ArrowRight, Eye } from "lucide-react"
import { formatCurrency, formatPlainDate } from "@/lib/utils"
import api from "@/lib/api"
import { toast } from "sonner"
import { PageHeader, PageHeaderButton } from "@/components/shared/PageHeader"
import { Badge } from "@/components/ui/badge"

// Lazy load heavy components
const CashMovementModal = lazy(() => import("./CashMovementModal"))
const TransactionViewModal = lazy(() => import("@/components/shared/TransactionViewModal"))

interface TreasuryMovement {
    id: number
    display_id: string
    movement_type: 'INBOUND' | 'OUTBOUND' | 'TRANSFER' | 'ADJUSTMENT'
    movement_type_display: string
    payment_method: string
    payment_method_display: string
    amount: number
    created_at: string
    date: string
    created_by_name: string
    notes: string
    pos_session: number | null
    from_account: number | null
    from_account_name: string | null
    to_account: number | null
    to_account_name: string | null
    justify_reason: string | null
    justify_reason_display: string | null
    partner_name: string | null
    reference: string | null
    involved_accounts?: string[]
    document_info?: {
        type: string | null
        id: number | null
        number: string | null
        label: string | null
    } | null
}

export function TreasuryMovementsClientView() {
    const [movements, setMovements] = useState<TreasuryMovement[]>([])
    const [loading, setLoading] = useState(true)
    const [openModal, setOpenModal] = useState(false)
    const [detailsOpen, setDetailsOpen] = useState(false)
    const [selectedMovementId, setSelectedMovementId] = useState<number | string>(0)

    const fetchMovements = async () => {
        try {
            setLoading(true)
            const response = await api.get('/treasury/movements/')
            setMovements(response.data.results || response.data)
        } catch (error) {
            console.error("Failed to fetch movements", error)
            toast.error("Error al cargar los movimientos.")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchMovements()
    }, [])

    const handleViewDetails = (id: number) => {
        setSelectedMovementId(id)
        setDetailsOpen(true)
    }

    const columns: ColumnDef<TreasuryMovement>[] = [
        {
            accessorKey: "display_id",
            header: "Folio",
            cell: ({ row }) => (
                <span className="font-mono text-[10px] font-bold text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded border border-border/50">
                    {row.getValue("display_id")}
                </span>
            ),
        },
        {
            accessorKey: "date",
            header: "Fecha",
            cell: ({ row }) => (
                <div className="flex flex-col">
                    <span className="font-medium text-xs">{formatPlainDate(row.getValue("date"))}</span>
                </div>
            ),
        },
        {
            accessorKey: "movement_type",
            header: "Tipo",
            cell: ({ row }) => {
                const type = row.getValue("movement_type") as string
                let label = row.original.movement_type_display
                if (type === 'INBOUND') label = "Depósito"
                if (type === 'OUTBOUND') label = "Retiro"
                if (type === 'TRANSFER') label = "Traspaso"
                if (type === 'ADJUSTMENT') label = "Ajuste"

                let variant: "default" | "destructive" | "outline" | "secondary" = "outline"
                if (type === 'INBOUND') variant = "default"
                if (type === 'OUTBOUND') variant = "destructive"
                if (type === 'TRANSFER' || type === 'ADJUSTMENT') variant = "secondary"

                return (
                    <Badge variant={variant} className="text-[10px] uppercase font-bold tracking-tight px-2 py-0">
                        {label}
                    </Badge>
                )
            },
        },
        {
            id: "flow",
            header: "Flujo",
            cell: ({ row }) => {
                const m = row.original;
                const type = m.movement_type;
                let source = "Particular";
                let destination = "Caja";

                if (type === 'TRANSFER') {
                    source = m.from_account_name || 'Origen';
                    destination = m.to_account_name || 'Destino';
                } else if (type === 'INBOUND') {
                    source = m.partner_name || 'Origen Externo';
                    destination = m.to_account_name || 'Caja';
                } else if (type === 'OUTBOUND') {
                    source = m.from_account_name || 'Caja';
                    destination = m.partner_name || 'Destino Externo';
                } else if (type === 'ADJUSTMENT') {
                    source = m.from_account_name || 'Ajuste';
                    destination = m.to_account_name || 'Ajuste';
                }

                return (
                    <div className="flex items-center gap-2 text-xs py-1">
                        <span className="font-bold text-muted-foreground truncate max-w-[100px]" title={source}>
                            {source}
                        </span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground opacity-50 flex-shrink-0" />
                        <span className="font-bold truncate max-w-[100px]" title={destination}>
                            {destination}
                        </span>
                    </div>
                );
            },
        },
        {
            accessorKey: "payment_method",
            header: "Método",
            cell: ({ row }) => (
                <Badge variant="outline" className="text-[10px] h-5 font-mono uppercase bg-muted/30">
                    {row.original.payment_method_display}
                </Badge>
            )
        },
        {
            id: "reference",
            header: "Referencia / Documento",
            cell: ({ row }) => {
                const m = row.original;
                const doc = m.document_info;
                const motive = m.justify_reason_display;

                if (doc) {
                    return (
                        <div className="flex flex-col">
                            <span className="text-xs font-semibold text-primary/80">{doc.label}</span>
                            {m.reference && <span className="text-[10px] text-muted-foreground italic">{m.reference}</span>}
                        </div>
                    )
                }

                return (
                    <span className="text-xs text-muted-foreground italic">
                        {motive || m.reference || "-"}
                    </span>
                )
            }
        },
        {
            accessorKey: "amount",
            header: () => <div className="text-right">Monto</div>,
            cell: ({ row }) => {
                const amount = parseFloat(row.getValue("amount"))
                const type = row.getValue("movement_type") as string
                const colorClass = type === 'OUTBOUND' ? 'text-destructive' : 'text-success'
                return <div className={`text-right font-bold font-mono ${colorClass}`}>{formatCurrency(amount)}</div>
            },
        },
        {
            id: "origin",
            header: "Origen / Sistema",
            cell: ({ row }) => {
                const session = row.original.pos_session
                if (session) {
                    return (
                        <Badge variant="outline" className="font-mono text-[10px] w-fit bg-info/5 border-info/20 text-info">
                            POS #{session}
                        </Badge>
                    )
                }
                return (
                    <Badge variant="secondary" className="text-[10px] w-fit bg-muted/50 text-muted-foreground">
                        SISTEMA
                    </Badge>
                )
            },
        },
        {
            accessorKey: "created_by_name",
            header: "Usuario",
            cell: ({ row }) => (
                <span className="text-xs text-muted-foreground truncate max-w-[100px]">
                    {row.getValue("created_by_name")}
                </span>
            ),
        },
        {
            id: "actions",
            cell: ({ row }) => (
                <div className="flex justify-end">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-primary"
                        onClick={() => handleViewDetails(row.original.id)}
                        title="Ver Detalle"
                    >
                        <Eye className="h-4 w-4" />
                    </Button>
                </div>
            )
        }
    ]

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <PageHeader
                title="Movimientos de Tesorería"
                description="Registro histórico de ingresos, egresos y traslados de fondos."
                titleActions={
                    <PageHeaderButton
                        onClick={() => setOpenModal(true)}
                        icon={Plus}
                        circular
                        title="Nuevo Movimiento"
                    />
                }
            />

            <Suspense fallback={null}>
                <CashMovementModal
                    open={openModal}
                    onOpenChange={(open: boolean) => setOpenModal(open)}
                    onSuccess={fetchMovements}
                />
            </Suspense>

            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <div className="text-muted-foreground">Cargando movimientos...</div>
                </div>
            ) : (
                <DataTable
                    columns={columns}
                    data={movements}
                    globalFilterFields={["notes", "reference", "partner_name", "from_account_name", "to_account_name"]}
                    searchPlaceholder="Buscar movimientos..."
                    useAdvancedFilter={true}
                    facetedFilters={[
                        {
                            column: "movement_type",
                            title: "Tipo",
                            options: [
                                { label: "Depósito", value: "INBOUND" },
                                { label: "Retiro", value: "OUTBOUND" },
                                { label: "Traspaso", value: "TRANSFER" },
                                { label: "Ajuste", value: "ADJUSTMENT" },
                            ],
                        },
                    ]}
                />
            )}

            <Suspense fallback={null}>
                <TransactionViewModal
                    open={detailsOpen}
                    onOpenChange={setDetailsOpen}
                    type="payment"
                    id={selectedMovementId}
                    view="details"
                />
            </Suspense>
        </div>
    )
}

export default TreasuryMovementsClientView
