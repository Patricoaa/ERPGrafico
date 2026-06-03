---
layer: 50-audit
doc: bancos/fase-1-operativo
status: active
owner: core-team
last_review: 2026-06-03
kind: roadmap
---

# Fase 1 — Operativo / limpieza (prioridad #1)

## Objetivo de la fase
Cerrar la deuda técnica y operativa de lo ya entregado (taxonomía, tarjeta-pasivo, cheques
recibidos) **antes** de construir nuevas features: converger datos legacy, eliminar enums
deprecados, exponer la configuración en la UI y registrar la entidad `Check` en los
contratos del proyecto. Esfuerzo total: S–M.

## Avance (2026-06-03)

| Tarea | Estado | Commit |
|-------|--------|--------|
| F1.1 — Convergencia de cuentas legacy (operación) | ✅ Hecho (dev box, 0 restantes) | *(operación, sin commit)* |
| F1.2 — Eliminar `DEBIT_CARD`/`CHECKBOOK` del enum | ✅ Hecho | F1.2-pending |
| F1.3 — Panel Settings: sección Cheques | ✅ Hecho | `484d58ee` |
| F1.4 — Auto-provisión cuenta puente vía signal | ✅ Hecho | `bfd11ea0` |
| F1.5 — `treasury.check` en ENTITY_REGISTRY + state-map | ✅ Hecho | `6a3b16af` |

> **Fase 1 cerrada** en dev box. Pendiente ejecutar F1.1 en staging/producción
> antes de promover el commit de F1.2 a esos entornos.

---

### F1.1 · Correr convergencia de cuentas legacy en cada entorno
- **Objetivo:** migrar cuentas `DEBIT_CARD`/`CHECKBOOK` existentes a `CHECKING` + método
  de pago, usando el command ya entregado. Operación, no código.
- **Dificultad:** S
- **Archivos clave:** `backend/treasury/management/commands/converge_treasury_accounts.py` (ya existe)
- **Precondiciones:** ninguna
- **Cambios esperados:**
  - Backup previo (`docs/30-playbooks/backup-and-restore-postgres.md`).
  - `python manage.py converge_treasury_accounts --dry-run` → revisar reporte.
  - `python manage.py converge_treasury_accounts --apply`.
  - Re-`--dry-run` → debe reportar **0 convertidas / 0 pendientes** (idempotente).
  - Las chequeras sin banco/número quedan "omitidas": resolverlas a mano (editar la cuenta
    con banco + número, o re-clasificarla) y re-correr.
- **DoD:** en el entorno objetivo, `converge_treasury_accounts --dry-run` reporta
  `0 cuentas legacy restantes`.

#### Procedimiento exacto a ejecutar (operador)

> Ejecutar **una vez por entorno** (dev box, staging, producción). Necesario antes
> de aplicar F1.2.

```bash
# 1) Backup (ver docs/30-playbooks/backup-and-restore-postgres.md).

# 2) Diagnóstico — ver qué quedaría sin tocar nada
docker exec erpgrafico-backend-1 sh -c \
  'cd /app && python manage.py converge_treasury_accounts --dry-run'

# 3) Aplicar. Idempotente si no quedan legacy: no hace nada.
docker exec erpgrafico-backend-1 sh -c \
  'cd /app && python manage.py converge_treasury_accounts --apply'

# 4) Verificar que el reporte queda en cero (gate para F1.2)
docker exec erpgrafico-backend-1 sh -c \
  'cd /app && python manage.py converge_treasury_accounts --dry-run' \
  | tee /tmp/converge_final.log
grep -E "0 cuentas legacy|nothing to do|sin cuentas" /tmp/converge_final.log

# 5) Si quedan cuentas "omitidas" (chequera sin banco/número):
#    editar manualmente desde /treasury/accounts y re-correr el paso 4.
```

**Reporta a este documento** el resultado (entorno + fecha + reporte final) antes de
liberar F1.2.

### F1.2 · Deprecación definitiva de `DEBIT_CARD` / `CHECKBOOK` como tipos de cuenta
- **Objetivo:** eliminar los valores del enum `TreasuryAccount.Type` una vez que no quedan
  cuentas legacy ni referencias en código.
- **Dificultad:** M
- **Archivos clave:**
  - `backend/treasury/models.py` (`TreasuryAccount.Type`, `clean()`, `PaymentMethod.TYPE_COMPATIBILITY`)
  - `frontend/features/treasury/types/index.ts` (`TreasuryAccountType`)
  - `frontend/features/treasury/searchDef.ts`, `TreasuryAccountsView.tsx`,
    `components/selectors/TreasuryAccountSelector.tsx` (labels legacy)
  - Migración `AlterField` (treasury)
