# 04 — Backend import pipeline (4 importers + RUT + WO builder)

> Pipeline de importación del legacy. 4 importers por stage, batch size 500, RUT normalizado, idempotente.

## 0. Vista global

```
        ┌─────────────────────────┐
        │  management command     │
        │  import_legacy_dump     │
        └──────────┬──────────────┘
                   │  --stage={contacts|vendors|orders|payments|all}
                   │  [--dry-run] [--dsn=postgresql://...] [--batch-size=500]
                   ▼
        ┌─────────────────────────┐
        │   LegacyImport row      │  ← 1 fila por corrida
        └──────────┬──────────────┘
                   │
                   ▼
        ┌─────────────────────────┐
        │   contacts.py / vendors │
        │   orders.py / payments  │  ← 4 importers
        └──────────┬──────────────┘
                   │
                   ▼
        ┌─────────────────────────┐
        │   RUT normalizer        │  ← lib/legacy_rut.py
        └──────────┬──────────────┘
                   │
                   ▼
        ┌─────────────────────────┐
        │   WorkOrder builder     │  ← services/work_order_builder.py (orders)
        └──────────┬──────────────┘
                   │
                   ▼
        ┌─────────────────────────┐
        │   DB transacción local  │  ← 1 fila por transacción
        └─────────────────────────┘
```

## 1. Management command

```python
# backend/legacy/management/commands/import_legacy_dump.py
class Command(BaseCommand):
    help = 'Importa datos desde la BD legacy `ordenes_dump`.'

    def add_arguments(self, parser):
        parser.add_argument('--stage', choices=['contacts', 'vendors', 'orders', 'payments', 'all'], default='all')
        parser.add_argument('--dry-run', action='store_true')
        parser.add_argument('--dsn', default=os.environ.get('LEGACY_DSN'))
        parser.add_argument('--batch-size', type=int, default=500)
        parser.add_argument('--started-by', default='system')

    def handle(self, *args, **opts):
        if not opts['dsn']:
            raise CommandError('DSN requerida (--dsn=... o $LEGACY_DSN)')

        import_run = LegacyImport.objects.create(
            stage=opts['stage'],
            status=LegacyImport.Status.RUNNING,
            started_by_id=opts['started_by'],
            dry_run=opts['dry_run'],
            legacy_dsn=opts['dsn'].split('@')[-1],  # sin user/pass
        )

        try:
            if opts['stage'] in ('contacts', 'all'):
                import_contacts(opts['dsn'], opts['batch_size'], opts['dry_run'], import_run)
            if opts['stage'] in ('vendors', 'all'):
                import_vendors(opts['dsn'], opts['batch_size'], opts['dry_run'], import_run)
            if opts['stage'] in ('orders', 'all'):
                import_orders(opts['dsn'], opts['batch_size'], opts['dry_run'], import_run)
            if opts['stage'] in ('payments', 'all'):
                import_payments(opts['dsn'], opts['batch_size'], opts['dry_run'], import_run)

            import_run.status = LegacyImport.Status.COMPLETED
        except Exception as e:
            import_run.status = LegacyImport.Status.FAILED
            import_run.error_log = traceback.format_exc()
            raise
        finally:
            import_run.finished_at = timezone.now()
            import_run.save()
```

## 2. Importer: `contacts.py` (T05)

> **Columnas reales** (`clientes`): `id, nombre, rut, telefono, correo, …, deleted_at`. **No hay `direccion` ni `email`** (es `correo`). Filtrar `deleted_at IS NULL`.

```python
def import_contacts(dsn, batch_size, dry_run, import_run):
    with legacy_cursor(dsn) as cur:
        cur.execute("""
            SELECT id, nombre, rut, telefono, correo
            FROM clientes
            WHERE deleted_at IS NULL
            ORDER BY id
        """)
        rows = batched(cur, batch_size)

        for batch in rows:
            for row in batch:
                import_run.rows_processed += 1
                try:
                    rut_norm, is_exception = normalize_rut(row['rut'])
                    # Contact.tax_id es UNIQUE + NOT NULL → nunca '' ni None.
                    # RUT inválido/duplicado → placeholder único derivado del id legacy.
                    tax_id = rut_norm if not is_exception else f'LEGACY-{row["id"]}'
                    contact_data = {
                        'name': (row['nombre'] or '').strip() or 'SIN NOMBRE',
                        'email': row['correo'] or '',
                        'phone': row['telefono'] or '',
                    }

                    with transaction.atomic():
                        # tax_id es la clave única → get_or_create por tax_id.
                        contact, c_created = Contact.objects.get_or_create(
                            tax_id=tax_id,
                            defaults={'name': contact_data['name'],
                                      'email': contact_data['email'],
                                      'phone': contact_data['phone']},
                        )
                        origin, o_created = ContactLegacyOrigin.objects.get_or_create(
                            source_table='clientes',
                            legacy_external_id=row['id'],
                            defaults={'contact': contact,
                                      'raw_tax_id': row['rut'],
                                      'tax_id_exception': is_exception},
                        )
                    if c_created or o_created:
                        import_run.rows_created += 1
                except Exception as e:
                    import_run.rows_failed += 1
                    logger.warning('cliente id=%s falló: %s', row['id'], e)
```

