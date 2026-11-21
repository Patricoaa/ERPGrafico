# Bruto como autoridad única del precio de venta — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el precio de venta se calcule igual en todas partes. El bruto es la autoridad, el neto se deriva con una sola función y el frontend muestra lo que entrega la API. El síntoma que lo motiva: el producto 11 tiene bruto 1450, pero la tarjeta y el POS muestran 1449.

**Architecture:** Módulo `backend/accounting/vat.py` (conversión y regla de escritura) más su espejo `frontend/lib/vat.ts`. Los `save()` de `Product`, `PricingRule` y `ProductUoMPrice` derivan el neto desde el bruto sin mirar la instancia anterior. El recargo de variante pasa a bruto (`price_surcharge_gross`). Una migración de datos re-deriva los netos. Un test `ci_gate` impide nueva aritmética de IVA fuera de los dos módulos.

**Tech Stack:** Django 5 + DRF, pytest; Next.js 16, TypeScript, Vitest.

**ADR:** `docs/10-architecture/adr/0151-bruto-autoridad-unica-del-precio-de-venta.md` (Proposed; pasa a Accepted al mergear).

## Global Constraints

- Redondeo `ROUND_HALF_UP` al peso entero en backend. En frontend, `Math.round` sobre valores positivos da el mismo resultado; los casos con `.5` están en el fixture de paridad.
- Tasa siempre explícita en frontend (`useVatRate().multiplier`): `lib/vat.ts` no tiene valor por defecto.
- Zero `any`; hooks de datos en `features/*/hooks/`; vistas ≤ 20 líneas; **zero N+1**: `min_variant_price_gross` usa `variants` ya prefetcheado; ningún `SerializerMethodField` consulta la BD.
- Compras y costos (BOM, tercerizados, órdenes de compra) **siguen siendo netos**. En ellos solo se reemplaza la aritmética por las funciones compartidas.
- Comandos:
  - backend: `cd backend && DEBUG=1 CACHE_BACKEND=locmem CHANNEL_BACKEND=locmem venv/bin/python -m pytest <path> -q`
  - frontend: `source ~/.nvm/nvm.sh && nvm use 24 && cd frontend && npm run test -- <path>`, `npm run type-check`, `npm run lint`
  - servidor de desarrollo: verificar `mutagen sync list` (`erpgrafico-sync … Connected: Yes`) y luego `ssh pato@192.168.1.86 "cd ERPGrafico && docker compose exec -T backend …"`

## Review Focus

1. **Escritura con ambos valores inconsistentes** (`sale_price=1000`, `sale_price_gross=1450`): se guarda bruto 1450 y neto 1218. El neto enviado se ignora.
2. **Escritura solo con neto** (`sale_price=1218`): bruto 1449 y neto 1218. Neto → bruto → neto siempre devuelve el neto escrito.
3. **Variante SURCHARGE:** bruto = bruto del template + `price_surcharge_gross`, y el neto se deriva del total. Lo mismo en `resolve_product_price`, en la anotación por lote (`annotate_effective_prices`, ~línea 1584) y en las reglas FIXED y PACKAGE_FIXED.
4. **Migración idempotente:** correrla dos veces no cambia nada. Filas con bruto 0 y neto 0 quedan en 0. Productos con `is_dynamic_pricing` no se tocan más allá de re-derivar.
5. **Guardia `ci_gate`:** falla con una línea nueva `x * get_vat_multiplier()` en cualquier app, y la lista de excepciones solo puede achicarse.

---

### Task 1: `accounting/vat.py` + fixture de paridad

**Files:**
- Create: `backend/accounting/vat.py`, `shared/vat-rounding-cases.json`
- Test: `backend/accounting/tests/test_vat.py`

**Interfaces:**

```python
# backend/accounting/vat.py
from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal

def _multiplier(rate_multiplier: Decimal | None) -> Decimal:
    if rate_multiplier is not None:
        return rate_multiplier
    from accounting.utils import get_vat_multiplier
    return get_vat_multiplier()

def _peso(value: Decimal) -> Decimal:
    return value.quantize(Decimal("1"), rounding=ROUND_HALF_UP)

def gross_from_net(net, multiplier: Decimal | None = None) -> Decimal:
    return _peso(Decimal(net) * _multiplier(multiplier))

def net_from_gross(gross, multiplier: Decimal | None = None) -> Decimal:
    return _peso(Decimal(gross) / _multiplier(multiplier))

@dataclass(frozen=True)
class SalePrice:
    net: Decimal
    gross: Decimal

def sale_price_from_gross(gross, multiplier: Decimal | None = None) -> SalePrice:
    g = _peso(Decimal(gross))
    return SalePrice(net=net_from_gross(g, multiplier), gross=g)

def sale_price_from_input(*, gross=None, net=None, multiplier: Decimal | None = None) -> SalePrice | None:
    """Regla de escritura de ADR-0151: el bruto manda; el neto solo se usa si falta el bruto."""
    if gross is not None:
        return sale_price_from_gross(gross, multiplier)
    if net is not None:
        return sale_price_from_gross(gross_from_net(net, multiplier), multiplier)
    return None
```

