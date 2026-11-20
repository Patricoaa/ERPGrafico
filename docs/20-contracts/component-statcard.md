---
layer: 20-contracts
doc: component-statcard
status: removed
owner: frontend-team
last_review: 2026-11-20
stability: contract-changes-require-ADR
---

# StatCard — eliminado

`StatCard`, `KPIWrapper`, `KPIValue`, `DeltaBadge`, `SectionCard` y `KpiCardDef` se eliminaron (ADR-0149, cierre de la migración). Su reemplazo es `Metric`, `MetricStrip` y `ChartCard`: ver [component-metric.md](./component-metric.md), que incluye la tabla de migración desde `StatCard`. El test `metric-family.contract.test.ts` impide reintroducirlos.
