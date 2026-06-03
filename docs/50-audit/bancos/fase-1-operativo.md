---
layer: 50-audit
doc: bancos/fase-1-operativo
status: active
owner: core-team
last_review: 2026-06-02
kind: roadmap
---

# Fase 1 — Operativo / limpieza (prioridad #1)

## Objetivo de la fase
Cerrar la deuda técnica y operativa de lo ya entregado (taxonomía, tarjeta-pasivo, cheques
recibidos) **antes** de construir nuevas features: converger datos legacy, eliminar enums
deprecados, exponer la configuración en la UI y registrar la entidad `Check` en los
contratos del proyecto. Esfuerzo total: S–M.

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
5. `refactor(treasury)!: eliminar DEBIT_CARD/CHECKBOOK del enum TreasuryAccount.Type` — F1.2
   *(último; gate duro: 0 cuentas legacy en todos los entornos)*

---

## Verificación de la fase
- `manage.py check` + `makemigrations --check` limpios.
- Tests de F1.4 verdes (local `--no-migrations` + Postgres real).
- `frontend`: `npm run type-check` + ESLint sin errores.
