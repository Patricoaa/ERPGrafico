---
layer: 50-audit
doc: bancos/README
status: active
owner: core-team
last_review: 2026-06-03
kind: roadmap-index
---

# Roadmap Bancos — Índice maestro

**Audiencia:** agente LLM (Claude Code u otro) ejecutando tareas atómicas.
**Objetivo:** completar **todos** los procesos de gestión bancaria del ERP. Esta carpeta
es la fuente de verdad self-contained: un agente puede leer estos archivos y ejecutar sin
re-derivar el contexto del código.

> Origen: análisis del dominio bancario (2026-06-01) + trabajo entregado en la rama
> `feat/integración-bancaria`. Decisiones de alcance confirmadas con el usuario el 2026-06-02.

---

## Cómo usar esta carpeta (routing para el LLM)

| Necesitas… | Lee |
|------------|-----|
| Entender qué existe hoy y dónde vive | [00-estado-actual.md](00-estado-actual.md) |
| Cerrar deuda de lo ya entregado (convergencia prod, settings, enums) | [fase-1-operativo.md](fase-1-operativo.md) |
| Implementar créditos/préstamos bancarios (CLP + UF) | [fase-2-creditos-bancarios.md](fase-2-creditos-bancarios.md) |
| Estado de cuenta y pago de tarjeta de crédito propia | [fase-3-tarjeta-credito.md](fase-3-tarjeta-credito.md) |
| Completar cheques (propios girados, endoso, folios, alertas, UI) | [fase-4-cheques.md](fase-4-cheques.md) |
| Vistas/servicios transversales (Centro de Bancos, flujo de caja, alertas) | [fase-5-transversal.md](fase-5-transversal.md) |

---

## Estado de fases

| Fase | Módulo | Esfuerzo | Prioridad | Estado |
|------|--------|----------|-----------|--------|
| — | Taxonomía cuentas vs métodos (wizard, provisión, convergencia) | — | — | ✅ Hecho (ADR-0031) |
| — | Tarjeta de crédito como pasivo | — | — | ✅ Hecho (ADR-0031) |
| — | Cheques recibidos (cartera, cuenta puente) | — | — | ✅ Hecho (ADR-0032) |
| **1** | Operativo / limpieza | S–M | **#1** | ✅ Cerrada en dev box — pendiente promover F1.1+F1.2 a staging/prod |
| **2** | Créditos bancarios (CLP + UF) | XL | #2 | 🔄 En curso (2026-06-03) |
| **3** | Tarjeta de crédito: estado + pago | L | #3 | ⬜ Pendiente |
| **4** | Cheques: propios girados + endoso + extras | L | #4 | ⬜ Pendiente |
| **5** | Transversal (Centro de Bancos, flujo, alertas) | L | #5 | ⬜ Pendiente |

> El orden de prioridad lo fijó el usuario (operativo primero). Las fases 2–5 son
> independientes entre sí salvo dependencias explícitas anotadas en cada archivo;
> pueden reordenarse. **Fuera de alcance** (decisión del usuario): los items de
> conciliación descartados en `docs/30-playbooks/bank-reconciliation-roadmap.md`
> (Sprint 6: PDF formal, cierre mensual, libro-vs-banco, export, alertas stale).

---

## Convenciones obligatorias para el LLM ejecutor

1. **Antes de tocar código**, lee el playbook que aplique en `docs/30-playbooks/`
   (`add-feature.md`, `add-endpoint.md`, `add-migration.md`, `modify-schema.md`,
   `add-background-task.md`) y `docs/20-contracts/component-decision-tree.md`.
2. Respeta los **12 invariantes globales** (`CLAUDE.md` / `GOVERNANCE.md`): zero-`any`,
   tokens semánticos (no colores Tailwind crudos), imports por barrel, **no** `useQuery`/
   `useMutation` en componentes (envolver en hooks `features/*/hooks/`), vistas Django
   **≤20 líneas** (lógica en `services.py`), `StatusBadge` como único renderer de estado.
3. **Reutiliza** la infraestructura existente. En particular:
   - `TreasuryService.create_movement` (`backend/treasury/services.py`) genera el
     `TreasuryMovement` **y** su asiento contable. No dupliques contabilidad.
   - Patrón de cuenta puente: una `TreasuryAccount` system-managed por concepto
     (ver `CHECK_PORTFOLIO`); para deuda usar tipo de cuenta contable `LIABILITY`.
   - Cuentas configurables → `accounting.AccountingSettings` (FK a `Account`).
   - Selectores: `AccountSelector`, `TreasuryAccountSelector`, `AdvancedContactSelector`.
   - UI listas: `DataTableView`; formularios: `Drawer`/`BaseModal`/`GenericWizard` +
     `react-hook-form` + `zodResolver`.
