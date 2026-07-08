"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { DataTable, DataCell, SkeletonShell } from '@/components/shared'
import { type ColumnDef } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { JournalEntryDrawer, useLedger, useJournalEntry } from "@/features/accounting"
import type { JournalEntryInitialData } from "@/types/forms"

export default function AccountLedgerPage() {
    const params = useParams()
    const router = useRouter()
    const accountId = params.id as string

    const { data: ledger, isLoading } = useLedger(Number(accountId))
    const [selectedEntryId, setSelectedEntryId] = useState<number | null>(null)
    const { data: selectedEntryData } = useJournalEntry(selectedEntryId ?? undefined)

    const account = ledger?.account ?? null
    const movements = (ledger?.movements ?? []) as unknown as Record<string, unknown>[]

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

    if (isLoading) {
        return <div><SkeletonShell isLoading ariaLabel="Cargando..." /></div>
    }

    if (!account) {
        return <div>Cuenta no encontrada</div>
    }

    return (
        <div className="h-full flex flex-col">
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
                defaultPageSize={50}
            />
            </div>

            <JournalEntryDrawer
                open={selectedEntryId !== null}
                onOpenChange={(open) => { if (!open) setSelectedEntryId(null) }}
                initialData={selectedEntryData as unknown as JournalEntryInitialData}
                onSuccess={() => { setSelectedEntryId(null) }}
            />
        </div>
    )
}
