# Tab «Suscripción» del análisis de producto

Estado: aprobado. Fecha: 2026-11-20.
Séptimo tab rediseñado del plan `2026-11-20-product-analytics-tab-planning-design.md`. Reemplaza `OperationsBlock` dentro de `TabContent.subscription`.

## Intención

Un producto de tipo suscripción es un gasto recurrente que la empresa paga a un proveedor (software, internet, arriendos). Quien lo administra necesita saber cuánto cuesta al año, qué pagos vienen, si subió el precio y si algo está vencido o por terminar, para cancelar, renegociar o mantener.

## Hechos del modelo

- `Subscription`: proveedor, monto configurado, frecuencia (`recurrence_period`), próximo pago, estado (`ACTIVE`, `PAUSED`, `CANCELLED`, `EXPIRED`), fecha de inicio y de fin.
- Los pagos son líneas de órdenes de compra no borrador ni anuladas del producto (`PurchaseLine`), con fecha de la orden y proveedor. No apuntan a una suscripción concreta: se asocian por proveedor; dos suscripciones del mismo producto con el mismo proveedor comparten sus pagos (límite conocido).

## Composición

| Sección | Contenido |
|---|---|
| Hallazgos | si aplican |
| Hoy | Costo anualizado de las activas, equivalente mensual, número de activas, total de los próximos 90 días |
| Pagos del periodo | Total pagado y número de pagos contra el período anterior; gráfico por período con período anterior |
| Suscripciones | Proveedor, estado, monto configurado, frecuencia, anualizado, próximo pago, fin, último pago real y su variación contra el pago anterior del mismo proveedor |
| Pagos | Pagos del período con su variación |

Sin pagos en el rango: «Sin pagos en el periodo» y se mantienen «Hoy» y la tabla de suscripciones.

## Datos: endpoint `GET /inventory/products/{id}/subscription-analysis/`

Parámetros: `date_from`, `date_to` (opcionales), `granularity` (`day|week|month|year`). Respuesta:

- `today`: `annualized_total`, `monthly_equivalent`, `active_count`, `due_90d_total` (mismo cálculo que `operations`; el próximo pago se mide desde hoy).
- `kpis`: `paid`, `payments`, `previous` (`paid`, `payments`; `null` sin `date_from`).
- `series`: `points: [{period, paid}]` y `previous_points` alineados.
- `subscriptions`: `[{id, supplier, status, amount, frequency, annualized, next_payment_date, days_to_payment, end_date, days_to_end, last_payment, change_pct, differs_from_amount}]` donde `last_payment` = `{date, amount}` o `null` (todo el histórico del proveedor), `change_pct` = último pago contra el anterior del mismo proveedor, `differs_from_amount` = el último pago difiere del monto configurado en más de 1 %.
- `payments`: `[{date, supplier, amount, change_pct}]` del rango (monto = cantidad × costo unitario de la línea).

Servidor: `inventory/subscription_analysis_selector.py`, serializer de parámetros, vista ≤ 20 líneas, sin N+1.

## Frontend

- Bloque `SubscriptionBlock`, hook `useProductSubscriptionAnalysis`, función pura `composeSubscription(data)`.
- `TabContent.subscription` pasa a `<SubscriptionBlock />`; `OperationsBlock` deja de montarse en el modal.

## Hallazgos (umbrales míos, aprobados)

- **Subida de precio:** `change_pct ≥ 5` en alguna suscripción.
- **Pago distinto al configurado:** `differs_from_amount`.
- **Pago vencido:** suscripción activa con `days_to_payment < 0`.
- **Termina pronto:** `0 ≤ days_to_end ≤ 30`.
- **Pausadas:** alguna suscripción `PAUSED`.

## Decisiones del usuario

- Composición y hallazgos según la propuesta.

## No objetivos

- Suscripciones vendidas a clientes (el lado venta lo cubren Ventas y Precio y margen).
- Separar pagos de dos suscripciones del mismo proveedor.

## Queda al implementador

- Nombres, etiquetas y orden fino de las secciones.

## Desvíos de la implementación

- «Hoy» se calcula en el propio selector con la misma fórmula y factores de frecuencia que `operations` (test de equivalencia), en vez de llamar a `OperationsSelector._subscriptions`, para no repetir su consulta de pagos.
