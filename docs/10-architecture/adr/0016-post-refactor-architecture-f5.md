# ADR-0016: Arquitectura Post-Refactor — F5 GenericForeignKey + ProductTypeStrategy

**Status:** Accepted  
**Date:** 2026-05-08  
**Authors:** Architecture team  
**Supersedes:** N/A  
**Related:** ADR-0011 (Strategy Pattern), ADR-0015 (DocumentService + Metadata Schema)

---

## Contexto

Con la Fase 5 completada, la base de código ha pasado de un modelo monolítico con polimorfismo implícito a una arquitectura con patrones explícitos. Este ADR documenta las decisiones arquitectónicas finales del proyecto de refactorización.

---

## Decisiones

### D-01: GenericForeignKey para relaciones polimórficas de origen

**Problema:** `JournalEntry` tenía 60+ líneas de `try/hasattr` para resolver su documento origen (Invoice, SaleOrder, PurchaseOrder, TreasuryMovement, StockMove). `TreasuryMovement` y `Invoice` tenían FKs XOR.

**Decisión:** Introducir GFK `source_document` en `JournalEntry`, `allocated_to` en `TreasuryMovement`, y `source_order` en `Invoice`.

**Reglas:**
- GFK **sí** cuando el conjunto de tipos crece con el tiempo o medio campo siempre es `null`.
- GFK **no** para `JournalItem.account`, `SaleOrder.customer`, `SaleLine.product` — FK explícita con `select_related` preserva performance.
- Las columnas FK legacy (`journal.invoice`, `journal.payment`, etc.) permanecen durante la ventana de deprecación (≥1 sprint) hasta que ningún código las referencie.

**Mitigación de performance:** `select_related('source_content_type')` en un solo query. Índice B-tree sobre `source_content_type_id` creado automáticamente (FK a `contenttypes`). Para listados masivos usar `prefetch_related` + `in_bulk()` por tipo.

### D-02: ProductManufacturingProfile como modelo 1:1 opcional

**Problema:** `Product` tenía 12 campos `mfg_*` planos aplicables solo cuando `product_type=MANUFACTURABLE`.

**Decisión:** Crear `ProductManufacturingProfile` como modelo 1:1 opcional. Los campos `mfg_*` en `Product` quedan deprecated (columnas siguen en DB durante ventana de migración). Acceso vía `product.mfg_profile`.

**Invariante:** Un `ProductManufacturingProfile` solo existe para productos con `product_type='MANUFACTURABLE'`.

**Etapa siguiente (sprint +1):** Migration que elimina físicamente las columnas `mfg_*` de `Product` una vez que todos los accesos hayan sido migrados al perfil.

### D-03: ProductTypeStrategy por tipo de producto

**Problema:** Lógica dispersa con `if product_type in [...]` en views, servicios y el propio modelo.

**Decisión:** ABC `ProductTypeStrategy` con implementaciones para cada uno de los 5 tipos. Registry `PRODUCT_TYPE_STRATEGIES` en `inventory/strategies/product_type.py`.

**Contrato:**
```python
strategy = get_product_type_strategy(product.product_type)
strategy.tracks_inventory   # bool
strategy.can_have_bom       # bool
strategy.costing_method     # 'average' | 'none'
strategy.get_asset_account(product)   # Account | None
strategy.get_income_account(product)  # Account | None
strategy.get_expense_account(product) # Account | None
strategy.validate(product)  # raises ValidationError if invalid
```

---

## Consecuencias

### Positivas
- `JournalEntry.get_source_documents` pasó de 60 líneas a 5 líneas via `source_info`.
- `TreasuryMovement` puede asociarse a cualquier futuro tipo de documento sin migración de schema.
- Agregar un nuevo tipo de producto requiere solo una nueva subclase de `ProductTypeStrategy`.
- Los serializers de reporting pueden usar `select_related('source_content_type')` para queries eficientes.

### Negativas / Riesgos aceptados
- **GFK no permite `select_related` cross-type.** Mitigado con `prefetch_related` + índices.
- **Ventana de deprecación de columnas legacy.** El código que accede a `journal.invoice` directo seguirá funcionando pero no recibirá data nueva. Requiere grep antes de eliminar.
- **`Product.mfg_*` campos legacy.** Deben eliminarse en sprint +1 con migration explícita.

---

## Anti-objetivos confirmados

Esta fase no modificó:
- ❌ No se migraron PKs a UUIDs.
- ❌ No se reescribió `Account` ni `JournalEntry` (complejidad de dominio).
- ❌ No se introdujeron microservicios.
- ❌ No se cambió el ORM (Django ORM).

---

## Estado del sistema post-F5

| Métrica | Pre-refactor | Post-F5 |
|---------|-------------|---------|
| Líneas en `Model.save()` con side-effects | ~600 | <100 |
| Ocurrencias de `__class__.__name__` discriminador | 8 | 0 |
| Apps en UniversalRegistry | 0 | 12 |
| Modelos con CRUD via `<EntityForm />` | 0 | ≥10 |
| Coverage `core/strategies/` | n/a | >90% |
| Patrones GFK implícitos (hasattr chain) | 3 | 0 |
| ProductTypeStrategy implementadas | 0 | 5 |