Fixture (`shared/vat-rounding-cases.json`), con multiplicador 1.19:
`[{"gross":1450,"net":1218},{"gross":1449,"net":1218},{"gross":1451,"net":1219},{"gross":1190,"net":1000},{"gross":9990,"net":8395},{"gross":0,"net":0},{"gross":1,"net":1}, …]`, más casos `net→gross` y al menos dos casos de borde `.5`. Calcular los valores con `vat.py` y revisarlos a mano antes de fijarlos.

- [ ] Test que lee el fixture y verifica `net_from_gross` y `gross_from_net`.
- [ ] Test de propiedad: para `n` en `range(0, 200_000, 7)`, `net_from_gross(gross_from_net(n)) == n`.
- [ ] Test de `sale_price_from_input`: bruto y neto inconsistentes → manda el bruto; solo neto → hace el viaje de ida y vuelta; nada → `None`.
- [ ] Implementar y dejar en verde. Commit.

### Task 2: `Product` — derivación determinista y `price_surcharge_gross`

**Files:**
- Modify: `backend/inventory/models.py` (`Product.save` ~l.914-940; campo nuevo junto a `price_surcharge` ~l.727)
- Create: `backend/inventory/migrations/0039_product_price_surcharge_gross.py` (solo esquema)
- Test: `backend/inventory/tests/test_sale_price_authority.py`

- [ ] Tests:
  - crear con solo bruto 1450 → neto 1218;
  - crear con solo neto 1218 → bruto 1449;
  - actualizar enviando `sale_price=1000` y `sale_price_gross=1450` → 1450 / 1218, **independiente del valor anterior** (probar partiendo de 1000/1190 y de 1218/1450);
  - `save()` no ejecuta una consulta extra de la instancia (`django_assert_num_queries`).
- [ ] Reemplazar el bloque `if self.pk: old_instance = …` por:
  ```python
  price = sale_price_from_input(gross=self.sale_price_gross or None, net=self.sale_price or None)
  if price: self.sale_price, self.sale_price_gross = price.net, price.gross
  ```
  Bruto 0 y neto > 0 cuenta como «solo neto» (productos legados). Ambos en 0 queda en 0.
- [ ] Agregar `price_surcharge_gross` (`DecimalField(12, 0, null=True, blank=True)`, help: «Recargo con IVA sobre el bruto del template»). `price_surcharge` queda deprecado (help_text) y `save()` lo deriva: `net_from_gross(price_surcharge_gross)`.
- [ ] `makemigrations inventory` y luego `makemigrations --check`. Commit.

### Task 3: `PricingRule` y `ProductUoMPrice`

**Files:**
- Modify: `backend/inventory/models.py` (`PricingRule.save` ~l.1895, `ProductUoMPrice.save` ~l.2002)
- Test: `backend/inventory/tests/test_sale_price_authority.py`

- [ ] Tests equivalentes a los de la Task 2 para `fixed_price` / `fixed_price_gross` y `price_net` / `price_gross`. Una regla DISCOUNT_PERCENTAGE (sin precios) no se altera.
- [ ] Ambos `save()` pasan a usar `sale_price_from_input`. Se elimina la rama `try/except Exception: pass` de `PricingRule`. Commit.

### Task 4: `PricingService` y servicios de venta sin aritmética propia

**Files:**
- Modify: `backend/inventory/services.py`: `resolve_product_price` (~l.781-925), `resolve_variant_price` (~l.940-960), `get_effective_sale_price` (~l.964), anotación por lote (~l.1584-1770)
- Modify: `backend/sales/services.py:69-85`, `backend/sales/return_services.py:136-141`
- Test: `backend/inventory/tests/test_pricing_resolution.py` (extender), `backend/sales/tests/test_sale_line_pricing_provenance.py`

- [ ] Tests:
  - variante SURCHARGE con template de bruto 1450 y recargo bruto 600 → 2050 (neto 1723) por `resolve_product_price`, por `resolve_variant_price` y por la anotación por lote (las tres coinciden);
  - una devolución sin línea de origen usa `sale_price_gross` (entero, no `1449.42`).
- [ ] Reemplazar cada `* get_vat_multiplier()` / `* vat_mult` / `/ vat_mult` por `gross_from_net` / `net_from_gross`. El recargo usa `price_surcharge_gross` directo. El fallback `product.sale_price_gross or (sale_price * m)` se simplifica a `sale_price_gross`, porque desde la Task 6 siempre está poblado.
- [ ] `resolve_variant_price` SURCHARGE: `sale_price_from_gross(t.sale_price_gross + (variant.price_surcharge_gross or 0))`.
- [ ] Correr las suites `inventory/tests/test_pricing_resolution.py` y `sales/tests/`. Commit.

