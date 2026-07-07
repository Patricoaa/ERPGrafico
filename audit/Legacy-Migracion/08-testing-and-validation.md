# 08 — Testing & Validation (DoD + smoke + reconciliación)

> Criterios de aceptación, smoke scripts, reconciliación de datos, y cierre del proyecto.

## 1. DoD (Definition of Done) global

El proyecto está cerrado cuando:

- [ ] Las 8 fases están completas (cada una con su DoD local ✅).
- [ ] ADR-0029 firmado y numerado.
- [ ] `pytest` verde en `backend/`.
- [ ] `npm run type-check` y `npm run lint` verdes en `frontend/`.
- [ ] `scripts/smoke_legacy_import.sh` ejecuta 3 stages sin error.
- [ ] `scripts/smoke_legacy_api.sh` ejecuta 5 curls con respuestas correctas.
- [ ] Reconciliación: 2.843 clientes + 137 vendedores + **7.980** NVs + 8.556 pagos + **7.980** OTs = **27.496** filas (no hay NVs anuladas que excluir).
- [ ] 0 regresiones en `pytest backend/sales backend/contacts backend/production backend/treasury`.
- [ ] Búsqueda global incluye NVs legacy y excluye contactos legacy (verificado manualmente).
- [ ] UI muestra el chip `<LegacyBadge />` en los lugares correctos (verificado con 1 caso).
- [ ] Un usuario de prueba puede registrar un pago nuevo sobre una NV legacy sin tocar `treasury/`.
- [ ] No se introdujeron `any`, raw colors (excepto `LegacyBadge`), ni cross-feature imports.

## 2. Test suites (T37)

### 2.1 Backend

| Suite | Cobertura |
|---|---|
| `backend/legacy/tests/test_models.py` | Constraints, defaults, choices, `unique_together`, FKs. |
| `backend/legacy/tests/test_importers.py` | Import completo sobre fixture de 100 filas; idempotencia; RUT inválido; estado `anulada`. |
| `backend/legacy/tests/test_serializers.py` | `LegacySaleNoteSerializer` emite el mismo shape que `SaleOrderSerializer`; `pending_amount` no negativo. |
| `backend/legacy/tests/test_api.py` | 8+ tests (ver `05-backend-api.md` §11). |
| `backend/legacy/tests/test_permissions.py` | 4+ tests (ver `07-permissions.md` §8). |
| `backend/legacy/tests/test_work_order_builder.py` | Builder crea OT con `current_stage=FINISHED` y `is_blocked=False`. |

**Ejecutar**: `pytest backend/legacy -v`.

### 2.2 Frontend (Vitest)

| Suite | Cobertura |
|---|---|
| `frontend/components/shared/LegacyBadge.test.tsx` | Renderiza "LEGACY" con icono. |
| `frontend/lib/legacy.test.ts` | `isLegacyContact`, `isLegacySaleOrder`, `formatLegacyId`. |
| `frontend/features/sales/components/SaleOrderDrawer.test.tsx` | Branch `is_legacy=true` → read-only + botón "Registrar pago". |
| `frontend/features/contacts/components/ContactDrawer.test.tsx` | Branch `is_legacy=true` → read-only. |
| `frontend/features/sales/components/RegisterPaymentDrawer.test.tsx` | Bifurcación por `isLegacy`. |

**Ejecutar**: `npm run test -- legacy`.

### 2.3 E2E (Playwright, opcional pero recomendado)

| Suite | Cobertura |
|---|---|
| `tests/e2e/legacy-sale-note.spec.ts` | Lista → drawer read-only → registrar pago. |
| `tests/e2e/legacy-contact.spec.ts` | Lista → drawer read-only. |
| `tests/e2e/global-search-excludes-legacy-contact.spec.ts` | Buscar nombre legacy → no aparece. |

**Ejecutar**: `npx playwright test tests/e2e/legacy-*.spec.ts`.

## 3. Smoke scripts

### 3.1 `scripts/smoke_legacy_import.sh` (T37)

