---
layer: 10-architecture
doc: adr-0014
status: Accepted
date: 2026-05-07
deciders: [AdminImprenta]
relates-to: [F2-T07, docs/50-audit/Arquitectura Django/20-task-list.md]
---

# ADR-0014 — Estandarización de `decimal_places` en totales de documentos transaccionales

## Contexto

La Fase 2 de la refactorización de arquitectura (ver [10-roadmap.md](../../50-audit/Arquitectura%20Django/10-roadmap.md)) requiere crear una clase abstracta `TransactionalDocument` que centralice los campos `total_net`, `total_tax` y `total` compartidos por los documentos cabecera del ERP. Esta clase debe declarar un único valor de `decimal_places` para esos campos.

### Estado del codebase hoy

Auditoría realizada el 2026-05-07 sobre todos los modelos con campos de totales:

| Modelo | `total_net` | `total_tax` | `total` |
|--------|-------------|-------------|---------|
| `SaleOrder` | `=2` | `=2` | `=2` |
| `SaleDelivery` | `=0` | `=0` | `=0` |
| `SaleReturn` | `=0` | `=0` | `=0` |
| `PurchaseOrder` | `=0` | `=0` | `=0` |
| `Invoice` | `=0` | `=0` | `=0` |
| `tax/models.py` (F29, LibroIVA) | `=0` | `=0` | `=0` |
| `hr/models.py` (Payroll totals) | `=0` | `=0` | `=0` |

`SaleOrder` es el único modelo transaccional con `decimal_places=2`. Los demás 4 documentos cabecera, el módulo tributario completo y el módulo de remuneraciones usan `=0`. La inconsistencia fue introducida en una iteración temprana de `SaleOrder` y nunca se propagó al resto.

### Consumidores críticos afectados por `decimal_places`

Los siguientes sites hacen `Sum('total')` o `Sum('total_net')` cruzando modelos:

- `finances/services.py:544` — `Sum('total')` sobre `SaleOrder`
- `finances/services.py:608,614,620` — `Sum('total')` sobre `Invoice` y `PurchaseOrder`
- `accounting/services.py:385–409` — usa `order.total_net` / `order.total_tax` como valores de asiento

Si `SaleOrder` quedara en `=2` mientras los demás están en `=0`, Django no lanzaría error pero las comparaciones de agregados entre modelos devolverían distintas representaciones de Python (`Decimal('1190.00')` vs `Decimal('1190')`), generando inconsistencias silenciosas en reportes.

## Decisión

**`decimal_places=0` para todos los campos `total_net`, `total_tax` y `total` en `TransactionalDocument`.**

`SaleOrder` será migrado de `=2` a `=0`.

## Justificación

### 1. Legalidad CLP

El Peso Chileno (CLP) no tiene centavos por definición del Banco Central. El SII rechaza documentos tributarios electrónicos (DTE) con montos decimales. Todos los totales de facturas, boletas, notas de crédito y débito son enteros. `decimal_places=2` en un campo de total CLP no agrega precisión — solo genera almacenamiento extra y posibles `.00` superfluos.

### 2. La mayoría del codebase ya usa `=0`

4 de los 5 documentos transaccionales, el módulo tributario completo y el módulo de remuneraciones ya usan `=0`. Migrar `SaleOrder` a `=0` normaliza la excepción; mantener `=2` requeriría migrar los otros 4 modelos hacia arriba — mucho mayor impacto con cero ganancia práctica.

### 3. Impacto de migración `=2 → =0` es cero en datos reales

En CLP, ningún `SaleOrder.total` tiene decimales significativos en la base de datos. La migración de `ALTER COLUMN` hará un cast implícito que trunca los ceros (`1190.00 → 1190`). No hay pérdida de información.

### 4. Descarte de la opción `=2` (multi-moneda futura)

El [roadmap de refactorización](../../50-audit/Arquitectura%20Django/10-roadmap.md) lista explícitamente entre sus anti-objetivos: _"No introducir microservicios. Esta es una refactorización dentro del monolito."_ y no hay requerimiento de multi-moneda en el backlog actual. Diseñar para multi-moneda con `=2` ahora sería YAGNI. Si en el futuro se implementa multi-moneda, ese ADR propio decidirá la precisión adecuada (probablemente un campo separado de conversión, no cambiar `decimal_places` en los totales CLP).

## Consecuencias

### Campos que cambian

| Campo | Antes | Después | Acción |
|-------|-------|---------|--------|
| `SaleOrder.total_net` | `decimal_places=2` | `=0` | Migration ALTER + cast |
| `SaleOrder.total_tax` | `decimal_places=2` | `=0` | Migration ALTER + cast |
| `SaleOrder.total_discount_amount` | `decimal_places=2` | `=0` | Migration ALTER + cast |
| `SaleOrder.total` | `decimal_places=2` | `=0` | Migration ALTER + cast |

### Campos que NO cambian (fuera de scope)

Estos campos usan `decimal_places=2` por razones válidas y **no se tocan**:

| Campo | Por qué se mantiene `=2` |
|-------|--------------------------|
| `SaleLine.discount_amount` | Porcentaje de descuento por línea puede ser fraccionario |
| `SaleLine.tax_rate` | `19.00%` — el `%` tiene decimales |
| `TreasuryMovement.amount` | Movimiento de caja puede incluir centavos (ajustes manuales) |
| `hr/PayrollItem.amount` | Remuneración bruta puede tener fracción antes de redondeo |
| `inventory/SubscriptionProduct.amount` | Cuota de suscripción puede ser fraccionaria |

### Serializers a revisar tras el merge

Los siguientes serializers están hardcodeados con `decimal_places=2` apuntando a campos de totales de `SaleOrder` — deberán actualizarse a `=0` para coincidir con la DB:

- `purchasing/serializers.py:320-321` (`amount_net`, `amount_tax`) — verificar que no apuntan a `SaleOrder`
- `accounting/serializers.py:7-8` — apuntan a `JournalItem.debit/credit`, no impactados
- `billing/note_serializers.py:13,23-25` — ya en `=0`, sin cambio

### Validación pre-merge (T-09)

Antes de mergear la migration de `SaleOrder`:

```bash
# Verificar que no hay valores con decimales significativos en producción
python manage.py shell -c "
from django.db.models import Q
from decimal import Decimal
from sales.models import SaleOrder
anomalies = SaleOrder.objects.filter(
    Q(total__ne=SaleOrder.objects.filter(id=F('id')).values('total').annotate(i=Cast('total', IntegerField()))... )
)
# Forma directa: buscar filas donde total != FLOOR(total)
from django.db import connection
with connection.cursor() as c:
    c.execute('SELECT COUNT(*) FROM sales_saleorder WHERE total != FLOOR(total) OR total_net != FLOOR(total_net) OR total_tax != FLOOR(total_tax)')
    print(c.fetchone()[0], 'filas con decimales significativos')
"
```

Si el resultado es `0`, la migración es safe. Si es `> 0`, investigar antes de proceder.

## Alternativas descartadas

| Alternativa | Por qué se descartó |
|-------------|---------------------|
| `decimal_places=2` en abstracta (todos suben) | Migra 4 modelos en lugar de 1; viola legalidad CLP en tax/hr; YAGNI para multi-moneda |
| Campo separado `total_usd` / `total_uf` | Fuera de scope de F2; requiere ADR propio cuando se implemente multi-moneda |
| Mantener inconsistencia (cada modelo declara su propio `decimal_places`) | Imposible en una abstracta; el propósito de F2 es justamente eliminar esta redundancia |