**Idempotencia**: `ContactLegacyOrigin` tiene `unique_together(source_table, legacy_external_id)`. Re-correr el comando NO duplica orígenes.

**`Contact.tax_id` es `UNIQUE` + `NOT NULL`** (`contacts/models.py:32`). Por eso:
- Un RUT inválido **no** puede guardarse como `''` ni `None` → se usa placeholder `LEGACY-<id>` (único) y el RUT crudo queda en `ContactLegacyOrigin.raw_tax_id` con `tax_id_exception=True`.
- `get_or_create` se hace **solo por `tax_id`** (no por `(tax_id, name)`), porque dos filas con el mismo `tax_id` violarían el `UNIQUE`.

**Resolución de duplicados** (T07):
- En `clientes` los 2.843 RUT crudos son **únicos** (0 duplicados, verificado), así que el 1:1 `Contact`↔`ContactLegacyOrigin` es válido en el caso normal.
- Caso borde: si la **normalización** de dos RUT distintos colisiona, o ya existe un `Contact` vivo con ese `tax_id`, el segundo `ContactLegacyOrigin` no puede crearse (es `OneToOne`). Se **salta y se loguea** (`rows_skipped`) para investigación manual. **No** se cambia a `ForeignKey`: el serializer detecta legacy vía el reverse OneToOne `legacy_origin` (`hasattr(obj, 'legacy_origin')`); con un FK, `is_legacy` sería siempre verdadero.

## 3. Importer: `vendors.py` (T06)

> **Columnas reales** (`vendedores`): `id, nombre, rut, telefono, correo, categoria, …, deleted_at`. La columna es **`categoria`** (no `category`).

```python
def import_vendors(dsn, batch_size, dry_run, import_run):
    with legacy_cursor(dsn) as cur:
        cur.execute("""
            SELECT id, nombre, categoria
            FROM vendedores
            WHERE deleted_at IS NULL
            ORDER BY id
        """)
        rows = cur.fetchall()
        for row in rows:
            import_run.rows_processed += 1
            try:
                with transaction.atomic():
                    vendor, created = LegacyVendor.objects.get_or_create(
                        legacy_external_id=row['id'],
                        defaults={'name': (row['nombre'] or '').strip(),
                                  'category': row['categoria']},
                    )
                if created:
                    import_run.rows_created += 1
            except Exception as e:
                import_run.rows_failed += 1
                logger.warning('vendedor id=%s falló: %s', row['id'], e)
```

**Decisión**: 137/137 son `externo`. Si en el futuro aparece `interno`, el modelo ya lo soporta (CharField con choices). `vendedores` también trae `rut`/`telefono`/`correo` (no se migran; 122 RUTs colisionan con `clientes`).

## 4. Importer: `orders.py` (T08, T09, T10)

> **Columnas reales** (`ordenes`): `id, cliente_id, usuario_id, fecha_ingreso, descripcion, detalles, cantidad, precio_neto, iva, precio_total, estado_trabajo, estado_despachado, folio, categoria_id, vendedor_id, …, deleted_at`. **No existen** `numero`, `descripcion_texto`, `fecha`, `estado`, `despachado`, `pendiente`. El estado son **dos columnas** (`estado_trabajo` + `estado_despachado`, 1:1) y **no hay `anulada`**.

