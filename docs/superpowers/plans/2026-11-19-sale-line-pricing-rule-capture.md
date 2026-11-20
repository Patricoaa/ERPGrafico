# Captura de regla de precio en SaleLine (Fase 1 del hub de analítica) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cada línea de venta nueva registra qué regla de precio se aplicó, el precio de lista previo y el origen del precio.

**Architecture:** `PricingService` expone una resolución que devuelve precio, precio de lista y regla (hoy solo devuelve el precio). `SalesService.create_sale_order` (camino único de pedidos y POS) la usa para sellar tres campos nuevos en `SaleLine`; si el precio enviado no coincide con el resuelto, la línea queda `MANUAL`. Migración con campos nulos, sin backfill.

**Tech Stack:** Django 5, DRF, pytest, simple_history.

**Spec:** `docs/superpowers/specs/2026-11-19-product-analytics-hub-design.md` (sección "Fase 1")

## Global Constraints

- Playbooks: `docs/30-playbooks/add-migration.md` (leer antes de la Task 2).
- Views ≤ 20 líneas; lógica en `services.py`; sin N+1 (una resolución por línea es aceptable en creación, no hay listas).
- El cliente NO puede fijar `pricing_rule`, `list_unit_price_gross` ni `price_source`: no se agregan a `SaleLineSerializer.Meta.fields` como escribibles.
- `get_product_price` y `get_effective_sale_price` conservan firma y resultado (el endpoint `views.py:293` no cambia).
- Tests: `cd backend && DEBUG=1 CACHE_BACKEND=locmem CHANNEL_BACKEND=locmem venv/bin/python -m pytest <ruta> -v`.
- Fuera de alcance: líneas de notas de débito (`billing/note_checkout_service.py`) y despachos suplementarios (`sales/services.py:397`): quedan con campos nulos.

## Review Focus

- Línea con `discount_percentage`/`discount_amount` y precio igual al resuelto: sigue siendo `RULE`/`LIST`, no `MANUAL` (el descuento es otro campo).
- Línea solo con `unit_price` (neto) y sin `unit_price_gross`: la comparación usa el neto redondeado; un desfase de redondeo de 1 peso no la vuelve `MANUAL`.
- Regla `PACKAGE_FIXED` (precio por paquete / cantidad): coincide con el precio unitario resuelto.
- Regla vencida o inactiva: no se registra aunque el precio coincida con su valor.
- Variante con `SURCHARGE` y regla del template padre: se registra la regla del padre.
- Línea sin `product` (texto libre): sin regla, `list_unit_price_gross` nulo, `price_source` nulo.
- `uom` nula en la línea: no rompe la creación; se resuelve con la UoM del producto.

---

### Task 1: Resolución de precio con regla

**Files:**
- Modify: `backend/inventory/services.py` (`PricingService.get_product_price`, ~líneas 752-902)
- Test: `backend/inventory/tests/test_pricing_resolution.py`

**Interfaces:**
- Produces:
  - `@dataclass(frozen=True) class PriceResolution: price_gross: Decimal; list_price_gross: Decimal; rule: PricingRule | None; source: str` donde `source` ∈ `"LIST" | "UOM_PRICE" | "RULE"`. Definida en `inventory/services.py`.
  - `PricingService.resolve_product_price(product: Product, quantity: Decimal, date=None, uom: UoM | None = None) -> PriceResolution`
  - `PricingService.get_product_price(...)` pasa a ser `return PricingService.resolve_product_price(...).price_gross` (misma firma y valor).

- [ ] **Step 1: Write failing tests** en `test_pricing_resolution.py` (fixtures: producto vendible con `sale_price_gross`, UoM, reglas): `test_no_rule_returns_list_price_and_source_list`, `test_uom_price_returns_source_uom_price`, `test_fixed_rule_returns_rule_and_list_price` (assert `res.rule == rule`, `res.price_gross == rule.fixed_price_gross`, `res.list_price_gross == product.sale_price_gross`, `res.source == "RULE"`), `test_package_fixed_rule_returns_unit_price`, `test_discount_percentage_rule`, `test_expired_rule_is_ignored`, `test_inactive_rule_is_ignored`, `test_get_product_price_matches_resolution` (mismo valor que `resolve_product_price(...).price_gross` en cada caso anterior).
- [ ] **Step 2: Run** `pytest backend/inventory/tests/test_pricing_resolution.py -v`; Expected: FAIL (`resolve_product_price` no existe).
- [ ] **Step 3: Implement** `PriceResolution` y `resolve_product_price` moviendo el cuerpo actual de `get_product_price` (incluida la rama sin UoM, que devuelve `source="LIST"` y `rule=None`); `list_price_gross` es el `base_price` previo a las reglas, `source="UOM_PRICE"` si salió de `ProductUoMPrice` y no hubo regla, `"RULE"` si una regla se aplicó. `get_product_price` delega.
- [ ] **Step 4: Run** el archivo nuevo y `pytest backend/inventory -k "pric or effective" -v`; Expected: PASS.
- [ ] **Step 5: Commit** `refactor(inventory): resolve_product_price expone la regla aplicada`.

### Task 2: Campos en SaleLine y migración

