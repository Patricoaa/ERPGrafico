import { createEntityFields } from '@/components/shared'

interface PricingRule {
    id: number
    name: string
    rule_type: "FIXED" | "DISCOUNT_PERCENTAGE"
    rule_type_display: string
    active: boolean
}

export const pricingRuleFields = createEntityFields<PricingRule>()({
    id: { key: 'id', type: 'code', label: 'Código Interno' },
    name: { key: 'name', type: 'text', label: 'Nombre' },
    ruleTypeDisplay: { key: 'rule_type_display', type: 'text', label: 'Tipo' },
    active: {
        key: 'active',
        type: 'status',
        label: 'Estado',
        get: (r) => r.active ? 'active' : 'inactive',
        getLabel: (r) => r.active ? 'Activo' : 'Inactivo',
    },
})