### Task 5: Serializers — escritura con el bruto, `min_variant_price_gross`

**Files:**
- Modify: `backend/inventory/serializers.py`: `ProductWriteSerializer` (l.527), `ProductSerializer` (l.208), `ProductListSerializer.get_min_variant_price` (l.474), `PricingRuleSerializer` (l.89), `ProductUoMPriceSerializer` (l.33)
- Modify: `docs/20-contracts/api-contracts.md` (bloque Product, ~l.479)
- Test: `backend/inventory/tests/test_sale_price_authority.py` (endpoint), `backend/inventory/tests/test_product_list_joins.py` (conteo de consultas)

- [ ] Tests de endpoint: `PATCH /inventory/products/{id}/` con ambos campos inconsistentes → la respuesta trae 1450 / 1218. Con solo `sale_price` → bruto derivado.
- [ ] Exponer `price_surcharge_gross` (lectura y escritura) y `min_variant_price_gross`: el mínimo de los brutos resueltos de `obj.variants.all()`, usando la lógica de `resolve_variant_price` sin consultas (el template es `obj`). El conteo de consultas del listado no cambia (`ci_gate`).
- [ ] `min_variant_price` (neto) se mantiene y se marca deprecado en `api-contracts.md`. Documentar ahí la regla de escritura y enlazar ADR-0151. Commit.

### Task 6: Migración de datos + comando de auditoría

**Files:**
- Create: `backend/inventory/management/commands/audit_sale_prices.py`, `backend/inventory/migrations/0040_rederive_sale_prices.py`
- Test: `backend/inventory/tests/test_rederive_sale_prices.py`

- [ ] `audit_sale_prices [--apply]` recorre `Product`, `PricingRule` y `ProductUoMPrice` con `.iterator()` y `bulk_update`. Calcula `sale_price_from_input(gross=…, net=…)` y, para el recargo, `price_surcharge_gross = gross_from_net(price_surcharge)` si es nulo. Sin `--apply` solo informa cuántas filas cambian y lista las primeras 20 (id, antes, después).
- [ ] La migración `RunPython` llama a la misma función de servicio con `apply=True`, con `reverse_code=noop`.
- [ ] Tests: idempotencia (la segunda corrida informa 0 cambios); fila 1218/1449 → 1218/1449 sin cambio; fila 1000/1450 → 1218/1450; recargo neto 504 → bruto 600.
- [ ] Ejecutar `audit_sale_prices` sin `--apply` en el servidor de desarrollo y pegar el resumen en el PR. Commit.

### Task 7: `frontend/lib/vat.ts` + paridad

**Files:**
- Create: `frontend/lib/vat.ts`, `frontend/lib/__tests__/vat.test.ts`
- Modify: `frontend/lib/pricing-utils.ts` (`netToGross` / `grossToNet` delegan en `vat.ts` y su `taxRate` pasa a ser obligatorio)

```ts
// frontend/lib/vat.ts — espejo de backend/accounting/vat.py (ADR-0151)
export const grossFromNet = (net: number, multiplier: number): number => Math.round(net * multiplier)
export const netFromGross = (gross: number, multiplier: number): number => Math.round(gross / multiplier)
export const salePriceFromGross = (gross: number, multiplier: number) => {
    const g = Math.round(gross)
    return { gross: g, net: netFromGross(g, multiplier) }
}
```

- [ ] El test importa `../../../shared/vat-rounding-cases.json` (`resolveJsonModule` ya está activo) y verifica los mismos casos que pytest.
- [ ] Al volver obligatorio el parámetro de `PricingUtils`, `npm run type-check` lista todos los consumidores: esa es la lista de trabajo de las Tasks 8 a 10. Commit.

### Task 8: Mostrar el bruto de la API (tarjetas, selectores, POS)

**Files:**
- Modify: `frontend/features/inventory/utils/productCardModel.ts:154-162`, `frontend/components/selectors/ProductSelector.tsx:99`, `frontend/components/selectors/ProductGridPicker/VariantSelectorModal.tsx:146`, `frontend/features/inventory/types` (`min_variant_price_gross`, `price_surcharge_gross`)
- Test: `frontend/features/inventory/utils/__tests__/productCardModel.test.ts` (crear o extender)

- [ ] Test: producto con `sale_price=1218` y `sale_price_gross=1450` → `getPrice().gross === 1450`. Plantilla con `min_variant_price_gross=2050` → `kind: 'from'`, `gross: 2050`.
- [ ] `getPrice` lee `sale_price_gross` y `min_variant_price_gross` sin convertir nada. Los selectores dejan de usar `netToGross` como fallback. Commit.

