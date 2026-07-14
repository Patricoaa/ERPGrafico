import { createEntityActions } from '@/components/shared'
import type { PricingRule } from './hooks/usePricingRules'

export interface PricingRuleActionsCtx {
    onEdit: (item: PricingRule) => void
    onDelete: (id: number) => void
}

export const pricingRuleActions = createEntityActions<
    PricingRule,
    PricingRuleActionsCtx
>((item, ctx) => [
    { action: "edit", onClick: () => ctx.onEdit(item) },
    { action: "delete", onClick: () => ctx.onDelete(item.id) },
])
