// Feature `partners` (socios): composición societaria, libro auxiliar y distribuciones de utilidades.
// Dominio, API y tipos viven aún en `@/features/contacts` (ADR-0132).
export { PartnersView } from './components/PartnersView'
export { PartnerDrawer } from './components/PartnerDrawer'
export { ProfitDistributionDrawer } from './components/ProfitDistributionDrawer'
export { PartnerDistributionsPanel } from './components/PartnerDistributionsPanel'
export { partnerLedgerEntity, partnerLedgerViews, isInflowType, isOutflowType, partnerTxDirection, PARTNER_TRANSACTION_TYPE_OPTIONS, type PartnerLedgerRow } from './entity-view/partnerLedger.entity'
export { profitDistributionEntity, profitDistributionViews, type ProfitDistYearValue, type ProfitDistActaValue, type ProfitDistResultValue } from './entity-view/profitDistribution.entity'
export { usePartnerStatement, useProfitDistribution, PARTNER_KEYS } from './hooks'
