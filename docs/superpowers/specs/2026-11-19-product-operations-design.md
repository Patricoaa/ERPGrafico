# Hub de analítica por producto — Fase 3c-2: rotación, cobertura y suscripciones

## Intención y por qué
Cierra la Fase 3 del hub (`2026-11-19-product-analytics-hub-design.md`). Para un producto con stock hoy se ve el kardex pero no si rota, cuántos días de consumo cubre su stock ni si está inmóvil; para una suscripción no se ve su costo anualizado, los pagos próximos ni cuánto subió el monto.

## Goals
- Rotación y cobertura de stock con datos que ya existen (movimientos), sin tablas nuevas.
- Costo anualizado y calendario de pagos de suscripciones, y variación de lo pagado.

## Non-goals / anti-goals
- No inventar rotación sin consumo: sin salidas o sin stock promedio, rotación y cobertura son `null`, no 0 ni infinito.
- No proyectar pagos más allá del próximo vencimiento de cada suscripción activa.
- No tocar el tab «Mov. Stock» ni el flujo de suscripciones.

## Definiciones
Solo para productos con `capabilities.tracks_stock` (rotación) y `capabilities.recurring` (suscripciones). Se consideran el producto y sus variantes.

**Rotación** (ventana `date_from`–`date_to`, default 12 meses; `idle_days` default 90):
- Flujo por movimiento como `ProductSelector._stock_flow` (IN/OUT; traspasos y ajustes no cuentan como entrada/salida); el stock varía con todo movimiento que cruza el borde de ubicaciones internas.
- `out_qty`, `in_qty`: Σ cantidades OUT / IN de la ventana. `stock_now`: último valor de la serie de stock acumulado. `stock_value = stock_now × cost_price`.
- `avg_stock`: promedio del stock ponderado por días sobre la ventana, a partir de la serie diaria acumulada (valor constante entre movimientos).
- `turnover = out_qty / avg_stock` (`null` si `avg_stock ≤ 0`); `days_of_inventory = días de la ventana / turnover` (`null` si turnover ≤ 0 o nulo).
- `coverage_days = stock_now / (out_qty de los últimos 90 días / 90)` (`null` si no hubo salidas en 90 días o `stock_now ≤ 0`).
- `last_out_date`, `last_in_date`: última fecha de salida / entrada (todo el historial). `idle = stock_now > 0 and (no hay salida o days_since_last_out ≥ idle_days)`.
- `series`: por mes de la ventana `{month, out, stock_end}` (stock al cierre del mes).

**Suscripciones** (modelo `Subscription` del producto):
- `annualized = amount × factor` con factor WEEKLY 52, MONTHLY 12, QUARTERLY 4, SEMIANNUAL 2, ANNUAL 1; `monthly_equivalent = annualized / 12`.
- Totales sobre suscripciones `ACTIVE`: `annualized_total`, `count`, `due_90d_total` (Σ `amount` de las activas con `next_payment_date ≤ hoy + 90 días`; un pago por suscripción).
- Por suscripción: proveedor, estado, monto, frecuencia, anualizado, próximo pago, `days_to_payment` (negativo si vencido).
- `payments`: líneas de compra del producto en órdenes no `DRAFT` ni `CANCELLED`, por fecha de la orden ascendente (últimas 24): `{date, supplier, unit_cost, quantity, change_pct}` con `change_pct` respecto al pago anterior (`null` el primero); `first_to_last_pct` = (último − primero) / primero × 100 sobre `unit_cost`.

## Endpoint
`GET /inventory/products/{id}/operations/` (`date_from`, `date_to`, `idle_days` 1–365; 400 si inválidos; vista ≤ 20 líneas; lógica en `inventory/operations_selector.py`). Respuesta `{rotation: {...} | null, subscriptions: {...} | null}`, nulos cuando la capacidad no aplica.

## Frontend
Tab `operations` («Operación») visible si `tracks_stock or recurring`. Bloque `OperationsBlock`: tarjetas (rotación, días de inventario, cobertura, valor de stock, aviso de stock inmóvil), gráfico mensual de salidas y stock al cierre, y para suscripciones tarjetas de costo anualizado y próximos 90 días, tabla de suscripciones y de pagos (`defineEntity` + `Collection`). Hook `useProductOperations` con `placeholderData: keepPreviousData`.

## Constraints
Invariantes del repo; cero N+1; ADR-0148. Refactor mínimo de `ProductSelector._stock_flow` para compartir la clasificación de flujo (protegido por sus tests).

## Mis decisiones (marcadas)
- Un solo endpoint y un solo tab con dos secciones opcionales.
- `idle_days` 90 y cobertura sobre los últimos 90 días.
- Variación de pagos sobre `unit_cost` de líneas de compra (así se registran los pagos de suscripciones).

## Pendiente del builder
Textos, redondeos, nombres de columnas, orden de la serie.