```bash
#!/usr/bin/env bash
set -euo pipefail

echo "==> 1. contacts"
python manage.py import_legacy_dump --stage=contacts --dsn="$LEGACY_DSN" 2>&1 | tee /tmp/smoke-contacts.log
# Asserta ContactLegacyOrigin (no Contact, que puede incluir contactos vivos preexistentes)
ACTUAL=$(python manage.py shell -c "from legacy.models import ContactLegacyOrigin; print(ContactLegacyOrigin.objects.count())")
[[ "$ACTUAL" == "2843" ]] || { echo "FAIL: ContactLegacyOrigin $ACTUAL != 2843"; exit 1; }

echo "==> 2. vendors"
python manage.py import_legacy_dump --stage=vendors --dsn="$LEGACY_DSN" 2>&1 | tee /tmp/smoke-vendors.log
ACTUAL=$(python manage.py shell -c "from legacy.models import LegacyVendor; print(LegacyVendor.objects.count())")
[[ "$ACTUAL" == "137" ]] || { echo "FAIL: vendors $ACTUAL != 137"; exit 1; }

echo "==> 3. orders"
python manage.py import_legacy_dump --stage=orders --dsn="$LEGACY_DSN" 2>&1 | tee /tmp/smoke-orders.log
ACTUAL=$(python manage.py shell -c "from legacy.models import LegacySaleNote; print(LegacySaleNote.objects.count())")
[[ "$ACTUAL" == "7980" ]] || { echo "FAIL: orders $ACTUAL != 7980"; exit 1; }

echo "==> 4. payments"
python manage.py import_legacy_dump --stage=payments --dsn="$LEGACY_DSN" 2>&1 | tee /tmp/smoke-payments.log
ACTUAL=$(python manage.py shell -c "from legacy.models import LegacyPayment; print(LegacyPayment.objects.count())")
[[ "$ACTUAL" == "8556" ]] || { echo "FAIL: payments $ACTUAL != 8556"; exit 1; }

echo "==> 5. dry-run re-ejecución (idempotencia)"
python manage.py import_legacy_dump --stage=all --dsn="$LEGACY_DSN" --dry-run 2>&1 | tee /tmp/smoke-dry.log
grep -q "0 creados" /tmp/smoke-dry.log || { echo "FAIL: dry-run no idempotente"; exit 1; }

echo "OK: smoke import completo"
```

### 3.2 `scripts/smoke_legacy_api.sh` (T37)

```bash
#!/usr/bin/env bash
set -euo pipefail

TOKEN=$(python manage.py shell -c "from rest_framework.authtoken.models import Token; print(Token.objects.get(user__username='admin').key)")
BASE=http://localhost:8100/api
H_AUTH="Authorization: Token $TOKEN"
H_IDEMP="Idempotency-Key: smoke-$(date +%s)"

echo "==> 1. list ?include=legacy"
RESP=$(curl -sf -H "$H_AUTH" "$BASE/sales/orders/?include=legacy&page=1")
echo "$RESP" | jq -e '.results[0].is_legacy' >/dev/null
echo "$RESP" | jq -e 'any(.results[]; .is_legacy == true)' >/dev/null

echo "==> 2. list ?include=none"
RESP=$(curl -sf -H "$H_AUTH" "$BASE/sales/orders/?include=none&page=1")
echo "$RESP" | jq -e 'all(.results[]; .is_legacy == false)' >/dev/null

echo "==> 3. retrieve legacy"
LEGACY_PK=$(python manage.py shell -c "from legacy.models import LegacySaleNote; print(LegacySaleNote.objects.first().id)")
curl -sf -H "$H_AUTH" "$BASE/sales/orders/$LEGACY_PK/?include=legacy" | jq -e '.is_legacy == true' >/dev/null

echo "==> 4. contact list incluye is_legacy"
curl -sf -H "$H_AUTH" "$BASE/contacts/contacts/?page=1" | jq -e '.[0].is_legacy' >/dev/null

echo "==> 5. register payment sobre legacy"
curl -sf -H "$H_AUTH" -H "$H_IDEMP" -H "Content-Type: application/json" \
  -X POST "$BASE/legacy/sale-notes/$LEGACY_PK/register-payment/" \
  -d '{"paid_at": "2026-06-02", "amount": 1000, "method": "efectivo"}' | jq -e '.amount == 1000' >/dev/null

echo "OK: smoke API completo"
```

## 4. Reconciliación de datos

Tras el import completo, la BD destino debe tener:

