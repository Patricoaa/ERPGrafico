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

```python
def import_contacts(dsn, batch_size, dry_run, import_run):
    with legacy_cursor(dsn) as cur:
        cur.execute('SELECT id, rut, nombre, direccion, telefono, email, created_at FROM clientes ORDER BY id')
        rows = batched(cur, batch_size)

        for batch in rows:
            for row in batch:
                import_run.rows_processed += 1
                try:
                    rut_norm, is_exception = normalize_rut(row['rut'])
                    contact_data = {
                        'name': row['nombre'].strip() or 'SIN NOMBRE',
                        'tax_id': rut_norm if not is_exception else '',
                        'email': row['email'] or '',
                        'phone': row['telefono'] or '',
                        'address': row['direccion'] or '',
                    }

                    with transaction.atomic():
                        contact, c_created = Contact.objects.get_or_create(
                            tax_id=contact_data['tax_id'] or None,
                            name=contact_data['name'],
                            defaults={'email': contact_data['email'],
                                      'phone': contact_data['phone'],
                                      'address': contact_data['address']},
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

**Resolución de duplicados** (T07):
- Si dos clientes legacy tienen el mismo RUT normalizado, se loguea como warning y se usa el primero; el segundo queda con `tax_id=''` y `raw_tax_id` en `ContactLegacyOrigin` para investigación manual.

## 3. Importer: `vendors.py` (T06)

```python
def import_vendors(dsn, batch_size, dry_run, import_run):
    with legacy_cursor(dsn) as cur:
        cur.execute('SELECT id, nombre, category, created_at FROM vendedores ORDER BY id')
        rows = cur.fetchall()
        for row in rows:
            import_run.rows_processed += 1
            try:
                with transaction.atomic():
                    vendor, created = LegacyVendor.objects.get_or_create(
                        legacy_external_id=row['id'],
                        defaults={'name': row['nombre'].strip(), 'category': row['category']},
                    )
                if created:
                    import_run.rows_created += 1
            except Exception as e:
                import_run.rows_failed += 1
                logger.warning('vendedor id=%s falló: %s', row['id'], e)
```

**Decisión**: 137/137 son `externo`. Si en el futuro aparece `interno`, el modelo ya lo soporta (CharField con choices).

## 4. Importer: `orders.py` (T08, T09, T10)

```python
CATEGORIES = {
    1: 'Impresion Digital',
    2: 'Impresion Offset',
    3: 'Calendarios',
    4: 'Timbres',
    5: 'Fotocopias y encuadernado',
}

LEGACY_STATUS_MAP = {
    'despachado': ('DISPATCHED', False),
    'no_despachado': ('IN_PRODUCTION', False),
    'pendiente': ('PENDING', True),
    # 'anulada' → se omite
}

