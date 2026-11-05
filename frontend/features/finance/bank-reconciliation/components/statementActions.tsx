import { createEntityActions } from '@/components/shared'
import { Activity } from 'lucide-react'
import type { BankStatement } from '../types'
import { canDeleteStatement, canReconcileStatement } from '../lib/statementRules'

export interface StatementActionsCtx {
    onView: (statement: BankStatement) => void
    onReconcile: (statement: BankStatement) => void
    onDownload: (statement: BankStatement) => void
    onDelete: (statement: BankStatement) => void
}

/**
 * Acciones de una cartola. Reglas en `lib/statementRules.ts` (espejo de BankStatementService).
 * "Reconciliar" reutiliza la clave `post` del registro de filas: solo cambia su etiqueta e icono.
 */
export const statementActions = createEntityActions<BankStatement, StatementActionsCtx>((item, ctx) => [
    {
        action: 'detail',
        label: 'Ver detalle',
        onClick: (e) => { e.stopPropagation(); ctx.onView(item) },
    },
    {
        action: 'post',
        label: 'Reconciliar',
        icon: Activity,
        onClick: (e) => { e.stopPropagation(); ctx.onReconcile(item) },
        visible: canReconcileStatement(item),
    },
    {
        action: 'download',
        label: 'Descargar original',
        onClick: (e) => { e.stopPropagation(); ctx.onDownload(item) },
        visible: !!item.has_file,
    },
    {
        action: 'delete',
        label: 'Eliminar',
        onClick: (e) => { e.stopPropagation(); ctx.onDelete(item) },
        visible: item.state === 'DRAFT',
        disabled: !canDeleteStatement(item),
    },
])
