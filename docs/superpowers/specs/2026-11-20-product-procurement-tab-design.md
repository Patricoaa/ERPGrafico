# Tab «Abastecimiento» del análisis de producto

Estado: aprobado. Fecha: 2026-11-20.
Cuarto tab rediseñado del plan `2026-11-20-product-analytics-tab-planning-design.md`. Reemplaza el contenido legado `purchases` y `suppliers` dentro de `TabContent.procurement`.

## Intención

Quien abastece un producto necesita saber a quién le compra, cuánto, qué tiene pendiente de recibir y, si guarda stock, para cuántos días le alcanza. El costo de cada compra ya lo cubre «Costos»; este tab habla de **proveedores, volumen, pendientes y cobertura**.

## Principio: solo hechos registrados

Los datos de plazos no son confiables: las recepciones suelen registrarse el mismo día que la orden (recepción inmediata) y la fecha de recepción planificada no se usa. Por eso el tab **no** muestra tiempo de entrega, puntualidad ni punto de pedido sugerido (serían inferencia). La única métrica derivada es la cobertura, que usa el mismo cálculo que el tab Inventario.

## Composición

| Caso | Contenido |
|---|---|
| Con stock (`tracks_stock`) | Hallazgos → cobertura (stock actual, consumo diario reciente, días de cobertura) → cifras de compras → gráfico con período anterior → proveedores → pendiente de recibir |
| Sin stock (reventa, consumible, servicio) | Hallazgos → cifras de compras → gráfico con período anterior → proveedores → pendiente de recibir |
| Sin compras en el rango | Cifras en cero, «Última compra hace N días» (todo el histórico) y lo pendiente de recibir si existe |
| Período `all` | Sin período anterior |

## Datos: endpoint `GET /inventory/products/{id}/procurement/`

Parámetros: `date_from`, `date_to` (opcionales), `granularity` (`day|week|month|year`). Fuente: líneas de recepción confirmadas del producto y sus variantes, cantidades en unidad base (misma conversión que `costs`). Respuesta:

- `coverage` (solo con stock; `null` si no): `stock_now`, `daily_out` (salidas de los últimos 90 días ÷ 90) y `coverage_days` (`null` sin salidas o sin stock), mismo cálculo que `operations`.
- `kpis`: `units`, `spend`, `orders` (órdenes distintas con recepciones en el rango), `suppliers`, `last_purchase_date` y `days_since_last_purchase` (todo el histórico), `returned_units` (devoluciones confirmadas a proveedor en el rango) y `previous` (`units`, `spend`, `orders` del período anterior de igual duración; `null` sin `date_from`).
- `series`: `points: [{period, units, spend}]` y `previous_points` alineados a los períodos actuales (como `sales`).
- `suppliers`: `[{id, name, units, spend, share_pct, avg_unit_cost, receipts, last_date, returned_units, preferred}]` ordenados por gasto; `preferred_supplier`: `{id, name}` o `null`.
- `pending`: `[{order_id, number, supplier, date, ordered, received, pending}]` de órdenes confirmadas con cantidad aún sin recibir (estado actual, sin filtro de rango).

Servidor: `inventory/procurement_selector.py`, serializer de parámetros, vista ≤ 20 líneas, sin N+1. La cobertura se extrae de `OperationsSelector` a una función compartida.

## Frontend

- Bloque `ProcurementBlock`, hook `useProductProcurement`, función pura `composeProcurement(data)` (hallazgos y secciones).
- Control «Métrica» (Unidades, Gasto) en la zona Vista para el gráfico.
- Tablas con `defineEntity`: proveedores (con marca del preferido) y pendiente de recibir.
- `TabContent.procurement` pasa a `<ProcurementBlock />`; `tabHasLegacyContent("procurement")` pasa a falso.

## Hallazgos

- **Cobertura baja:** `coverage_days ≤ 15`.
- **Proveedor preferido ausente:** hay compras en el rango y el proveedor preferido no aparece entre ellas.
- **Concentración:** un proveedor suma ≥ 80 % del gasto, con al menos 2 proveedores (llamada mía: con uno solo sería siempre 100 %).
- **Devoluciones:** `returned_units > 0` en el rango.

## Decisiones del usuario

- Sin punto de pedido sugerido; solo cobertura.
- Sin tiempo de entrega ni puntualidad: los datos no los soportan.
- Composición y hallazgos según la propuesta aprobada.

## No objetivos

- Costo unitario en el tiempo (tab `costs`).
- Pronóstico de demanda, punto de pedido, plazos de entrega.

## Queda al implementador

- Nombres de tipos, hooks y entidades, y orden fino de las secciones.