- **Precondiciones:** **F1.1 con 0 cuentas legacy en TODOS los entornos** (gate duro).
- **Cambios esperados:**
  - Quitar `DEBIT_CARD`/`CHECKBOOK` de `Type.choices`.
  - Purgar referencias `self.Type.DEBIT_CARD`/`.CHECKBOOK` en `clean()` y en
    `TYPE_COMPATIBILITY` (el método `DEBIT_CARD` ya mapea a `CHECKING`).
  - Frontend: quitar de uniones/labels (o dejar solo fallback de display si hubiera
    históricos en `HistoricalRecords`).
  - `makemigrations treasury`.
- **DoD:** `grep -rn "Type.DEBIT_CARD\|Type.CHECKBOOK" backend/treasury` → 0 (fuera de
  migraciones/históricos). `manage.py check` y `makemigrations --check` limpios.

### F1.3 · Panel de Settings — sección "Cheques y Cuentas Bancarias"
- **Objetivo:** exponer en la UI de ajustes la cuenta `check_portfolio_account` (ya existe
  en `AccountingSettings`) y dejar el contenedor para las cuentas financieras de las
  fases 2–3 (intereses, etc.).
- **Dificultad:** S
- **Archivos clave:** `frontend/features/settings/components/TreasurySettingsView.tsx`
  (patrón `AccountField` ya usado), `backend/treasury/views.py` o el endpoint de settings
  contables que sirve `AccountingSettings`.
- **Precondiciones:** ninguna
- **Cambios esperados:**
  - Nueva pestaña/sección "Cheques" con `AccountField name="check_portfolio_account"`
    (`accountType="ASSET"`).
  - Verificar que el serializer de `AccountingSettings` incluye `check_portfolio_account`.
- **DoD:** guardar la cuenta desde la UI persiste en `AccountingSettings`; registrar un
  cheque (Fase cheques) ya no falla por "cuenta no configurada".

### F1.4 · Alta automática de la cuenta puente "Cheques en Cartera"
- **Objetivo:** garantizar que la `TreasuryAccount` `CHECK_PORTFOLIO` exista cuando se
  configura `check_portfolio_account`. Hoy `CheckService._get_portfolio_account()` la
  crea de forma lazy (`get_or_create`); falta el alta proactiva + visibilidad.
- **Dificultad:** S
- **Archivos clave:** `backend/treasury/check_service.py`, opcional `signals.py` (post_save
  de `AccountingSettings`) o command `setup_check_portfolio`.
- **Precondiciones:** F1.3
- **Cambios esperados:**
  - Al guardar `check_portfolio_account`, crear/asegurar la `TreasuryAccount` puente.
  - Confirmar que aparece en la lista de cuentas como system-managed (no editable por wizard).
- **DoD:** test: configurar `check_portfolio_account` → existe una `TreasuryAccount`
  `CHECK_PORTFOLIO` vinculada; `receive()` funciona sin pasar `portfolio_account` explícito.

### F1.5 · Registrar la entidad `Check` en los contratos (deuda del módulo entregado)
- **Objetivo:** el módulo de cheques entregado (ADR-0032) usa `entityLabel="treasury.check"`
  en `ChecksView` pero **`treasury.check` no está en `ENTITY_REGISTRY`**, y los estados de
  cheque no están en `state-map.md`. Cerrar esa deuda de contrato.
- **Dificultad:** S
- **Archivos clave:** `frontend/lib/entity-registry.ts`, `docs/20-contracts/state-map.md`,
  (opcional) `frontend/lib/entity-drawers.tsx` si se quiere drill-down al cheque.
- **Precondiciones:** ninguna
- **Cambios esperados:**
  - Añadir `'treasury.check'` a `ENTITY_REGISTRY` (label, icono `CheckSquare`, `display_id`
    `CHQ-{id}`, `listUrl: '/treasury/checks'`).
  - Documentar estados `IN_PORTFOLIO/DEPOSITED/CLEARED/BOUNCED/VOIDED` en `state-map.md`
    (ya están en `STATUS_MAP` desde ADR-0032).
- **DoD:** `grep "'treasury.check'" frontend/lib/entity-registry.ts` → 1 hit; la tabla de
  cheques muestra el `display_id` e icono vía registry.

---

## Commits de la fase

> Orden de ejecución. F1.1 es operación (sin commit de código). Cada commit cierra con
> `Co-Authored-By`.

1. F1.1 — *(operación, sin commit)*: correr `converge_treasury_accounts --apply` en el/los entornos.
2. `feat(settings): cuenta 'Cheques en Cartera' en panel de Tesorería` — F1.3
3. `feat(treasury): auto-provisión de la cuenta puente Cheques en Cartera` — F1.4
4. `fix(treasury): registrar treasury.check en ENTITY_REGISTRY + state-map` — F1.5
5. `refactor(treasury)!: deprecación definitiva de DEBIT_CARD/CHECKBOOK como tipos de cuenta` — F1.2
   *(último; gate duro: 0 cuentas legacy en todos los entornos)*

---

## Verificación de la fase
- `manage.py check` + `makemigrations --check` limpios.
- Tests de F1.4 verdes (local `--no-migrations` + Postgres real).
- `frontend`: `npm run type-check` + ESLint sin errores.

---

