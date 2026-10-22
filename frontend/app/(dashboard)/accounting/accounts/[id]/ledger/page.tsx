"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { SkeletonShell } from '@/components/shared'
import { Collection, useEntityCollection } from "@/components/entity-view"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { JournalEntryDrawer, useLedger, useJournalEntry, ledgerMovementEntity, ledgerMovementPageViews } from "@/features/accounting"
import type { JournalEntryInitialData } from "@/types/forms"
import type { LedgerMovement } from "@/features/accounting/types"

export default function AccountLedgerPage() {
    const params = useParams()
    const router = useRouter()
    const accountId = params.id as string

    const { data: ledger, isLoading } = useLedger(Number(accountId))
    const [selectedEntryId, setSelectedEntryId] = useState<number | null>(null)
    const { data: selectedEntryData } = useJournalEntry(selectedEntryId ?? undefined)

    const account = ledger?.account ?? null
    const movements = (ledger?.movements ?? []) as LedgerMovement[]

    const collection = useEntityCollection(
        ledgerMovementEntity,
        { rows: isLoading ? [] : movements },
        { pagination: { mode: "none" } },
    )

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
                <Collection.Root
                    collection={collection}
                    onOpen={(mov: LedgerMovement) => setSelectedEntryId(mov.entry_id)}
                >
                    <Collection.View
                        table={ledgerMovementPageViews.table}
                        emptyTitle="Sin movimientos"
                        emptyDescription="Esta cuenta no tiene movimientos contables."
                    />
                </Collection.Root>
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
