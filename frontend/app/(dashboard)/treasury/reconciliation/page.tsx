"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Upload, FileText, CheckCircle2, Clock, AlertCircle, BarChart3, Wand2, Eye } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import api from "@/lib/api"
import { StatementImportDialog } from "@/features/treasury"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { ColumnDef } from "@tanstack/react-table"
import { DataCell } from "@/components/ui/data-table-cells"
import { PageHeader, PageHeaderButton } from "@/components/shared/PageHeader"
import { Progress } from "@/components/ui/progress"

interface BankStatement {
    id: number
    display_id: string
    treasury_account_name: string
    statement_date: string
    opening_balance: string
    closing_balance: string
    total_lines: number
    reconciled_lines: number
    reconciliation_progress: number
    state: 'DRAFT' | 'CONFIRMED' | 'CANCELLED'
    state_display: string
    imported_by_name: string
    imported_at: string
}

export default function ReconciliationPage() {
    const router = useRouter()
    const [statements, setStatements] = useState<BankStatement[]>([])
    const [loading, setLoading] = useState(true)
    const [importDialogOpen, setImportDialogOpen] = useState(false)

    useEffect(() => {
        fetchStatements()
    }, [])

    const fetchStatements = async () => {
        try {
            setLoading(true)
            const response = await api.get('/treasury/statements/')
            setStatements(response.data)
        } catch (error) {
            console.error('Error fetching statements:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleImportSuccess = () => {
        fetchStatements()
        setImportDialogOpen(false)
    }

    const columns: ColumnDef<BankStatement>[] = [
        {
            accessorKey: "display_id",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="ID" />
            ),
            cell: ({ row }) => <DataCell.Code className="font-bold">{row.getValue("display_id")}</DataCell.Code>,
        },
        {
            accessorKey: "treasury_account_name",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Cuenta" />
            ),
            cell: ({ row }) => <DataCell.Text>{row.getValue("treasury_account_name")}</DataCell.Text>,
        },
        {
            accessorKey: "statement_date",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Fecha" />
            ),
            cell: ({ row }) => <DataCell.Date value={row.getValue("statement_date")} />,
        },
        {
            accessorKey: "opening_balance",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Apertura" />
            ),
            cell: ({ row }) => <DataCell.Currency value={row.getValue("opening_balance")} className="text-muted-foreground" />,
        },
        {
            accessorKey: "closing_balance",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Cierre" />
            ),
            cell: ({ row }) => <DataCell.Currency value={row.getValue("closing_balance")} className="font-bold text-foreground" />,
        },
        {
            id: "lines_info",
            header: "Líneas",
            cell: ({ row }) => (
                <div className="flex flex-col">
                    <span className="font-semibold text-xs">{row.original.total_lines} total</span>
                    <span className="text-[10px] text-muted-foreground">
                        {row.original.reconciled_lines} rec.
                    </span>
                </div>
            ),
        },
        {
            accessorKey: "reconciliation_progress",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Progreso" />
            ),
            cell: ({ row }) => {
                const progress = parseFloat(row.getValue("reconciliation_progress") as string)
                return (
                    <div className="flex items-center gap-2 min-w-[100px]">
                        <Progress value={progress} className="h-2" />
                        <span className="text-[10px] font-medium w-8">
                            {progress}%
                        </span>
                    </div>
                )
            },
        },
        {
            accessorKey: "state",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Estado" />
            ),
            cell: ({ row }) => {
                const state = row.getValue("state") as string
                const variant = state === 'CONFIRMED' ? 'success' : state === 'CANCELLED' ? 'destructive' : 'secondary'
                return (
                    <DataCell.Badge variant={variant}>
                        {row.original.state_display}
                    </DataCell.Badge>
                )
            },
        },
        {
            id: "actions",
            header: "Acción",
            cell: ({ row }) => (
                <div className="flex justify-center">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => router.push(`/treasury/reconciliation/${row.original.id}`)}
                    >
                        <Eye className="h-4 w-4 text-primary" />
                    </Button>
                </div>
            ),
        },
    ]

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <PageHeader
                title="Conciliación Bancaria"
                description="Gestión de cartolas y cuadratura de movimientos bancarios."
                titleActions={
                    <PageHeaderButton
                        onClick={() => setImportDialogOpen(true)}
                        icon={Upload}
                        circular
                        title="Importar cartola"
                    />
                }
            >
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => router.push('/treasury/reconciliation/dashboard')}>
                        <BarChart3 className="mr-2 h-4 w-4" />
                        Dashboard
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => router.push('/treasury/reconciliation/rules')}>
                        <Wand2 className="mr-2 h-4 w-4" />
                        Reglas
                    </Button>
                </div>
            </PageHeader>

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card className="border-l-4 border-l-blue-500 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Total cartolas</CardTitle>
                        <FileText className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{statements.length}</div>
                        <p className="text-[10px] text-muted-foreground mt-1">Sincronizados en sistema</p>
                    </CardContent>
                </Card>

                <Card className="border-l-4 border-l-green-500 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Confirmados</CardTitle>
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {statements.filter(s => s.state === 'CONFIRMED').length}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1">Cerrados y auditados</p>
                    </CardContent>
                </Card>

                <Card className="border-l-4 border-l-yellow-500 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Borradores</CardTitle>
                        <Clock className="h-4 w-4 text-yellow-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {statements.filter(s => s.state === 'DRAFT').length}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1">Pendientes de completar</p>
                    </CardContent>
                </Card>

                <Card className="border-l-4 border-l-gray-400 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Líneas Totales</CardTitle>
                        <AlertCircle className="h-4 w-4 text-gray-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {statements.reduce((acc, s) => acc + s.total_lines, 0)}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1">Transacciones procesadas</p>
                    </CardContent>
                </Card>
            </div>

            {/* Main Content */}
            {loading ? (
                <div className="flex justify-center items-center h-64">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
            ) : (
                <div className="bg-card rounded-xl border shadow-sm">
                    <DataTable
                        columns={columns}
                        data={statements}
                        filterColumn="display_id"
                        searchPlaceholder="Buscar por ID..."
                        facetedFilters={[
                            {
                                column: "state",
                                title: "Estado",
                                options: [
                                    { label: "Borrador", value: "DRAFT" },
                                    { label: "Confirmado", value: "CONFIRMED" },
                                    { label: "Anulado", value: "CANCELLED" },
                                ]
                            }
                        ]}
                        useAdvancedFilter={true}
                        defaultPageSize={10}
                    />
                </div>
            )}

            {/* Import Dialog */}
            <StatementImportDialog
                open={importDialogOpen}
                onOpenChange={setImportDialogOpen}
                onSuccess={handleImportSuccess}
            />
        </div>
    )
}