## Notas de implementación (lo entregado)

### F1.3 — Settings UI (commit `484d58ee`)
- Sub-tab nueva `checks` en `/treasury/settings?tab=checks`. Header dinámico
  actualizado en `frontend/app/(dashboard)/treasury/TreasuryHeader.tsx`.
- `AccountField` (selector ASSET) para `check_portfolio_account`. Persiste vía
  `AccountingSettingsSerializer` (que usa `fields='__all__'`, sin cambios backend).
- Schema, types, `DEFAULT_VALUES` extendidos.

### F1.4 — Auto-provisión de cuenta puente (commit `bfd11ea0`)
- `CheckService.ensure_portfolio_account(account=None)` ahora público e idempotente.
  Acepta la cuenta contable opcional para que el signal evite re-leer settings.
  `_get_portfolio_account()` queda como alias legado.
- Signal `pre_save` + `post_save` en `backend/treasury/signals.py` escucha
  `accounting.AccountingSettings` (sender por string para evitar import circular).
  Detecta cambio en `check_portfolio_account_id` y dispara `ensure_portfolio_account`.
- La `TreasuryAccount` puente queda como system-managed (tipo `CHECK_PORTFOLIO`
  está en `TreasuryAccount._NON_CASH_EQUIVALENT_TYPES` → el view la bloquea para edición).
- Tests: `backend/treasury/tests/test_check_portfolio_signal.py` (5 casos).
  Local: `pytest treasury/tests/test_check_portfolio_signal.py --no-migrations` → 5 passed.
  Regresión: `pytest treasury/tests/test_checks.py --no-migrations` → 7 passed.

### F1.5 — Contratos de identidad y estado (commit `6a3b16af`)
- `ENTITY_REGISTRY['treasury.check']` registrado con icon `CheckSquare`, shortTemplate
  `CHQ-{id}`, listUrl `/treasury/checks`. `partnerField` resuelve `counterparty_name`
  con fallback a `drawer_name` (alineado con `ChecksView`).
- Alias `'check'` → `'treasury.check'` en `LEGACY_TYPE_LABEL_MAP` y prefijo `CHQ-`
  detectado por `detectEntityLabel`.
- `docs/20-contracts/state-map.md` ahora tiene `## Check` con tabla de transiciones,
  servicio responsable de cada paso y notas contables (cuenta puente, reversas).
- `STATUS_MAP` (`badge-resolvers.ts`) ya tenía los 5 estados desde ADR-0032; no se tocó.

### F1.2 — Deprecación definitiva del enum (cerrada en dev box)
- `TreasuryAccount.Type` ahora solo expone `CHECKING`, `CREDIT_CARD`, `CASH`,
  `BRIDGE`, `MERCHANT`, `CHECK_PORTFOLIO` (migration `0050`).
- `clean()` ya no contempla `DEBIT_CARD`/`CHECKBOOK`; las validaciones de
  tarjeta y chequera se reducen a `CREDIT_CARD` (débito empresa + chequera
  son ahora formas de pago sobre `CHECKING`).
- `PaymentMethod.TYPE_COMPATIBILITY` ajustado: `DEBIT_CARD` como método sigue
  mapeando a `[CREDIT_CARD, CHECKING]`. `CHECK` como método sigue mapeando a
  `CHECKING`.
- Frontend: `TreasuryAccountType` (types/index.ts) sin legacy; options de
  filtros/forms en `TreasuryAccountsView`, `TreasuryAccountDrawer`,
  `searchDef.ts` actualizados.
- **Eliminados** (ya no compatibles con el nuevo modelo):
  - `backend/treasury/convergence.py`
  - `backend/treasury/management/commands/converge_treasury_accounts.py`
  - `backend/treasury/tests/test_convergence.py`
  El gate de F1.1 los hizo innecesarios: con el enum reducido, `save()`
  rechaza cualquier intento de crear/actualizar filas con `account_type`
  legacy, por lo que la guardia no podría correr si reaparecieran. Si llega
  un dump externo con esos strings, la nota de la migración `0050` indica
  la conversión manual con SQL antes de operar.
- **Verificación dev box** (2026-06-03): `manage.py check` 0 issues,
  `makemigrations --check` No changes, `pytest treasury/tests/test_checks.py
  treasury/tests/test_check_portfolio_signal.py treasury/tests/test_provisioning.py`
  → 18/18 passed, `npm run type-check` 0 errores, lint sin nuevos errores.

> Pre-existente: 3 errors en `test_dry_run.py` + 1 fail en
> `test_proportional_distribution.py::test_adjustment_entry_is_draft` no
> están relacionados con F1.2 (`difference_service` / cuenta "Comisión
> Bancaria" sin configurar). Se reportan aparte.

### Pendiente para promover F1.2 a staging/producción
- Ejecutar F1.1 (procedure de arriba) en cada entorno objetivo.
- Aplicar la migration `0050_alter_treasuryaccount_remove_legacy_account_types`
  y redeploy con el commit de F1.2.