4. **Migraciones:** cambios de modelo → `makemigrations`; con backfill cuando se elimina
   o re-tipa data. Cambios a `limit_choices_to`/`choices` generan `AlterField` (no-op DB).
5. **Tests:** obligatorios para cada servicio nuevo. Caso feliz + transición inválida +
   reversa/rollback.
6. **Cada tarea = 1 commit atómico** con mensaje convencional (`feat(treasury):`,
   `feat(finances):`, `fix(...)`). Terminar con `Co-Authored-By` del modelo.
7. **Verificación obligatoria:** antes de marcar una tarea ✅, ejecutar literal el comando
   del DoD (test/grep/migrate) y citar el resultado. No marcar por inferencia.

### Contratos a respetar en entidades / UI nuevas

Toda fase que cree una entidad, estado o monto **debe** cumplir estos contratos del
proyecto (de lo contrario el PR se rechaza):

- **Entidad nueva** (`BankLoan`, `LoanInstallment`, `CreditCardStatement`, `Checkbook`…):
  registrarla en `frontend/lib/entity-registry.ts` (`ENTITY_REGISTRY`) para `display_id`,
  icono, `listUrl`/`detailUrlPattern`. Contrato: `docs/20-contracts/entity-identity.md`
  (GOVERNANCE regla 42). El `display_id` del modelo (`CRE-{id}`, etc.) es el identificador
  de negocio; nunca exponer el PK como tal.
- **Estados nuevos:** documentarlos en `docs/20-contracts/state-map.md` **y** añadirlos al
  `STATUS_MAP` de `frontend/lib/badge-resolvers.ts`. Renderizar SIEMPRE con `StatusBadge`.
- **Montos:** `DecimalField` en backend (seguir el patrón de `TreasuryMovement.amount`,
  `decimal_places=2`); render SOLO con `MoneyDisplay` (ADR-0014, GOVERNANCE regla 41).
  Para UF, guardar el valor UF usado por trazabilidad.
- **Formularios:** `react-hook-form` + `zodResolver`, schema en el componente/`schema.ts`.
  Drawer/Modal/Wizard según `docs/20-contracts/component-form-patterns.md`.
- **Entity drawers / drill-down:** si la entidad se abre desde otras vistas, registrarla en
  el drawer registry (`docs/20-contracts/component-entity-drawers.md`).
- **Contrato modificado / API pública nueva:** requiere ADR (invariante 12). Cada fase de
  feature cierra con su ADR (ver "Commits de la fase").

### Estructura de cada archivo de fase

Cada `fase-N-*.md` contiene: **Objetivo de la fase** → **Tareas** (`F<n>.<m>`, con DoD) →
**Commits de la fase** (secuencia atómica a ejecutar) → **Verificación de la fase**. Cada
commit cierra con `Co-Authored-By: <modelo> <noreply@anthropic.com>`.

### Nota de entorno de tests (importante)

El sandbox local usa **SQLite** y una migración antigua (`treasury/0008`) tiene SQL
específico de Postgres → la suite no construye el esquema con migraciones. Workaround:

```bash
cd backend && TMPDIR=/tmp venv/bin/pytest treasury/tests/test_<x>.py --no-migrations -p no:cacheprovider
```

`backend/treasury/tests/conftest.py` ya: (a) fuerza caché en memoria si Redis no es
alcanzable, y (b) limpia singletons entre tests. **La verificación canónica corre contra
Postgres+Redis reales** en el dev box (ver [00-estado-actual.md](00-estado-actual.md#entorno-de-verificación-real)).

---

## Formato de tarea

Cada tarea en los archivos de fase sigue este contrato:

```
### F<n>.<m> · Título
- Objetivo: qué problema resuelve (1–2 líneas)
- Dificultad: S (≤2h) · M (½–1 día) · L (1–3 días) · XL (3–5 días)
- Archivos clave: rutas a crear/editar
- Precondiciones: tareas previas requeridas
- Cambios esperados: bullets observables
- DoD: comandos/criterios verificables
```
