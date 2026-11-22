"use client"

import { AccountDrawer } from "@/features/finance"
import { EntitySidebar } from "@/features/comments"
import { SkeletonShell } from "@/components/shared"
import { useRecordById } from "@/hooks/useRecordById"
import { useAccounts } from "../hooks/useAccounts"
import type { Account } from "../types"

interface AccountRecordDrawerProps {
    id: number
    /** Fila de la lista, si el llamador ya la tiene (evita la consulta). */
    data?: unknown
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess?: () => void
}

/**
 * Ficha de una cuenta contable como pestaña propia (ADR-0152): carga la cuenta por id si no llega la
 * fila, trae el plan de cuentas para el selector de cuenta padre y monta la barra de comentarios.
 * La creación (con `parentId`) sigue en el panel de la página.
 */
export function AccountRecordDrawer({ id, data, open, onOpenChange, onSuccess }: AccountRecordDrawerProps) {
    const { record, isError } = useRecordById<Account>("/accounting/accounts", data ? null : id)
    const { accounts } = useAccounts()
    const account = (data as Account | undefined) ?? record
    if (!account) return isError ? null : <SkeletonShell isLoading ariaLabel="Cargando cuenta contable" />
    return (
        <AccountDrawer
            accounts={accounts as unknown as Record<string, unknown>[]}
            initialData={account as unknown as Record<string, unknown>}
            auditSidebar={<EntitySidebar entityId={account.id} entityType="account" />}
            mode="edit"
            open={open}
            onOpenChange={onOpenChange}
            onSuccess={() => onSuccess?.()}
        />
    )
}
