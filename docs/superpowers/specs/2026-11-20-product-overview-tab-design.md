# Tab «Resumen» del análisis de producto

Estado: aprobado. Fecha: 2026-11-20.
Último tab rediseñado del plan `2026-11-20-product-analytics-tab-planning-design.md`. Reemplaza el contenido legado `overview`. Con él, ningún tab usa `insights`.

## Intención

Resumen es lo primero que se ve al abrir el modal. Responde «¿qué pasa con este producto y dónde debo mirar?»: la cifra protagonista de cada tab que aplica y todos los hallazgos juntos, con un acceso directo al tab que los explica.

## Enfoques considerados

- **A. Agregar en el cliente (elegido por el usuario).** Resumen consulta los endpoints de los tabs visibles y aplica sus funciones `compose*`. Sin lógica nueva en el backend ni hallazgos duplicados; las respuestas quedan en la caché y los tabs cargan al instante después. Costo: varias consultas al abrir el modal (entre 2 y 6 según el producto).
- B. Endpoint `overview/` en el backend: una consulta, pero duplica en Python los umbrales y hallazgos del cliente.
- C. Índice de tabs con su cifra, sin hallazgos: más liviano, pero pierde lo principal.

## Composición

- **Hallazgos** de todos los tabs visibles, agrupados por tab en el orden del riel, cada grupo con un botón «Ver en <tab>» que activa ese tab. Sin hallazgos: «Sin hallazgos en el periodo».
- **Cifras**: una tarjeta por tab visible (salvo Resumen) con su cifra protagonista, su variación si existe, y el mismo botón para ir al tab.

| Tab | Cifra | Contexto |
|---|---|---|
| Ventas | Unidades vendidas (variación contra el período anterior) | ingreso neto |
| Precio y margen | Margen realizado (o precio realizado sin costo) | — |
| Costos | La cifra protagonista de `composeCosts` (ponderado, BOM o real promedio) | variación del costo |
| Abastecimiento | Cobertura en días si hay stock; si no, gasto del período | unidades compradas |
| Inventario | Existencia | disponible |
| Producción | Unidades producidas (fabricado) o consumo en OT (insumo) | órdenes |
| Suscripción | Costo anualizado | activas |

Cada fuente carga por separado: su tarjeta muestra el estado de carga o de error sin bloquear las demás.

## Datos

Sin endpoint nuevo. Resumen usa los hooks existentes (`useProductSales`, `useProductPricing`, `useProductCosts`, `useProductProcurement`, `useProductStockAnalysis`, `useProductProductionAnalysis`, `useProductSubscriptionAnalysis`) con los mismos parámetros que usan los tabs para el período (para compartir la caché); los tabs no visibles reciben `productId = null` y no consultan. `idle_days` 90 e `increase_pct` 10 (los valores por defecto de sus tabs).

## Frontend

- Función pura `composeOverview(sources)` que recibe, por tab visible, sus datos (o `null` si aún no llegan) y devuelve `cards` y `findings` agrupados. Reutiliza las funciones `compose*` de cada tab.
- Bloque `OverviewBlock({ productId, period, capabilities, onSelectTab })`.
- `TabContent` recibe `onSelectTab` y monta `OverviewBlock` en `overview`. Ningún tab usa ya `LegacyInsightsPanel`: `TabContent` deja de importarlo, se elimina `tabHasLegacyContent` y el aviso «Este tab muestra todo el histórico» del modal.
- El retiro de los archivos legado (`LegacyInsightsPanel`, endpoint `insights`, bloques que ya no se montan) es un plan aparte.

## Decisiones del usuario

- Enfoque A.

## Llamadas mías

- Las cifras y contextos de la tabla.
- Hallazgos agrupados por tab con acceso directo.
- Parámetros por defecto de los controles de Vista (`idle_days` 90, `increase_pct` 10).

## Queda al implementador

- Detalle visual de las tarjetas y orden fino.
