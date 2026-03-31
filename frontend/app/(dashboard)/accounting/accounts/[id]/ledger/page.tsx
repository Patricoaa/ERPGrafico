"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { ColumnDef } from "@tanstack/react-table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import api from "@/lib/api"
import { toast } from "sonner"

export default function AccountLedgerPage() {
    const params = useParams()
    const router = useRouter()
    const accountId = params.id as string

    const [account, setAccount] = useState<any>(null)
    const [movements, setMovements] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (accountId) {
            fetchLedger()
        }
    }, [accountId])

    const fetchLedger = async () => {
        try {
            const res = await api.get(`/accounting/accounts/${accountId}/ledger/`)
            setAccount(res.data.account)
            setMovements(res.data.movements)
        } catch (error) {
            toast.error("Error al cargar el libro mayor")
        } finally {
            setLoading(false)
        }
    }

    const columns: ColumnDef<any>[] = [
        {
            accessorKey: "date",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Fecha" />
            ),
        },
        {
            id: "reference",
            header: "Referencia",
            cell: ({ row }) => {
                const mov = row.original
                return (
                    <div className="flex flex-col">
                        <a href={`/accounting/entries`} className="text-primary hover:underline text-sm font-medium">
                            {mov.reference || `Asiento ${mov.entry_id}`}
                        </a>
                        {mov.source_document && (
                            <a href={mov.source_document.url} className="text-[10px] text-muted-foreground hover:text-primary underline uppercase font-bold">
                                {mov.source_document.type}: {mov.source_document.name}
                            </a>
                        )}
                    </div>
                )
            },
        },
        {
            accessorKey: "description",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Descripción" />
            ),
            cell: ({ row }) => <div className="max-w-md truncate">{row.getValue("description")}</div>,
        },
        {
            accessorKey: "partner",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Tercero" />
            ),
            cell: ({ row }) => <div className="text-sm text-muted-foreground">{row.getValue("partner")}</div>,
        },
        {
            accessorKey: "debit",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Debe" />
            ),
            cell: ({ row }) => {
                const debit = parseFloat(row.getValue("debit"));
                return <div className="text-right font-mono">{debit > 0 ? `$${debit.toLocaleString()}` : '-'}</div>
            },
        },
        {
            accessorKey: "credit",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Haber" />
            ),
            cell: ({ row }) => {
                const credit = parseFloat(row.getValue("credit"));
                return <div className="text-right font-mono">{credit > 0 ? `$${credit.toLocaleString()}` : '-'}</div>
            },
        },
        {
            accessorKey: "balance",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Saldo" />
            ),
            cell: ({ row }) => <div className="text-right font-mono font-bold">${parseFloat(row.getValue("balance")).toLocaleString()}</div>,
        },
    ]

    if (loading) {
        return <div className="p-6">Cargando...</div>
    }

    if (!account) {
        return <div className="p-6">Cuenta no encontrada</div>
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Libro Mayor</h1>
                    <p className="text-muted-foreground">
                        {account.code} - {account.name}
                    </p>
                </div>
            </div>

            <DataTable
                columns={columns}
                data={movements}
                cardMode
                useAdvancedFilter={true}
                globalFilterFields={["date", "description", "partner"]}
                searchPlaceholder="Buscar por fecha, descripción o tercero..."
                defaultPageSize={50}
            />
        </div>
    )
}