### Task 9: Formularios — enviar solo el bruto

**Files:**
- Modify: `frontend/features/inventory/components/product/ProductPricingSection.tsx:32-40`, `frontend/features/inventory/components/ProductDrawer.tsx:335,497`, `frontend/features/sales/components/PricingRuleDrawer.tsx:316,338`, `frontend/features/inventory/components/product/VariantQuickEditForm.tsx` (recargo → `price_surcharge_gross`)
- Test: tests existentes de `ProductDrawer` / `PricingRuleDrawer` / `VariantQuickEditForm`, más un caso nuevo por formulario

- [ ] Los dos inputs (neto y bruto) siguen editables. Escribir el neto calcula el bruto con `grossFromNet(net, multiplier)`, y el neto mostrado siempre es `netFromGross(bruto)`. El payload envía solo el bruto: `sale_price_gross`, `fixed_price_gross` o `price_surcharge_gross`.
- [ ] Test: escribir el bruto 1450 → payload `{ sale_price_gross: 1450 }` sin `sale_price`. Escribir el neto 1218 → payload `{ sale_price_gross: 1449 }`.
- [ ] El multiplicador sale de `useVatRate()` en todos los formularios. Commit.

### Task 10: POS, checkout y compras (conversiones restantes)

**Files:**
- Modify: `frontend/features/pos/components/POSClientView.tsx:328`, `frontend/features/pos/utils/cart-utils.ts:18` (sin `= 1.19`), `frontend/features/sales/components/checkout/OrderSummaryCard.tsx:39`, `frontend/features/purchasing/components/checkout/PurchaseOrderSummaryCard.tsx:23`, `frontend/features/sales/components/SalesOrdersClientView.tsx:64`
- Modify (lado neto, solo aritmética): `frontend/features/production/components/BOMDrawer.tsx:234,267,312`, `…/shared/OutsourcedServiceForm.tsx:97`, `…/steps/OutsourcingAssignmentStep.tsx:76,126,134`, `…/WorkOrderWizard.tsx:1093,1095`

- [ ] Reemplazar las multiplicaciones y divisiones inline por `grossFromNet` / `netFromGross` con el `multiplier` de `useVatRate()`.
- [ ] En producción, los netos de proveedor con 2 decimales (`toFixed(2)`) **se mantienen**: es compra, no cambia de autoridad. Solo se centraliza la operación (`netFromGross` admite un parámetro opcional `decimals` si hace falta; agregar el caso al fixture).
- [ ] `npm run test -- features/pos features/production features/sales`, `npm run type-check`, `npm run lint`. Commit.

### Task 11: Guardia `ci_gate`

**Files:**
- Create: `backend/core/tests/test_vat_arithmetic_gate.py`

- [ ] Test `@pytest.mark.ci_gate` que recorre `backend/**/*.py` (excluye `tests/`, `migrations/` y `accounting/vat.py`) y `frontend/{features,components,hooks,app,lib}/**/*.{ts,tsx}` (excluye `node_modules`, `*.test.*`, `*.stories.*` y `lib/vat.ts`), buscando:
  - backend: `get_vat_multiplier\(\)\s*[*/]`, `[*/]\s*get_vat_multiplier\(\)`, `[*/]\s*vat(_mult|_rate)?\b`;
  - frontend: `\b1\.19\b`, `[*/]\s*vatMultiplier\b`, `netToGross|grossToNet` fuera de `lib/`.
- [ ] `ALLOWED = {"backend/treasury/card_transaction_service.py": "IVA sobre comisión, no es precio de venta"}`. El test también falla si una entrada de `ALLOWED` ya no coincide con nada (ratchet).
- [ ] Verificar que falla si se agrega una línea prohibida en un archivo temporal y que pasa tras las Tasks 4 a 10. Commit.

### Task 12: Docs y verificación end-to-end

**Files:**
- Modify: `docs/10-architecture/adr/0151-…md` y `README.md` del índice (status → Accepted), `docs/10-architecture/data-flow.md` (sección de procedencia del precio: una línea que remita a ADR-0151)

- [ ] Backend: `pytest -m ci_gate -q` y las suites `inventory`, `sales` y `billing` completas.
- [ ] Frontend: `npm run type-check`, `npm run lint`, `npm run test`.
- [ ] Servidor de desarrollo: aplicar migraciones y luego `audit_sale_prices` (debe informar 0 cambios pendientes). Producto 11: la vista de productos (tarjetas y tabla), la grilla del POS y la línea del carrito muestran **$1.450**.
- [ ] Editar el producto 11 escribiendo el bruto 1450 dos veces seguidas → sigue en 1450 / 1218. Escribir el neto 1218 → 1449 / 1218, que es lo esperado y queda documentado.
- [ ] Commit y PR con el resumen del `audit_sale_prices` previo.
