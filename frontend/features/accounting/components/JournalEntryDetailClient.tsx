"use client"

import React, { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { notFound, useRouter } from "next/navigation"
import api from "@/lib/api"
import { EntityDetailPage, FormFooter, SubmitButton, CancelButton, FormSkeleton } from "@/components/shared"
import { JournalEntryForm } from "./JournalEntryForm"

interface JournalEntryDetailClientProps {
    entryId: string
}

export function JournalEntryDetailClient({ entryId }: JournalEntryDetailClientProps) {
    const { data: entry, isLoading: loading, error: queryError } = useQuery({
        queryKey: ['journalEntry', entryId],
        queryFn: async () => {
            const res = await api.get(`/accounting/entries/${entryId}/`)
            return res.data
        }
    })

    const error = queryError ? (queryError as any).response?.status || 500 : null

    if (error === 404) return notFound()
    if (error) return <div className="p-8 text-destructive">Error al cargar el asiento</div>
    
    if (loading || !entry) {
        return (
            <div className="flex-1 p-8">
                <FormSkeleton />
            </div>
        )
    }

    const isPosted = entry.state === 'POSTED'

    return (
        <EntityDetailPage
            entityLabel="accounting.journalentry"
            displayId={entry.reference || `AS-${entry.number}`}
            breadcrumb={[
                { label: "Asientos", href: "/accounting/entries" },
                { label: entry.reference || `AS-${entry.number}`, href: `/accounting/entries/${entryId}` }
            ]}
            instanceId={entry.id}
            readonly={isPosted}
            footer={
                <FormFooter
                    actions={
                        <>
                            <CancelButton onClick={() => router.push('/accounting/entries')} disabled={isSaving} />
                            {!isPosted && (
                                <SubmitButton form="journal-entry-form" loading={isSaving}>
                                    Actualizar Asiento
                                </SubmitButton>
                            )}
                        </>
                    }
                />
            }
        >
            <div className="max-w-5xl mx-auto h-full">
                <JournalEntryForm 
                    open={true}
                    inline={true}
                    onOpenChange={(open) => {
                        if (!open) router.push('/accounting/entries')
                    }}
                    initialData={entry} 
                    onLoadingChange={setIsSaving}
                    onSuccess={() => {
                        router.push('/accounting/entries')
                        router.refresh()
                    }} 
                />
            </div>
        </EntityDetailPage>
    )
}
