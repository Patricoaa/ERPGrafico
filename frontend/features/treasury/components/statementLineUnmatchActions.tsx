import { DataCell, createEntityActions } from '@/components/shared'
import { Undo2 } from 'lucide-react'

export interface StatementLineUnmatchActionsCtx {
    onUnmatch: (lineId: number) => void
    canUnmatch?: (item: unknown) => boolean
}

export const statementLineUnmatchActions = createEntityActions<unknown, StatementLineUnmatchActionsCtx>((item, ctx) => {
    const canUnmatch = ctx.canUnmatch?.(item) ?? true
    return canUnmatch ? (
        <DataCell.Action
            icon={Undo2}
            title="Deshacer reconciliación"
            className="text-muted-foreground hover:text-destructive"
            onClick={() => {
                const line = item as { id: number }
                ctx.onUnmatch(line.id)
            }}
        />
    ) : <></>
})
