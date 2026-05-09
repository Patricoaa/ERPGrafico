"use client"

import React, { useState, useEffect } from "react"
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
    const [account, setAccount] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<number | null>(null)
    const [isSaving, setIsSaving] = useState(false)
    const router = useRouter()

    const { accounts: flatAccounts } = useAccounts()

    useEffect(() => {
        api.get(`/accounting/accounts/${accountId}/`)
            .then(res => setAccount(res.data))
            .catch(err => setError(err.response?.status || 500))
            .finally(() => setLoading(false))
    }, [accountId])

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
            entityType="account"
            title="Cuenta Contable"
            displayId={account.code}
            icon="tag"
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
