"use client"

import React, { useState } from "react"
import { notFound, useRouter } from "next/navigation"
import { useAccountDetail } from "../hooks"
import { EntityDetailPage, FormFooter, SubmitButton, CancelButton, SkeletonShell } from "@/components/shared"
import { AccountDrawer } from "@/features/finance/components/AccountDrawer"
import { Button } from "@/components/ui/button"
import { Book } from "lucide-react"

interface AccountDetailClientProps {
    accountId: string
}

export function AccountDetailClient({ accountId }: AccountDetailClientProps) {
    const { data: account, isLoading: loading, error: queryError } = useAccountDetail(accountId)
 
    const router = useRouter()
    const [isSaving, setIsSaving] = useState(false)

    const error = queryError ? (queryError as any).response?.status || 500 : null

    if (error === 404) return notFound()
    if (error) return <div className="p-8 text-destructive">Error al cargar la cuenta</div>
    
    if (loading || !account) {
         return (
             <div className="flex-1 p-8">
                 <SkeletonShell isLoading={loading || !account} ariaLabel="Cargando detalle de cuenta contable" />
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
                <AccountDrawer 
                    open={true}
                    inline={true}
                    mode={account.children_count > 0 ? 'view' : 'edit'}
                    onOpenChange={(open) => {
                        if (!open) router.push('/accounting/ledger')
                    }}
                    initialData={account} 
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
