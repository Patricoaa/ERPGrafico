# 03 — Backend models (6 modelos + ER + data migration)

> 6 modelos en `backend/legacy/models.py`. ER simple. Una sola data migration ruidosa (`0002`).

## 0. Estructura

```
backend/
└── legacy/
    ├── __init__.py
    ├── apps.py
    ├── models.py            ← 6 modelos
    ├── admin.py             ← registro mínimo (LegacyImport only — ver §1.6)
    ├── migrations/
    │   ├── 0001_initial.py  ← auto-generado por makemigrations
    │   └── 0002_legacy_seed.py  ← UoM + Warehouse + LEGACY-OT-PRODUCT (RUIDOSA)
    ├── importers/
    │   ├── __init__.py
    │   ├── contacts.py
    │   ├── vendors.py
    │   ├── orders.py
    │   ├── payments.py
    │   └── base.py          ← conexión, batching, errores
    ├── adapters.py          ← LegacySaleNoteAsSaleOrderShape
    ├── services/
    │   ├── register_payment.py  ← LegacyPaymentRegistration
    │   └── work_order_builder.py
    ├── permissions.py       ← 3 permisos
    ├── serializers.py
    ├── views.py             ← imports/commit + sale-notes/<id>/register-payment
    ├── urls.py
    ├── exceptions.py
    └── tests/
        ├── test_models.py
        ├── test_importers.py
        ├── test_api.py
        └── test_smoke.py
```

## 1. Modelos

### 1.1 `ContactLegacyOrigin` — N=2.843

| Campo | Tipo | Constraint | Notas |
|---|---|---|---|
| `id` | BigAutoField | PK | |
| `contact` | OneToOneField(`contacts.Contact`) | NOT NULL, related_name=`legacy_origin` | **CASCADE** on delete |
| `source_table` | CharField(32) | NOT NULL, default='clientes' | future-proof (clientes, prospectos) |
| `legacy_external_id` | IntegerField | NOT NULL | el `id` legacy |
| `raw_tax_id` | CharField(20) | NOT NULL | RUT original sin normalizar |
| `tax_id_exception` | BooleanField | NOT NULL, default=False | True si el RUT no pasa validación de módulo 11 |
| `created_at` | DateTimeField | NOT NULL, auto_now_add | |
| `updated_at` | DateTimeField | NOT NULL, auto_now | |

**Meta**:
- `unique_together = (('source_table', 'legacy_external_id'),)`
- `unique_together = (('contact',),)` redundante con OneToOne, omitido
- `ordering = ['-created_at']`
- `indexes = [Index(fields=['legacy_external_id'])]`

**Decisión**: no usar `GenericForeignKey` para `source_table` porque solo existe una fuente por ahora. Si en el futuro hay otra tabla (`prospectos`), se agrega columna o se migra a GFK.

### 1.2 `LegacyVendor` — N=137

| Campo | Tipo | Constraint | Notas |
|---|---|---|---|
| `id` | BigAutoField | PK | |
| `legacy_external_id` | IntegerField | NOT NULL, UNIQUE | el `id` legacy |
| `name` | CharField(120) | NOT NULL | |
| `category` | CharField(16) | NOT NULL, choices=[`interno`, `externo`] | default `externo` |
| `created_at` | DateTimeField | NOT NULL, auto_now_add | |
| `updated_at` | DateTimeField | NOT NULL, auto_now | |

**Decisión**: NO es `Contact` porque semánticamente es un proveedor externo (no un cliente). Si en el futuro se necesita que un LegacyVendor sea también cliente, se crea `Contact` aparte y se vincula con GFK (no en este alcance).

### 1.3 `LegacySaleNote` — N=7.960

| Campo | Tipo | Constraint | Notas |
|---|---|---|---|
| `id` | BigAutoField | PK | |
| `legacy_external_id` | IntegerField | NOT NULL, UNIQUE | el `id` legacy (≠ PK vivo) |
| `legacy_number` | CharField(20) | NOT NULL | el `numero` humano (ej. "12.345") |
| `issue_date` | DateField | NOT NULL | el `fecha` legacy |
| `customer` | ForeignKey(`contacts.Contact`) | NOT NULL, **PROTECT** | cliente de la NV |
| `related_contact` | ForeignKey(`contacts.Contact`) | NULL, **PROTECT** | cliente del cliente (solo vendor externo) |
| `vendor` | ForeignKey(`legacy.LegacyVendor`) | NOT NULL, **PROTECT** | |
| `category_snapshot` | CharField(64) | NOT NULL | "Impresion Digital" (texto, no FK) |
| `description` | TextField | NOT NULL | el `descripcion_texto` legacy |
| `quantity` | PositiveIntegerField | NOT NULL | |
| `net_price` | DecimalField(12, 0) | NOT NULL | CLP sin IVA |
| `tax_amount` | DecimalField(12, 0) | NOT NULL | CLP IVA |
| `total_price` | DecimalField(12, 0) | NOT NULL | CLP con IVA |
| `status` | CharField(16) | NOT NULL, choices=[`DRAFT`, `CONFIRMED`, `IN_PRODUCTION`, `DISPATCHED`, `PENDING`, `CANCELLED`] | ver §1.3.1 |
| `dispatched_at` | DateField | NULL | solo si `despachado=true` |
| `is_pending` | BooleanField | NOT NULL, default=False | flag `pendiente` legacy |
| `work_order` | OneToOneField(`production.WorkOrder`) | NULL | creado en phase 4 |
| `created_at` | DateTimeField | NOT NULL, auto_now_add | |
| `updated_at` | DateTimeField | NOT NULL, auto_now | |

