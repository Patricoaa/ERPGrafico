"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { DataTable, DataCell, SkeletonShell } from '@/components/shared'
import { ColumnDef } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import api from "@/lib/api"
import { toast } from "sonner"
import { JournalEntryDrawer } from "@/features/accounting"
import { useJournalEntry } from "@/features/accounting/hooks/useJournalEntries"
import type { JournalEntryInitialData } from "@/types/forms"

export default function AccountLedgerPage() {
    const params = useParams()
    const router = useRouter()
    const accountId = params.id as string

    const [account, setAccount] = useState<{ id: number, code: string, name: string } | null>(null)
    const [movements, setMovements] = useState<Record<string, unknown>[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedEntryId, setSelectedEntryId] = useState<number | null>(null)
    const { data: selectedEntryData } = useJournalEntry(selectedEntryId ?? undefined)

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

    const columns: ColumnDef<Record<string, unknown>>[] = [
        {
            accessorKey: "date",
            header: "Fecha",
            cell: ({ row }) => <DataCell.Date value={row.getValue("date") as string} />,
        },
        {
            id: "reference",
            header: "Referencia",
            cell: ({ row }) => {
                const mov = row.original as { reference?: string, entry_id?: number, source_document?: { url: string, type: string, name: string } }
                return (
                    <div className="flex flex-col">
                        <DataCell.Link onClick={() => setSelectedEntryId(mov.entry_id as number)}>
                            {mov.reference || `Asiento ${mov.entry_id}`}
                        </DataCell.Link>
                        {mov.source_document && (
                            <DataCell.Link href={mov.source_document.url} external>
                                {mov.source_document.type}: {mov.source_document.name}
                            </DataCell.Link>
                        )}
                    </div>
                )
            },
        },
        {
            accessorKey: "description",
            header: "Descripción",
            cell: ({ row }) => <DataCell.Text className="max-w-md truncate">{row.getValue("description") as string}</DataCell.Text>,
        },
        {
            accessorKey: "partner",
            header: "Tercero",
            cell: ({ row }) => <DataCell.Secondary>{row.getValue("partner") as string}</DataCell.Secondary>,
        },
        {
            accessorKey: "debit",
            header: "Debe",
            cell: ({ row }) => {
                const debit = parseFloat(row.getValue("debit") as string);
                return debit > 0 ? <DataCell.Currency value={debit} /> : <DataCell.Currency value={null} />;
            },
        },
        {
            accessorKey: "credit",
            header: "Haber",
            cell: ({ row }) => {
                const credit = parseFloat(row.getValue("credit") as string);
                return credit > 0 ? <DataCell.Currency value={credit} /> : <DataCell.Currency value={null} />;
            },
        },
        {
            accessorKey: "balance",
            header: "Saldo",
            cell: ({ row }) => <DataCell.Currency value={parseFloat(row.getValue("balance") as string)} />,
        },
    ]

    if (loading) {
        return <div><SkeletonShell isLoading ariaLabel="Cargando..." /></div>
    }

    if (!account) {
        return <div>Cuenta no encontrada</div>
    }

    return (
        <div className="space-y-6 h-full flex flex-col">
            <div className="flex items-center gap-4 shrink-0">
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

            <div className="flex-1 min-h-0">
                <DataTable
                    columns={columns}
                    data={movements}
                    variant="embedded"
                useAdvancedFilter={true}
                globalFilterFields={["date", "description", "partner"]}
                searchPlaceholder="Buscar por fecha, descripción o tercero..."
                defaultPageSize={50}
            />
            </div>

            <JournalEntryDrawer
                open={selectedEntryId !== null}
                onOpenChange={(open) => { if (!open) setSelectedEntryId(null) }}
                initialData={selectedEntryData as unknown as JournalEntryInitialData}
                onSuccess={() => { fetchLedger(); setSelectedEntryId(null) }}
            />
        </div>
    )
}