```python
CATEGORIES = {
    1: 'Impresion Digital',
    2: 'Impresion Offset',
    3: 'Calendarios',
    4: 'Timbres',
    5: 'Fotocopias y encuadernado',
}

# Mapeo por estado_trabajo (verificado: solo 2 combos, 1:1 con estado_despachado).
# terminado/despachado (7.960) y pendiente/no despachado (20).
LEGACY_STATUS_MAP = {
    'terminado': ('DISPATCHED', False),  # estado_despachado='despachado'
    'pendiente': ('PENDING', True),       # estado_despachado='no despachado'
}

def import_orders(dsn, batch_size, dry_run, import_run):
    with legacy_cursor(dsn) as cur:
        cur.execute("""
            SELECT o.id, o.folio, o.cliente_id, o.vendedor_id, o.categoria_id,
                   o.descripcion, o.detalles, o.cantidad, o.precio_neto, o.iva,
                   o.precio_total, o.estado_trabajo, o.estado_despachado,
                   o.fecha_ingreso
            FROM ordenes o
            WHERE o.deleted_at IS NULL
            ORDER BY o.id
        """)
        rows = batched(cur, batch_size)

        # cache en memoria
        cliente_map = {c.legacy_external_id: c.contact_id
                       for c in ContactLegacyOrigin.objects.filter(source_table='clientes')
                       .select_related('contact')}
        vendor_map = {v.legacy_external_id: v.id for v in LegacyVendor.objects.all()}

        for batch in rows:
            for row in batch:
                import_run.rows_processed += 1

                if row['categoria_id'] not in CATEGORIES:
                    import_run.rows_failed += 1
                    logger.error('orden id=%s categoría_id=%s desconocida', row['id'], row['categoria_id'])
                    continue

                if row['estado_trabajo'] not in LEGACY_STATUS_MAP:
                    import_run.rows_skipped += 1
                    logger.warning('orden id=%s estado_trabajo=%s no mapeado', row['id'], row['estado_trabajo'])
                    continue

                try:
                    status, is_pending = LEGACY_STATUS_MAP[row['estado_trabajo']]
                    dispatched = (row['estado_despachado'] == 'despachado')
                    customer_id = cliente_map.get(row['cliente_id'])
                    vendor = LegacyVendor.objects.get(legacy_external_id=row['vendedor_id'])

                    # Mapping T10 (ver §4.1 — decisión revisada)
                    customer_id_final, related_contact_id_final, vendor_final = map_vendor_customer(
                        customer_id, vendor
                    )

                    issue_date = row['fecha_ingreso'].date()  # timestamp → date

                    with transaction.atomic():
                        note, created = LegacySaleNote.objects.get_or_create(
                            legacy_external_id=row['id'],
                            defaults={
                                'legacy_number': row['folio'] or '',  # no único, 109 vacíos
                                'issue_date': issue_date,
                                'customer_id': customer_id_final,
                                'related_contact_id': related_contact_id_final,
                                'vendor_id': vendor_final.id,
                                'category_snapshot': CATEGORIES[row['categoria_id']],
                                'description': (row['descripcion'] or '').strip(),
                                'notes': (row['detalles'] or '').strip(),  # texto largo
                                'quantity': row['cantidad'] or 1,
                                'net_price': row['precio_neto'],
                                'tax_amount': row['iva'] or 0,
                                'total_price': row['precio_total'],
                                'status': status,
                                'dispatched_at': issue_date if dispatched else None,
                                'is_pending': is_pending,
                            },
                        )
                        if created:
                            import_run.rows_created += 1
                            # Work order builder (T11)
                            build_work_order_for_legacy_note(note)
                except ContactLegacyOrigin.DoesNotExist:
                    import_run.rows_failed += 1
                    logger.error('orden id=%s cliente_id=%s sin ContactLegacyOrigin', row['id'], row['cliente_id'])
                except LegacyVendor.DoesNotExist:
                    import_run.rows_failed += 1
                    logger.error('orden id=%s vendedor_id=%s sin LegacyVendor', row['id'], row['vendedor_id'])
                except Exception as e:
                    import_run.rows_failed += 1
                    logger.exception('orden id=%s falló: %s', row['id'], e)
```

### 4.1 `map_vendor_customer` (T10)

```python
def map_vendor_customer(customer_id, vendor):
    """customer = cliente real legacy (SIEMPRE). vendor = LegacyVendor (referencia).
       related_contact queda None (no se usa el swap del plan previo)."""
    return customer_id, None, vendor
```

> ⚠️ **CAMBIO vs plan previo.** El plan original, para `externo`, convertía al **vendedor** en el `customer` (vía un inexistente `vendor_as_contact`) y degradaba al cliente real a `related_contact`. Como **137/137 vendedores son `externo`**, eso dejaría a **ninguna** NV con su cliente real como `customer` — contradiciendo el principio "los clientes legacy SÍ se mapean a `Contact` vivo" y rompiendo `ContactDrawer`/listados por cliente. Además `vendor_as_contact` colisionaría con los 122 RUTs compartidos (Contact.tax_id único).
>
> **Decisión adoptada**: `customer = cliente real` siempre; `vendor` es solo una referencia a `LegacyVendor`. Si en el futuro se necesita la lógica de comisionista (vendedor como cliente comercial), se reabre con un ADR y datos que lo justifiquen (hoy no los hay).