**Meta**:
- `unique_together = (('legacy_external_id',),)`
- `indexes = [Index(fields=['issue_date']), Index(fields=['status']), Index(fields=['customer'])]`
- `ordering = ['-issue_date', '-legacy_external_id']`

#### 1.3.1 Mapeo `estado` legacy → `status` vivo

| Legacy `estado` | `status` | `is_pending` | `dispatched_at` |
|---|---|---|---|
| `despachado` | `DISPATCHED` | False | `fecha` |
| `no_despachado` | `IN_PRODUCTION` | False | NULL |
| `pendiente` | `PENDING` | True | NULL |
| `anulada` | (omitido) | — | — |

### 1.4 `LegacyPayment` — N=8.556

| Campo | Tipo | Constraint | Notas |
|---|---|---|---|
| `id` | BigAutoField | PK | |
| `sale_note` | ForeignKey(`legacy.LegacySaleNote`) | NOT NULL, **CASCADE**, related_name=`legacy_payments` | |
| `legacy_external_id` | IntegerField | NOT NULL, UNIQUE | el `id` legacy |
| `paid_at` | DateField | NOT NULL | |
| `amount` | DecimalField(12, 0) | NOT NULL | CLP |
| `method` | CharField(20) | NOT NULL, choices=[`efectivo`, `transferencia`, `cheque`] | |
| `created_at` | DateTimeField | NOT NULL, auto_now_add | |
| `updated_at` | DateTimeField | NOT NULL, auto_now | |

**Meta**:
- `unique_together = (('legacy_external_id',),)`
- `indexes = [Index(fields=['sale_note', 'paid_at'])]`

### 1.5 `LegacyPaymentRegistration` — N=crecimiento

| Campo | Tipo | Constraint | Notas |
|---|---|---|---|
| `id` | BigAutoField | PK | |
| `sale_note` | ForeignKey(`legacy.LegacySaleNote`) | NOT NULL, **CASCADE**, related_name=`registrations` | |
| `registered_by` | ForeignKey(`auth.User`) | NOT NULL, **PROTECT** | |
| `paid_at` | DateField | NOT NULL | |
| `amount` | DecimalField(12, 0) | NOT NULL | CLP |
| `method` | CharField(20) | NOT NULL, choices=[`efectivo`, `transferencia`, `cheque`] | |
| `notes` | TextField | NULL | opcional |
| `idempotency_key` | CharField(64) | NULL, UNIQUE | del header `Idempotency-Key` |
| `created_at` | DateTimeField | NOT NULL, auto_now_add | |
| `updated_at` | DateTimeField | NOT NULL, auto_now | |

**Meta**:
- `unique_together = (('idempotency_key',),)` solo si no es NULL
- `indexes = [Index(fields=['sale_note', 'paid_at'])]`

**Decisión clave**: este modelo **no** extiende `TreasuryMovement` ni se vincula a él. Es un modelo aparte, dedicado a pagos nuevos sobre NVs legacy. Esto preserva la decisión de NO tocar el sistema de tesorería/contabilidad.

### 1.6 `LegacyImport` — N=1 por corrida

| Campo | Tipo | Constraint | Notas |
|---|---|---|---|
| `id` | BigAutoField | PK | |
| `started_at` | DateTimeField | NOT NULL, auto_now_add | |
| `finished_at` | DateTimeField | NULL | |
| `started_by` | ForeignKey(`auth.User`) | NOT NULL, **PROTECT** | |
| `stage` | CharField(20) | NOT NULL, choices=[`contacts`, `vendors`, `orders`, `payments`, `all`] | |
| `status` | CharField(20) | NOT NULL, choices=[`RUNNING`, `COMPLETED`, `FAILED`] | |
| `rows_processed` | IntegerField | NOT NULL, default=0 | |
| `rows_created` | IntegerField | NOT NULL, default=0 | |
| `rows_skipped` | IntegerField | NOT NULL, default=0 | |
| `rows_failed` | IntegerField | NOT NULL, default=0 | |
| `error_log` | TextField | NULL | stacktrace si falló |
| `dry_run` | BooleanField | NOT NULL, default=False | |
| `legacy_dsn` | CharField(255) | NOT NULL | la DSN usada (sin password) |
| `idempotency_key` | CharField(64) | NULL, UNIQUE | si fue vía API |

**Decisión**: solo este modelo se registra en el **registry** (`backend/core/registry.py`) — los otros 5 NO se registran porque son detalle del import. Si en el futuro se quiere exponer `LegacySaleNote` en algún listado, se evalúa agregar.

## 2. ER

