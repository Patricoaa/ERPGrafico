# ADR 0058: Panel analytics con agregación servidor para entidades de alto volumen

## Estado

Aceptado

## Contexto

El `AnalyticsPanelContent` de `DataTableView` (contrato en
`component-datatable-views.md` §12) se alimenta de hooks cliente que
descargan la lista completa de la entidad y agregan en el navegador
(`useSalesAnalyticsData`, `usePurchasingAnalyticsData`,
`usePayrollAnalyticsData`, `usePartnerAnalyticsData`,
`useUnbilledAnalyticsData`).

Ese enfoque funciona cuando el conjunto es pequeño (órdenes de venta,
pagos de nómina), pero es inviable para entidades de **alto volumen**:
`inventory.stockmove` (Kardex), `treasury.treasurymovement` e
`billing.invoice` acumulan cientos de miles de filas. Descaragar todo al
navegador para agregar `Sum(quantity × unit_cost)` en JS degrada la
experiencia, satura la red y paga impuestos de serialización que la DB ya
resolvió.

`treasury.creditcardstatement` ya había resuelto esto con un servicio
backend (`CardAnalyticsService`) expuesto como `GET
/treasury/card-statements/analytics/`.

## Decisión

El **patrón servidor** es el canónico para entidades de alto volumen:
backend agrega en DB, el frontend solo consume shape chart-ready.

1. **Servicio de lectura** en `backend/{app}/analytics.py`
   (`{Entity}AnalyticsService`) con métodos por dimensión y un
   `get_consolidated(...)` que devuelve todo en una respuesta. Sin acceso
   al serializador — respuestas son dicts planos.
2. **`@action(detail=False)` `analytics`** en el `ViewSet` → `GET
   /api/{app}/{resource}/analytics/?granularity=&months=&<filters>`.
   Respeta los filtros del unified search (producto, ubicaciones, rango
   de fechas).
3. **Hook tipado** `features/{app}/hooks/use{Entity}Analytics.ts` —
   `useQuery` con key explícita y `staleTime: 5min`; `useMemo` que
   convierte el response a shapes de chart (`assignChartColors`,
   `formatMonth`). Sin `any`.
4. **Registry**: `ENTITY_REGISTRY[...].viewPolicy.availableViews` incluye
   `'analytics'`.
5. **Vista**: el `*ClientView` pasa `analyticsPanel` (tabs declarativos)
   a `DataTableView`.
6. **Tests**: suite en `backend/{app}/tests/test_analytics.py` (shape del
   endpoint, clasificaciones, granularidades, filtros, auth).

### Clasificación de dirección en DB (stockmove)

Regla replicada de `selectors.py` con `Case/When` en `_direction_annotation`
(prioridad: TRANSFER > ADJUSTMENT > IN > OUT > OTHER):

| Dirección | Condición |
|-----------|-----------|
| TRANSFER | source y destination son `INTERNAL` |
| ADJUSTMENT | source o destination es ubicación virtual de ajuste (`Ajuste por Merma/Pérdida`, `Ajuste por Sobrante/Ganancia`, `Revalorización`) |
| IN | destination es `INTERNAL` |
| OUT | source es `INTERNAL` |
| OTHER | resto |

La valorización agrega `Sum(F("quantity") * F("unit_cost"))` vía
`ExpressionWrapper` y las granularidades usan `TruncDay/Month/Year`
(ventana por defecto `months=12`).

## Consecuencias

### Positivas
- **Payloads pequeños**: el navegador recibe agregados, no filas crudas.
- **Agregación correcta en DB**: joins, filtros y agrupamiento donde viven
  los datos.
- **Filtros compartidos**: el panel responde al unified search del listado
  sin duplicar lógica.

### Negativas
- **Dos implementaciones del panel**: el patrón cliente sigue para
  entidades de bajo volumen; el servidor para alto volumen. El ADR define
  cuándo usar cada uno.
- **Coste de mantenimiento backend**: cada dimensión requiere método +
  test en el servicio.

### Implementación inicial

`inventory.stockmove` (Kardex) — `StockMoveAnalyticsService` en
`backend/inventory/analytics.py`, endpoint `GET /api/inventory/moves/analytics/`,
4 tabs (Flujo, Valor, Productos, Bodegas). Candidatos siguientes:
`treasury.treasurymovement`, `billing.invoice`.
