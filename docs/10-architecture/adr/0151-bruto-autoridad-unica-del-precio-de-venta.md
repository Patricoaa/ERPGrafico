---
id: 0151
title: El bruto es la única autoridad del precio de venta; el neto se deriva con una sola función (`accounting/vat.py`)
status: Accepted
date: 2026-11-20
author: backend-team + frontend-team
---

# 0151 — Bruto como autoridad única del precio de venta

**Relacionado:** `core/strategies/totals.py` (`GrossFirstTotals` / `NetFirstTotals`), ADR-0145 (procedencia del precio en líneas), `docs/20-contracts/api-contracts.md` (Product), plan `docs/superpowers/plans/2026-11-20-sale-price-gross-authority.md`.

## Contexto

Los precios de venta se guardan como dos columnas enteras en CLP, neto y bruto (`decimal_places=0`), y cada lugar decide por su cuenta cuál manda y cómo se calcula el otro:

| Sitio | Comportamiento actual |
|---|---|
| `PricingService.resolve_product_price` | Usa el bruto y, si falta, lo calcula desde el neto. |
| `Product.save()` | Compara con la instancia anterior: si cambió el neto, recalcula el bruto («gana el neto»). El formulario envía ambos, así que el resultado depende de los valores previos. |
| `PricingRule.save()` / `ProductUoMPrice.save()` | Reglas parecidas pero no iguales; `PricingRule` traga excepciones. |
| Recargo de variante (`price_surcharge`) | Solo neto; se convierte a bruto en cada uso, en 4 copias dentro de `inventory/services.py`. |
| `min_variant_price` | Neto, tomado de `variant.sale_price` sin resolver el modo de herencia. |
| `sale_return` sin línea de origen | `product.sale_price * vat`, **sin redondear**. |
| Frontend (`lib/pricing-utils.ts`) | `netToGross` / `grossToNet` con **0,19 fijo** por defecto, ignorando la tasa configurada; ~15 archivos multiplican por el IVA. |

Síntoma observado: el producto 11 tiene bruto 1450 y neto 1218 en la BD. La tarjeta de producto y la grilla del POS muestran **1449**, porque recalculan el bruto desde el neto ya redondeado (1218 × 1,19 = 1449,42). El cobro sí es 1450, porque el motor usa el bruto.

El problema de fondo es aritmético: en pesos enteros **no todo bruto tiene un neto entero**. 1450 no lo tiene (1218 da 1449 y 1219 da 1451). En cambio, **todo neto entero tiene un bruto que lo reproduce exactamente**: para `g = round(n × m)` con `m > 1`, `round(g / m) = n`, porque el error de redondeo de `g` (≤ 0,5) se reduce al dividir por `m`. La conversión es fiel en un sentido (neto → bruto → neto) y no en el otro.

Los documentos de venta ya son *gross-first* (`GrossFirstTotals`): el total sale de la suma de brutos por línea y el neto se extrae del total. Una línea de 1450 da un documento de 1450 (neto 1218, IVA 232), sea boleta o factura.

## Decisión

1. **El bruto es la única autoridad del precio de venta.** Son autoritativos `Product.sale_price_gross`, `PricingRule.fixed_price_gross`, `ProductUoMPrice.price_gross` y el nuevo `Product.price_surcharge_gross`, que reemplaza a `price_surcharge` (neto). Las columnas netas se mantienen (orden, reportes, listados) pero son **derivadas**: siempre se calculan desde el bruto y nunca desde otro valor derivado.
2. **Una sola función de conversión.** `backend/accounting/vat.py` expone `gross_from_net`, `net_from_gross` y `sale_price_from_input`. Todas usan `ROUND_HALF_UP` al peso y por defecto la tasa de `AccountingSettings`. Ningún otro módulo de backend hace aritmética con `get_vat_multiplier()`.
3. **Regla de escritura determinista.** En toda API o servicio que reciba un precio de venta:
   - si llega el bruto, manda el bruto y el neto enviado se ignora;
   - si llega solo el neto, se convierte a bruto con `gross_from_net` (sin pérdida, por la propiedad anterior);
   - el `save()` del modelo deriva el neto desde el bruto **sin consultar la instancia anterior**.

   El resultado depende solo del input, no del historial.