```
                    ┌──────────────────┐
                    │ contacts.Contact │  (vivo, ya existe)
                    └────────▲─────────┘
                             │ 1:1
                             │
                    ┌────────┴────────┐
                    │ContactLegacyOrigin│
                    └──────────────────┘

                    ┌──────────────────┐
                    │  LegacyVendor    │
                    └────────▲─────────┘
                             │ N:1
                             │
┌────────────┐  N:1 ┌───────┴────────┐  1:1 ┌──────────────────┐
│ Contact    │──────│ LegacySaleNote │──────│ production.WorkOrder│
│ (cliente)  │      │                │      │  (is_manual=True) │
└────────────┘      └────▲───────────┘      └──────────────────┘
                        │ N:1
                        │
              ┌─────────┴──────────┐         ┌────────────────────┐
              │   LegacyPayment    │         │LegacyPaymentRegistr.│
              │  (pagos históricos)│         │ (pagos NUEVOS)     │
              └────────────────────┘         └────────────────────┘
```

## 3. Data migration `0002_legacy_seed.py` (RUIDOSA)

Esta migración se ejecuta DESPUÉS de que `0001` haya creado los 6 modelos. Crea:

### 3.1 UoM mínima

```python
uom, _ = UoM.objects.get_or_create(
    code='UN',
    defaults={'name': 'Unidad'},
)
```

**Validación previa**: si existe una UoM con `code='UN'` pero `name != 'Unidad'`, falla ruidosamente con `CommandError("UoM UN existe con nombre distinto. Renombre o ajuste esta migración.")`.

### 3.2 Warehouse mínimo

```python
wh, _ = Warehouse.objects.get_or_create(
    code='LEGACY-DEFAULT',
    defaults={'name': 'Bodega Legacy Default', 'is_default': False},
)
```

Misma validación ruidosa.

### 3.3 Producto servicio `LEGACY-OT-PRODUCT`

```python
product, _ = Product.objects.get_or_create(
    code='LEGACY-OT-PRODUCT',
    defaults={
        'name': 'Servicio OT Legacy (importación histórica)',
        'type': Product.ProductType.SERVICE,
        'uom': uom,
        'is_active': True,
        'default_warehouse': wh,
    },
)
```

Misma validación ruidosa. Si el `Product` ya existe pero NO es `SERVICE`, falla.

### 3.4 Forward + reverse

- `reverse_code` está vacío (`pass`). No se borra el seed para evitar pérdida accidental de datos.
- Si la migración falla, se puede ejecutar de nuevo tras corregir el problema (es idempotente para UoM/Warehouse, pero no para Product si se cambió el `code`).

## 4. Decisiones de modelado (resumen)

| Decisión | Por qué |
|---|---|
| `BigAutoField` PK en todos los modelos | consistencia con `SaleOrder` y para evitar colisión con `int4` legacy |
| `DecimalField(12, 0)` para montos | CLP sin centavos (ADR-0014) |
| `OneToOneField` para `ContactLegacyOrigin.contact` | 1:1 estricto, no nullable |
| **PROTECT** en FK a `Contact` y `LegacyVendor` | no se puede borrar un cliente legacy con NV asociada; la limpieza es manual |
| **CASCADE** en `LegacyPayment.sale_note` y `LegacyPaymentRegistration.sale_note` | si se borra la NV, sus pagos también (no aplica normalmente, pero por simetría) |
| `legacy_external_id` UNIQUE en los 3 modelos con datos legacy | idempotencia de reimport |
| `idempotency_key` UNIQUE nullable en `LegacyPaymentRegistration` y `LegacyImport` | reintento HTTP idempotente |
| **No** soft-delete | el legacy no lo tenía; el modelo vivo no lo usa |
| **No** `simple_history` | snapshot ya congela; no aporta valor |
| Categoría como CharField, no FK | snapshot inmutable de la categoría al momento del import |

## 5. Índices y rendimiento

- `LegacySaleNote` se lista por `issue_date DESC` (índice ya agregado).
- `LegacySaleNote.customer` se usa en queries de "NVs por cliente" (FK ya tiene índice).
- `LegacyPayment.sale_note` + `paid_at` se usa en "pagos por NV" (índice compuesto).
- `ContactLegacyOrigin.legacy_external_id` se usa en import (índice).

## 6. Permisos requeridos (referencia, ver `07-permissions.md`)

| Modelo | view | add | change | delete |
|---|---|---|---|---|
| `ContactLegacyOrigin` | `legacy.view_legacy` | `legacy.view_legacy` | `legacy.view_legacy` | (no delete) |
| `LegacyVendor` | `legacy.view_legacy` | `legacy.view_legacy` | `legacy.view_legacy` | (no delete) |
| `LegacySaleNote` | `legacy.view_legacy` | `legacy.view_legacy` | (no change) | (no delete) |
| `LegacyPayment` | `legacy.view_legacy` | `legacy.view_legacy` | (no change) | (no delete) |
| `LegacyPaymentRegistration` | `legacy.view_legacy` | `legacy.pay_pending_legacy` AND `treasury.add_treasurymovement` | (no change) | (no delete) |
| `LegacyImport` | `legacy.view_legacy` | `legacy.import_legacy` | (no change) | (no delete) |