**Files:**
- Modify: `backend/sales/models.py` (`SaleLine`, junto a `discount_amount`, ~línea 393)
- Create: `backend/sales/migrations/0023_saleline_pricing_provenance.py` (generada por `makemigrations`)
- Test: `backend/sales/tests/test_sale_line_pricing_provenance.py`

**Interfaces:**
- Produces en `SaleLine`:
  - `pricing_rule = models.ForeignKey("inventory.PricingRule", null=True, blank=True, on_delete=models.SET_NULL, related_name="sale_lines", editable=False)`
  - `list_unit_price_gross = models.DecimalField(max_digits=12, decimal_places=0, null=True, blank=True, editable=False)`
  - `price_source = models.CharField(max_length=12, null=True, blank=True, editable=False)` con `class PriceSource(models.TextChoices): LIST, UOM_PRICE, RULE, MANUAL` (valores iguales al nombre) definida en `SaleLine`.

- [ ] **Step 1: Write failing test** `test_new_fields_default_to_null`: una `SaleLine` creada sin los campos tiene los tres en `None`.
- [ ] **Step 2: Run**; Expected: FAIL (`AttributeError`/campo inexistente).
- [ ] **Step 3: Implement** campos y `PriceSource`; `python manage.py makemigrations sales`; verificar que la migración solo agrega los 3 campos.
- [ ] **Step 4: Run** el test y `python manage.py makemigrations --check --dry-run`; Expected: PASS y "No changes detected".
- [ ] **Step 5: Commit** `feat(sales): campos de procedencia de precio en SaleLine`.

### Task 3: Sellar la procedencia al crear la orden

**Files:**
- Modify: `backend/sales/services.py` (`SalesService.create_sale_order`, línea ~41; nuevo helper estático `_price_provenance`)
- Test: `backend/sales/tests/test_sale_line_pricing_provenance.py` (mismo archivo)

**Interfaces:**
- Consumes: `PricingService.resolve_product_price`, `PriceResolution`, `SaleLine.PriceSource`, campos de la Task 2.
- Produces: `SalesService._price_provenance(line_data: dict) -> dict` que devuelve las claves `pricing_rule`, `list_unit_price_gross`, `price_source` a mezclar en `SaleLine.objects.create(order=order, **line_data, **provenance)`. Sin `product` devuelve `{}`.

- [ ] **Step 1: Write failing tests** (vía `SalesService.create_sale_order` con datos de orden mínimos; fixtures como `sales/tests/test_create_order_from_pos.py`): `test_rule_price_is_stamped_as_rule` (línea con `unit_price_gross` = precio de la regla → `price_source == "RULE"`, `pricing_rule == rule`, `list_unit_price_gross == product.sale_price_gross`), `test_list_price_is_stamped_as_list`, `test_uom_price_is_stamped_as_uom_price`, `test_different_price_is_manual_without_rule`, `test_discount_does_not_make_line_manual`, `test_net_only_line_tolerates_one_peso_rounding`, `test_expired_rule_not_recorded`, `test_line_without_product_has_null_provenance`, `test_line_with_null_uom_does_not_fail`, `test_pos_serializer_path_stamps_provenance` (crear por `SaleOrderSerializer(...).save()` con una línea con regla).
- [ ] **Step 2: Run** `pytest backend/sales/tests/test_sale_line_pricing_provenance.py -v`; Expected: FAIL (campos sin sellar).
- [ ] **Step 3: Implement** `_price_provenance`: resuelve con `product`, `quantity` (Decimal), `uom=line_data.get("uom")`, fecha de hoy; compara contra `unit_price_gross` enviado, o, si falta, contra `unit_price` neto frente al neto resuelto (`price_gross / get_vat_multiplier()` redondeado half-up); tolerancia de 1 peso. Coincide → `price_source` = `res.source`, `pricing_rule` = `res.rule`; no coincide → `price_source = MANUAL`, `pricing_rule = None`; en ambos `list_unit_price_gross = res.list_price_gross`. `create_sale_order` mezcla el resultado en cada línea.
- [ ] **Step 4: Run** el archivo y `pytest backend/sales -v`; Expected: PASS (si fallan tests previos, comprobar antes con `git stash` si ya fallaban).
- [ ] **Step 5: Commit** `feat(sales): registra regla, precio de lista y origen al crear líneas de venta`.

### Task 4: Documentación y verificación final

**Files:**
- Modify: la doc de modelo/contrato de ventas que describa `SaleLine` (buscar con `grep -rn "SaleLine" docs/10-architecture docs/20-contracts`) y `docs/10-architecture/data-flow.md` si describe la resolución de precios.

- [ ] **Step 1:** Documentar los 3 campos, que no los fija el cliente, el significado de `MANUAL`, que las filas anteriores y las líneas de notas de débito/despachos suplementarios quedan nulas, y que `get_product_price` delega en `resolve_product_price`.
- [ ] **Step 2: Run** `ruff check backend` (solo archivos tocados) y `pytest backend/sales backend/inventory -q`; Expected: sin errores nuevos.
- [ ] **Step 3: Commit** `docs(sales): procedencia de precio en SaleLine`.