4. **El frontend muestra, no calcula.** Listados, tarjetas, selectores y el POS muestran el bruto y el neto que entrega la API (el listado de productos expone `sale_price_gross`). La única conversión permitida en cliente es la vista previa de formularios y los totales de documento, con `frontend/lib/vat.ts`, que espeja `vat.py`, exige la tasa de `useVatRate()` (sin 0,19 por defecto) y admite la opción `decimals` para netos de compra. Los formularios envían solo el bruto.
5. **Paridad verificada.** Un único archivo de casos (`shared/vat-rounding-cases.json`) se ejecuta en pytest contra `vat.py` y en vitest contra `lib/vat.ts`.
6. **Guardia en CI.** Un test `ci_gate` (`backend/core/tests/test_vat_arithmetic_gate.py`) falla si aparece aritmética de IVA (`get_vat_multiplier()` multiplicado o dividido, `1.19`, `netToGross` / `grossToNet`) fuera de `accounting/vat.py` y `lib/vat.ts`, salvo en la lista `ALLOWED` de excepciones, que solo puede achicarse (ratchet; una entrada sin hallazgos hace fallar el test).
7. **Compras y costos no cambian de autoridad.** Siguen siendo netos (`NetFirstTotals`, cotizaciones de proveedor), pero sus conversiones para mostrar pasan por las mismas funciones (`gross_from_net` / `lib/vat.ts`).

## Consecuencias

- **Contrato de API (`api-contracts.md`).** `sale_price`, `fixed_price` y `price_net` siguen en las respuestas pero en escritura solo se aceptan si falta el bruto. Se agregan `price_surcharge_gross` y `min_variant_price_gross`. `price_surcharge` y `min_variant_price` quedan deprecados y se eliminan cuando no quede consumidor.
- **Migración de datos.** Se re-derivan todos los netos desde el bruto. Si falta el bruto, se calcula desde el neto. Para el recargo: `price_surcharge_gross = gross_from_net(price_surcharge)`. Algunos netos cambian en ±1 peso. Una variante SURCHARGE ahora vale `bruto_template + recargo_bruto` en vez de `round((neto_template + recargo) × m)`, y puede diferir en ±1. La migración informa cuántas filas cambian; antes se ejecuta `audit_sale_prices --dry-run` en el servidor de desarrollo (la lógica está en `inventory/price_rederivation.py`).
- **Brutos ya corrompidos no se recuperan.** Si «ganó el neto» y se guardó 1449 cuando se escribió 1450, el dato queda en 1449: no hay registro del valor original.
- **Cambio de tasa de IVA.** El bruto se mantiene y el neto se re-deriva: los precios al público quedan estables y el margen neto absorbe el cambio. Re-preciar en neto es un comando aparte, no automático.
- `Product.save()` deja de hacer `Product.objects.get(pk=self.pk)` para comparar precios: es una consulta menos por guardado.
- El ordenamiento por `sale_price` en listados se mantiene. Como el neto es derivado, es monótono respecto del bruto.

## Alternativas descartadas

- **Base por precio (`price_basis = NET | GROSS`).** Solo se necesita si un precio debe mantener el neto ante un cambio de tasa, por ejemplo listas B2B fijadas en neto. Hoy no hay tal caso y escribir un neto no pierde información con bruto autoritativo. Se puede agregar después sin romper esta decisión.
- **Neto como autoridad.** Hace imposibles los precios de vitrina redondos (1450, 9990) y contradice `GrossFirstTotals`.
- **Guardar con decimales.** El CLP no tiene centavos; desplaza el redondeo a cada documento y rompe la igualdad con lo cobrado.
- **Arreglar solo `getPrice` del frontend.** Corrige el síntoma del producto 11 pero deja el «gana el neto» en `Product.save()` y las ~45 copias del cálculo.

## Implementación

- **Backend:** `accounting/vat.py` (`gross_from_net`, `net_from_gross`, `sale_price_from_input`); `inventory/services.py`: `variant_sale_price` (precio resuelto de una variante según su modo de herencia) y `net_write_to_gross` (convierte una escritura solo-neto a bruto antes de `save()`; un neto o bruto `None` explícito limpia el recargo); `Product.save()`, `PricingRule.save()` y `ProductUoMPrice.save()` derivan el neto solo del bruto.
- **Serializers:** `price_surcharge_gross` y `min_variant_price_gross`; el listado expone `sale_price_gross`.
- **Migraciones (`inventory`):** `0038_product_price_surcharge_gross` (columna) y `0039_rederive_sale_prices` (re-derivación de datos); comando `audit_sale_prices`.
- **Frontend:** `lib/vat.ts` (con `decimals` opcional), `PricingUtils` con tasa obligatoria, tarjetas/selectores/POS muestran el bruto de la API, formularios (incluida la edición masiva `BulkVariantEditForm`) envían solo el bruto.
- **Paridad y guardia:** `shared/vat-rounding-cases.json` (pytest + vitest); `backend/core/tests/test_vat_arithmetic_gate.py` (`ci_gate`); recorrido del bug original en `backend/inventory/tests/test_gross_authority_end_to_end.py`.
