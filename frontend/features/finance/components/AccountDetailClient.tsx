"use client"

import React, { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { notFound, useRouter } from "next/navigation"
import api from "@/lib/api"
import { EntityDetailPage, FormFooter, SubmitButton, CancelButton, FormSkeleton } from "@/components/shared"
import { AccountForm } from "@/features/finance/components/AccountForm"
import { useAccounts } from "@/features/accounting/hooks/useAccounts"
import { Button } from "@/components/ui/button"
import { Book } from "lucide-react"

interface AccountDetailClientProps {
    accountId: string
}

export function AccountDetailClient({ accountId }: AccountDetailClientProps) {
    const { data: account, isLoading: loading, error: queryError } = useQuery({
        queryKey: ['account', accountId],
        queryFn: async () => {
            const res = await api.get(`/accounting/accounts/${accountId}/`)
            return res.data
        }
    })

    const error = queryError ? (queryError as any).response?.status || 500 : null

    if (error === 404) return notFound()
    if (error) return <div className="p-8 text-destructive">Error al cargar la cuenta</div>
    
    if (loading || !account) {
        return (
            <div className="flex-1 p-8">
                <FormSkeleton />
            </div>
        )
    }

    return (
        <EntityDetailPage
            entityLabel="accounting.account"
            displayId={account.code}
            breadcrumb={[
                { label: "Plan de Cuentas", href: "/accounting/ledger" },
                { label: account.name, href: `/accounting/accounts/${accountId}` }
            ]}
            instanceId={account.id}
            readonly={account.children_count > 0} // Si tiene hijos, no es hoja y no es editable directamente desde aquí
            footer={
                <FormFooter
                    actions={
                        <>
                            <CancelButton onClick={() => router.push('/accounting/ledger')} disabled={isSaving} />
                            <Button 
                                variant="outline" 
                                onClick={() => router.push(`/accounting/accounts/${accountId}/ledger`)}
                                type="button"
                                disabled={isSaving}
                            >
                                <Book className="w-4 h-4 mr-2" />
                                Ver Libro Mayor
                            </Button>
                            {(!account.children_count || account.children_count === 0) && (
                                <SubmitButton form="account-form" loading={isSaving}>
                                    Guardar Cambios
                                </SubmitButton>
                            )}
                        </>
                    }
                />
            }
        >
            <div className="max-w-5xl mx-auto h-full">
                <AccountForm 
                    open={true}
                    inline={true}
                    onOpenChange={(open) => {
                        if (!open) router.push('/accounting/ledger')
                    }}
                    initialData={account} 
                    accounts={flatAccounts as any}
                    onLoadingChange={setIsSaving}
                    onSuccess={() => {
                        router.push('/accounting/ledger')
                        router.refresh()
                    }} 
                />
            </div>
        </EntityDetailPage>
    )
}