| Tabla | Conteo esperado | Query de validación |
|---|---|---|
| `contacts_contact` | ≥ 2.843 (puede haber más si había contactos vivos) | `SELECT COUNT(*) FROM contacts_contact;` |
| `legacy_contactorigin` | 2.843 | `SELECT COUNT(*) FROM legacy_contactorigin;` |
| `legacy_legacyvendor` | 137 | `SELECT COUNT(*) FROM legacy_legacyvendor;` |
| `legacy_legacysalenote` | **7.980** | `SELECT COUNT(*) FROM legacy_legacysalenote;` |
| `legacy_legacypayment` | 8.556 | `SELECT COUNT(*) FROM legacy_legacypayment;` |
| `production_workorder` (con `is_manual=True` y `current_stage='FINISHED'`) | ≥ **7.980** (puede haber más OTs manuales no-legacy) | `SELECT COUNT(*) FROM production_workorder WHERE is_manual=true AND current_stage='FINISHED';` |
| `legacy_legacyimport` (con status='COMPLETED') | ≥ 1 | `SELECT COUNT(*) FROM legacy_legacyimport WHERE status='COMPLETED';` |

**Comando de reconciliación**:

```bash
python manage.py shell <<'PY'
from contacts.models import Contact
from legacy.models import ContactLegacyOrigin, LegacyVendor, LegacySaleNote, LegacyPayment, LegacyImport
from production.models import WorkOrder

print('Contacts:', Contact.objects.count())
print('ContactLegacyOrigin:', ContactLegacyOrigin.objects.count())
print('LegacyVendor:', LegacyVendor.objects.count())
print('LegacySaleNote:', LegacySaleNote.objects.count())
print('LegacyPayment:', LegacyPayment.objects.count())
print('WorkOrder (manual, FINISHED):', WorkOrder.objects.filter(is_manual=True, current_stage='FINISHED').count())
print('LegacyImport (COMPLETED):', LegacyImport.objects.filter(status='COMPLETED').count())

# Validación cruzada
assert ContactLegacyOrigin.objects.count() == 2843
assert LegacyVendor.objects.count() == 137
assert LegacySaleNote.objects.count() == 7980
assert LegacyPayment.objects.count() == 8556
print('OK: reconciliación cuadrada')
PY
```

## 5. Reporte de riesgos (snapshot 2026-06-02)

| Riesgo | Valor real (verificado 2026-06-13) | Acción |
|---|---|---|
| RUT inválido (módulo 11) | sin confirmar (2.843 RUT únicos y no vacíos) | Validar módulo 11 al importar; `tax_id_exception=True` + placeholder `LEGACY-<id>` + `raw_tax_id` |
| NVs anuladas | **0 (no existe el estado `anulada`)** | Nada que omitir; todas las 7.980 se importan |
| NVs sin pagos | 31/7.980 | Importadas con 0 `LegacyPayment` (UI: "Saldo pendiente") |
| NVs con múltiples pagos | 607/7.980 | N `LegacyPayment` por NV |
| **NVs sobrepagadas** (Σ pagos > total) | **7/7.980** | `pending_amount` se clampa a 0 (no negativo) |
| Método de pago ≠ efectivo | **62/8.556** (transferencia 53 + **tarjeta** 9) | `method ∈ {efectivo, transferencia, tarjeta}` — **no existe `cheque`** |
| Soft-delete | columnas `deleted_at` existen (hoy 0 filas) | Importers filtran `WHERE deleted_at IS NULL` |
| OT histórica creada directa en `FINISHED` | 0 esperado | No se usa `create_manual`; verificar signals/validación de `WorkOrder.save()` en T14 |

## 6. Lo que NO se valida automáticamente

- **UI/UX**: el aspecto visual del chip, la posición en la tabla, la jerarquía visual → **manual**, captura de pantalla adjunta al PR.
- **Performance**: el listado con 7.960 NVs adicionales puede degradar el `load time` de `SalesOrdersView` → **manual**, medir con `?include=legacy&page_size=50` y comparar con `?include=none`.
- **Búsqueda global**: la decisión de incluir NVs y excluir contactos → **manual**, 3 búsquedas de prueba.

## 7. Cierre del proyecto

Una vez cumplimentado el DoD:

1. Merge del PR con todos los cambios.
2. Tag de release: `vX.Y.Z+legacy-import`.
3. Comunicación al equipo de ventas: "Ahora ven NVs legacy; pueden buscar, ver y registrar pagos".
4. Monitoreo 1 semana: revisar logs de `legacy.import` y conteos de `LegacyPaymentRegistration`.
5. Deprecación de la app `legacy` (en el futuro, cuando se decida re-importar como `SaleOrder` real): seguir `deprecate-feature.md`.