## 5. Importer: `payments.py` (T15)

> **Columnas reales** (`pagos`): `id, orden_id, fecha, monto, metodo, referencia, notas, usuario_id, …, deleted_at`. Es **`monto`** (no `abono`) y **`metodo`** (no `forma_pago`), con valores `{efectivo, transferencia, tarjeta}`. El filtro por NVs ya importadas se hace **en Python** contra `note_map` (la versión previa consultaba `legacy_lazysalenote` —tabla destino mal escrita— sobre el cursor de la BD **origen**, que no la tiene → siempre fallaba).

```python
def import_payments(dsn, batch_size, dry_run, import_run):
    note_map = {n.legacy_external_id: n.id for n in LegacySaleNote.objects.all()}

    with legacy_cursor(dsn) as cur:
        cur.execute("""
            SELECT p.id, p.orden_id, p.fecha, p.monto, p.metodo
            FROM pagos p
            WHERE p.deleted_at IS NULL
            ORDER BY p.id
        """)
        rows = batched(cur, batch_size)

        for batch in rows:
            for row in batch:
                import_run.rows_processed += 1
                try:
                    note_id = note_map.get(row['orden_id'])
                    if not note_id:
                        # pago de una NV no importada (no debería ocurrir: 0 huérfanos)
                        import_run.rows_skipped += 1
                        continue

                    with transaction.atomic():
                        payment, created = LegacyPayment.objects.get_or_create(
                            legacy_external_id=row['id'],
                            defaults={
                                'sale_note_id': note_id,
                                'paid_at': row['fecha'].date(),  # timestamp → date
                                'amount': row['monto'],
                                'method': row['metodo'],  # efectivo|transferencia|tarjeta
                            },
                        )
                    if created:
                        import_run.rows_created += 1
                except Exception as e:
                    import_run.rows_failed += 1
                    logger.exception('pago id=%s falló: %s', row['id'], e)
```

## 6. RUT normalizer (`lib/legacy_rut.py`)

```python
import re
from decimal import Decimal

def normalize_rut(raw):
    """Devuelve (rut_normalizado, tax_id_exception).
       rut_normalizado: '12345678-9' (con guión) o '' si excepción.
       tax_id_exception: True si el RUT no pasa módulo 11.
    """
    if not raw:
        return '', True

    s = re.sub(r'[^0-9kK]', '', str(raw)).upper()
    if len(s) < 2:
        return '', True

    body, dv = s[:-1], s[-1]
    if not body.isdigit():
        return '', True

    # Validar DV
    if compute_dv(body) != dv:
        return raw, True  # preserva raw, marca excepción

    return f'{int(body):,}'.replace(',', '.') + '-' + dv, False


def compute_dv(body):
    s, m = 0, 2
    for d in reversed(body):
        s += int(d) * m
        m = m + 1 if m < 7 else 2
    rem = 11 - (s % 11)
    return 'K' if rem == 10 else '0' if rem == 11 else str(rem)
```

**Decisión**: el RUT normalizado se guarda en `Contact.tax_id` SIN puntos, con guión (formato canónico del sistema). El RUT **raw** se preserva en `ContactLegacyOrigin.raw_tax_id`.

## 7. WorkOrder builder (`services/work_order_builder.py`, T11)

> ⚠️ **REESCRITO.** El plan previo llamaba `WorkOrderService.create_manual(...)`, pero (verificado en `production/services.py:139`):
> - su firma real es `create_manual(product, quantity, description, uom=None, warehouse=None, stage_data=None)` — **no** acepta `customer`, `related_contact`, `sale_note_id` ni `skip_initial_stage`;
> - llama a `_validate_product_manufacturable`, que **rechaza productos `SERVICE`** (`raise ValidationError("El producto debe ser fabricable.")`) → las 7.980 OTs fallarían;
> - expande BOM y crea **una tarea de workflow + history por OT** → 7.980 tareas fantasma en el tablero de producción;
> - fuerza `status=DRAFT` y `current_stage=MATERIAL_ASSIGNMENT`.
>
> Además, `WorkOrder` **no tiene** `needs_manual_finalize` ni `is_blocked`, la clase es `WorkOrder.Status` (no `WorkOrderStatus`), y **no existe** `TransitionError` (las transiciones lanzan `ValidationError`). Transicionar de `MATERIAL_ASSIGNMENT` a `FINISHED` además dispara validaciones intermedias (p.ej. "Se requiere una bodega para finalizar").
>
> Para OTs **históricas ya terminadas** lo correcto es **no** pasar por el flujo de producción: se crean directamente, finalizadas, sin BOM ni tareas.

