# Hub de analítica por producto — Fase 3c-1: decisiones de abastecimiento

## Intención y por qué
Parte de `2026-11-19-product-analytics-hub-design.md` (Fase 3). Un producto que se fabrica y también se compra no tiene hoy una comparación de costo, y un insumo no muestra dónde se usa ni cuánto le duele a cada producto una subida de su precio. 3c-2 (rotación, cobertura, suscripciones) queda fuera.

## Goals
- Fabricar vs comprar: costo real por unidad fabricado contra costo de compra (último y ponderado) y ahorro estimado.
- Uso como insumo: BOM activas donde participa, su peso en el costo del padre y sensibilidad a una subida de precio, con efecto en el margen del padre.

## Non-goals / anti-goals
- No recomendar automáticamente («fabrica» / «compra»): se muestra la cifra y cuál es más barato, sin ocultar que faltan datos.
- No comparar si falta uno de los dos lados (sin OT con costo, o sin recepciones): ahorro `null`.
- No tocar rotación, cobertura ni suscripciones (3c-2).

## Definiciones
Ventana: `date_from`–`date_to` (default 12 meses).
- **Fabricar**: `ProductionPerformanceSelector.get_performance` en la ventana → `unit_cost` = `kpis.unit_real_cost`, `bom_cost` = `kpis.bom_cost`, `units_made` = Σ `qty` de las OT de la ventana, `orders`.
- **Comprar** (productos y variantes, `PurchaseReceiptLine` de recepciones `CONFIRMED` en la ventana): cantidad base = cantidad recibida convertida a la unidad base del producto; costo por unidad base = `total_cost / cantidad base`. `avg_unit_cost` = Σ total_cost / Σ cantidad base; `last_unit_cost` y `last_date` de la recepción más reciente; `units_bought`; `receipts`.
- `saving_per_unit = avg_unit_cost − make.unit_cost` (positivo → fabricar es más barato); `null` si algún lado es 0. `saving_total = saving_per_unit × units_made`; `cheaper` = `MAKE` | `BUY` | `null`.
- **Uso como insumo**: líneas de BOM activas con `component` ∈ producto y variantes. Por línea: `qty_per_unit` = cantidad convertida a la unidad base del componente; `component_cost` = `qty_per_unit × component.cost_price`; `bom_cost` = Σ costo de todas las líneas de esa BOM (igual que `Product.get_bom_cost`, sin dividir por rendimiento); `share_pct = component_cost / bom_cost × 100`.
- **Sensibilidad** con `increase_pct` (default 10, rango 1–100): `delta_cost = component_cost × increase_pct / 100`; `delta_pct = delta_cost / bom_cost × 100`; `price_net` = `sale_price` del padre; `margin_pct = (price_net − bom_cost) / price_net × 100` y `margin_pct_after` con `bom_cost + delta_cost` (`null` si `price_net` = 0).

## Endpoint
`GET /inventory/products/{id}/sourcing/` (`date_from`, `date_to`, `increase_pct`; 400 si inválidos; vista ≤ 20 líneas; lógica en `inventory/sourcing_selector.py`). Respuesta: `{make_vs_buy: {...} | null, used_in: {increase_pct, parents: [...]} | null}`; `make_vs_buy` solo si `capabilities.manufactures and buys`; `used_in` solo si `capabilities.used_in_production`.

## Frontend
Tab `sourcing` («Abastecimiento»), visible si `(manufactures and buys) or used_in_production`. Bloque `SourcingBlock`: tarjetas comparativas fabricar/comprar con ahorro y aviso cuando falta un lado; tabla de padres (`defineEntity`) con selector de `increase_pct` (5/10/20 %). Hook `useProductSourcing`. loading/empty/error.

## Constraints
Invariantes del repo; cero N+1; ADR-0147.

## Mis decisiones (marcadas)
- Una sola respuesta con dos secciones opcionales y un solo tab, en vez de dos endpoints.
- Costo de compra y de fabricación en la unidad base del producto.
- Rendimiento de BOM ignorado, igual que `get_bom_cost`.
- `cost_price` (ponderado actual) del componente como costo de la sensibilidad.

## Pendiente del builder
Textos, redondeos, rango por defecto exacto.