def import_orders(dsn, batch_size, dry_run, import_run):
    with legacy_cursor(dsn) as cur:
        cur.execute("""
            SELECT o.id, o.numero, o.cliente_id, o.vendedor_id, o.categoria_id,
                   o.descripcion_texto, o.cantidad, o.precio_neto, o.iva,
                   o.precio_total, o.despachado, o.pendiente, o.fecha, o.estado
            FROM ordenes o
            WHERE o.estado != 'anulada'
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

                if row['estado'] not in LEGACY_STATUS_MAP:
                    import_run.rows_skipped += 1
                    continue  # 'anulada' cae aquí

                try:
                    status, is_pending = LEGACY_STATUS_MAP[row['estado']]
                    customer_id = cliente_map.get(row['cliente_id'])
                    vendor = LegacyVendor.objects.get(legacy_external_id=row['vendedor_id'])

                    # Mapping T10
                    customer_id_final, related_contact_id_final, vendor_final = map_vendor_customer(
                        customer_id, vendor
                    )

                    with transaction.atomic():
                        note, created = LegacySaleNote.objects.get_or_create(
                            legacy_external_id=row['id'],
                            defaults={
                                'legacy_number': row['numero'],
                                'issue_date': row['fecha'],
                                'customer_id': customer_id_final,
                                'related_contact_id': related_contact_id_final,
                                'vendor_id': vendor_final.id,
                                'category_snapshot': CATEGORIES[row['categoria_id']],
                                'description': row['descripcion_texto'],
                                'quantity': row['cantidad'],
                                'net_price': row['precio_neto'],
                                'tax_amount': row['iva'],
                                'total_price': row['precio_total'],
                                'status': status,
                                'dispatched_at': row['fecha'] if row['despachado'] else None,
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
    """vendor.category='interno' → customer=cliente, related_contact=None, vendor=NO asociado.
       vendor.category='externo' → customer=vendor (legacy vendor como cliente), related_contact=cliente."""
    if vendor.category == 'interno':
        return customer_id, None, vendor
    else:  # 'externo'
        return vendor_as_contact(vendor), customer_id, vendor
```

**Decisión UX** (T10): el vendor externo es el "cliente" comercial (quien paga), y el `cliente` original del legacy es el "cliente del cliente" (a quien se entrega el trabajo). Esto preserva la lógica de imprentas con comisionistas.

**Nota importante**: el 100% de los vendors legacy son `externo`. El branch `interno` está documentado para futuro.

## 5. Importer: `payments.py` (T15)

```python
def import_payments(dsn, batch_size, dry_run, import_run):
    with legacy_cursor(dsn) as cur:
        cur.execute("""
            SELECT p.id, p.orden_id, p.fecha, p.abono, p.forma_pago, p.created_at
            FROM pagos p
            WHERE p.orden_id IN (SELECT legacy_external_id FROM legacy_lazysalenote)
            ORDER BY p.id
        """)
        rows = batched(cur, batch_size)
        note_map = {n.legacy_external_id: n.id for n in LegacySaleNote.objects.all()}

        for batch in rows:
            for row in batch:
                import_run.rows_processed += 1
                try:
                    note_id = note_map.get(row['orden_id'])
                    if not note_id:
                        import_run.rows_failed += 1
                        continue

                    with transaction.atomic():
                        payment, created = LegacyPayment.objects.get_or_create(
                            legacy_external_id=row['id'],
                            defaults={
                                'sale_note_id': note_id,
                                'paid_at': row['fecha'],
                                'amount': row['abono'],
                                'method': row['forma_pago'],
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

## 7. WorkOrder builder (`services/work_order_builder.py`, T11, T12, T13)

```python
def build_work_order_for_legacy_note(note):
    """Crea una OT manual finalizada por cada NV legacy."""
    product = Product.objects.get(code='LEGACY-OT-PRODUCT')
    uom = product.uom
    warehouse = product.default_warehouse

    # Crear la OT con el servicio existente
    wo = WorkOrderService.create_manual(
        product=product,
        uom=uom,
        warehouse=warehouse,
        quantity=note.quantity,
        description=f'[{note.legacy_external_id}] - {note.description} - {note.category_snapshot}',
        customer=note.customer,
        related_contact=note.related_contact,
        sale_note_id=note.id,  # OJO: parámetro nuevo a agregar a create_manual
        skip_initial_stage=True,
    )

    # Marcar como finalizada
    try:
        WorkOrderService.transition_to(wo, Stage.FINISHED)
    except TransitionError:
        # Fallback: marcar manualmente si el flujo no lo permite
        wo.current_stage = Stage.FINISHED
        wo.status = WorkOrder.WorkOrderStatus.FINISHED
        wo.needs_manual_finalize = True
        wo.save(update_fields=['current_stage', 'status', 'needs_manual_finalize'])

    note.work_order = wo
    note.save(update_fields=['work_order'])
```

**Decisión clave**: la OT NO está bloqueada. `is_blocked=False` por default. Si el manager de imprenta quiere editarla, puede.

**Parámetro `sale_note_id`**: `WorkOrderService.create_manual` debe aceptar un parámetro opcional para vincular a `LegacySaleNote` (T12). Esto agrega una nueva `OneToOneField(sale_note=...)` o `ForeignKey` (mejor FK porque una OT no-NV también es válida). Decisión: **FK nullable** en `WorkOrder` → `legacy.LegacySaleNote`, `related_name='legacy_sale_note'`.

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
- La OT vinculada (`WorkOrder`) NO se borra por CASCADE (FK es nullable con `on_delete=SET_NULL`); queda huérfana con `related_sale_note=NULL`.
- Esto es **deliberado**: el usuario debe decidir si borra OTs huérfanas. Un comando separado `cleanup_orphan_workorders` puede hacerlo.