```python
def build_work_order_for_legacy_note(note):
    """Crea una OT histórica YA finalizada por cada NV legacy (sin flujo de producción)."""
    product = Product.objects.get(code='LEGACY-OT-PRODUCT')
    warehouse = Warehouse.objects.get(code='LEGACY-DEFAULT')

    wo = WorkOrder.objects.create(
        description=f'[{note.legacy_external_id}] {note.description} — {note.category_snapshot}'[:255],
        is_manual=True,
        product=product,
        warehouse=warehouse,
        related_contact=note.customer,          # FK ya existente en WorkOrder
        status=WorkOrder.Status.FINISHED,
        current_stage=WorkOrder.Stage.FINISHED,
        stage_data={'quantity': float(note.quantity), '_version': 1, 'legacy': True},
    )
    # WorkOrder.save() asigna `number` vía SequenceService automáticamente.

    note.work_order = wo
    note.save(update_fields=['work_order'])
    return wo
```

**Decisiones**:
- **No se usa `create_manual`**: se evita la validación de fabricable, la expansión de BOM y la creación de 7.980 tareas de workflow. La OT nace `FINISHED`/`FINISHED`.
- **Sin materiales ni history de etapas**: es histórica; no hubo consumo real de inventario que registrar.
- **Vínculo OT↔NV**: **una sola** relación — `LegacySaleNote.work_order` (`OneToOneField → production.WorkOrder`, `null=True`, `on_delete=SET_NULL`). Se elimina el FK redundante `WorkOrder → LegacySaleNote` del plan previo (evita la doble relación contradictoria). El reverse `wo.legacysalenote` basta para saber el origen.
- **No bloqueada**: editable si el manager lo necesita.
- ⚠️ **Verificar en T14**: que `WorkOrder.save()` no exija un `product` fabricable ni `warehouse` no-nulo al persistir directamente, y que ninguna `signal` de `production` dispare efectos sobre OTs creadas ya en `FINISHED`. Probar con 1 OT antes del batch completo.

## 8. Batching y transacciones

- **Batch size 500** (configurable): lee 500 filas legacy, procesa fila por fila en `transaction.atomic()`.
- **NO** se usa `transaction.atomic()` global: si una fila falla, no se hace rollback de las anteriores.
- **Idempotencia**: cada `LegacySaleNote` y `LegacyPayment` se inserta con `get_or_create` por `legacy_external_id`. Re-correr el comando es seguro.
- **Memoria**: los `note_map` y `cliente_map`/`vendor_map` se cachean en memoria al inicio de cada importer. Para 7.980 NVs es ~2 MB.

## 9. Logging

- Logger `legacy.import` con nivel INFO por defecto, configurable vía settings.
- Cada `LegacyImport` guarda `error_log` con stacktrace si la corrida falla globalmente.
- Fallos de filas individuales NO detienen el batch; se acumulan en `rows_failed` y se loguean con WARNING.
- El comando imprime al final: `OK {rows_created} creados, {rows_skipped} omitidos, {rows_failed} fallidos en {elapsed}s`.

## 10. Concurrencia

- Una sola corrida simultánea por BD (lock a nivel de aplicación: `LegacyImport.objects.filter(status=RUNNING).exists()` → si hay, abort).
- Lock a nivel de BD no es necesario (idempotencia vía `get_or_create`).

## 11. Testing del importer

- Fixture: `tests/fixtures/legacy_subset.sql` con 100 filas de cada tabla.
- Test: ejecutar importer completo sobre la fixture; assert counts.
- Test: re-ejecutar importer; assert counts no cambian.
- Test: RUT inválido se preserva con `tax_id_exception=True`.
- Test: estado `anulada` se omite.
- Test: vendor `interno` (mock) genera OT con `related_contact=None`.

## 12. Reversibilidad

- La importación es **destruible**: borrar `LegacySaleNote` CASCADE borra `LegacyPayment` y `LegacyPaymentRegistration` (los pagos históricos). Los pagos nuevos en `LegacyPaymentRegistration` también se borran.
- La OT vinculada (`WorkOrder`) NO se borra al borrar la NV (no hay FK desde `WorkOrder`); queda como OT manual finalizada sin reverse `legacysalenote`.
- Si en cambio se borra la `WorkOrder`, `LegacySaleNote.work_order` queda `NULL` (`on_delete=SET_NULL`).
- Esto es **deliberado**: el usuario decide si limpia OTs legacy huérfanas. Un comando separado `cleanup_orphan_workorders` puede hacerlo (filtrando por `is_manual=True` + `stage_data->legacy=true`).
