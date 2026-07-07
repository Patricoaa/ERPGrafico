# 99 — Guía de Ejecución para LLM

> Manual operativo paso-a-paso. Lee este documento ANTES de empezar a implementar tareas. Define preflight checks, flujo de trabajo y criterios de "tarea terminada".

---

## ⚠️ Precondiciones antes de comenzar CUALQUIER tarea

Verifica en orden:

1. **Estás en el directorio correcto**
   ```bash
   pwd  # debe ser /home/pato/Nextcloud/Pato/Aplicaciones/ERPGrafico
   ```

2. **Estás en una rama nueva, no en master**
   ```bash
   git status
   git checkout -b feat/prod-task-XXX-<slug>  # según naming en 10-roadmap.md
   ```

3. **Has leído los 4 documentos relevantes** (en orden):
   1. [00-audit-report.md](00-audit-report.md) — entender el hallazgo
   2. [10-roadmap.md](10-roadmap.md) — entender la fase y dependencias
   3. [20-task-list.md](20-task-list.md) — leer la tarea **completa** + sus dependencias
   4. [30-patterns.md](30-patterns.md) — si la tarea referencia un patrón, leer su sección

4. **Las dependencias de la tarea están completadas** (marcadas en `20-task-list.md`).
   - Si no, NO empezar. Implementar primero la dependencia o avisar al owner.

5. **El estado actual del repo es limpio**
   ```bash
   git status  # debe estar sin archivos sin commitear, salvo los que tú modifiques
   ```

---

## Flujo de trabajo por tarea

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. Leer tarea + dependencias + patrones referenciados           │
│ 2. Crear branch                                                  │
│ 3. Verificar precondiciones                                      │
│ 4. Implementar cambio                                            │
│ 5. Escribir/actualizar tests (backend obligatorio)              │
│ 6. Correr verificaciones locales (lint, type-check, pytest)     │
│ 7. Probar manualmente la feature (si aplica UI)                 │
│ 8. Commit + push                                                 │
│ 9. Marcar checkbox en 20-task-list.md y commitear el cambio     │
│ 10. Crear PR con descripción enlazando TASK-XXX                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Comandos canónicos por contexto

### Backend (cambios en `backend/production/`)

```bash
# Después de cambiar models.py:
python backend/manage.py makemigrations production
python backend/manage.py migrate

# Tests específicos de production:
pytest backend/production/ -v

# Test específico:
pytest backend/production/tests/test_services_creation.py::test_create_from_sale_line -v

# Cobertura:
pytest backend/production/ --cov=production --cov-report=term-missing

# Lint:
ruff check backend/production/
```

### Frontend (cambios en `frontend/features/production/`)

```bash
# Type-check obligatorio:
cd frontend && npm run type-check

# Lint:
cd frontend && npm run lint

# Tests (si tocaste hooks o utilidades):
cd frontend && npm run test -- features/production

# Dev server para probar manualmente:
cd frontend && npm run dev
# → http://localhost:3000/production/orders
```

### Stack completo levantado

```bash
docker compose -f docker-compose.yml -f docker-compose.hybrid.yml up -d
cd frontend && npm run dev
```

---

## Cómo leer una tarea (ejemplo paso-a-paso)

Tomemos **TASK-101 — Crear `<OutsourcedServiceForm>` y migrar 3 usos**.

### Paso 1: identificar dependencias
```
Dependencias: TASK-001, TASK-103
```
→ Verificar que ambas están checkadas en `20-task-list.md`. Si no → STOP, hacer esas primero.

### Paso 2: identificar patrón referenciado
```
Acción: ver patrón completo en [30-patterns.md → OutsourcedServiceForm]
```
→ Ir a `30-patterns.md`, sección P-OSF. Leer API, schema, ejemplo de migración.

### Paso 3: identificar archivos afectados
```
- Crear: frontend/features/production/components/forms/OutsourcedServiceForm.tsx
- Migrar: BOMFormModal.tsx, OutsourcingAssignmentStep.tsx
```
→ Leer los archivos a migrar **antes** de crear el nuevo, para entender cómo se usan hoy.

### Paso 4: implementar en orden
1. Crear `OutsourcedServiceForm.tsx` con la API del patrón.
2. Migrar **uno** de los consumers (e.g. `OutsourcingAssignmentStep.tsx`) y verificar que funciona.
3. Migrar el segundo (`BOMFormModal.tsx`).
4. Si quedaron resquicios en `MaterialAssignmentStep.tsx` post TASK-001, limpiar.
5. Exportar el componente desde `features/production/components/index.ts`.

### Paso 5: verificar criterios de aceptación
```
- [ ] Componente exportado desde index.ts
- [ ] Los 3 (ahora 2) usos lo consumen
- [ ] BOMFormModal reduce de ~180 LOC a ~30 LOC
- [ ] Cero hardcode de 1.19 en archivos migrados
```
→ Marcar cada checkbox. Si alguno no se cumple, NO es "tarea terminada".

### Paso 6: tests / verificaciones
```bash
cd frontend && npm run type-check && npm run lint
```

### Paso 7: prueba manual
- Abrir `/production/orders/<id>` → wizard → etapa OUTSOURCING_ASSIGNMENT → agregar servicio.
- Abrir `/inventory/products/<id>/manufacturing` → BOM modal → agregar servicio tercerizado.
- Verificar que ambos formularios usan el componente compartido y funcionan.

### Paso 8: commit
```bash
git add frontend/features/production/components/forms/OutsourcedServiceForm.tsx
git add frontend/features/production/components/BOMFormModal.tsx
git add frontend/features/production/components/steps/OutsourcingAssignmentStep.tsx
git add frontend/features/production/components/index.ts
git commit -m "[TASK-101] Extract OutsourcedServiceForm shared component

- New component frontend/features/production/components/forms/OutsourcedServiceForm.tsx
- BOMFormModal and OutsourcingAssignmentStep now consume it
- Reduces ~240 LOC duplicate code"
```

### Paso 9: actualizar task-list
```bash
# Editar 20-task-list.md y marcar:
# - [x] El componente está exportado desde features/production/components/index.ts.
git add docs/50-audit/Producción/20-task-list.md
git commit -m "[TASK-101] Mark complete in task-list"
```

### Paso 10: PR
```bash
git push -u origin feat/prod-task-101-outsourced-service-form
gh pr create --title "[TASK-101] Extract OutsourcedServiceForm shared component" --body "$(cat <<'EOF'
## Summary
- Refs TASK-101 in docs/50-audit/Producción/20-task-list.md
- Creates shared OutsourcedServiceForm consumed by BOMFormModal + OutsourcingAssignmentStep
- Removes hardcoded 1.19 in favor of useVatRate()

## Test plan
- [x] Add outsourced service from BOM modal
- [x] Add outsourced service from OT wizard (OUTSOURCING_ASSIGNMENT stage)
- [x] Edit outsourced service from BOM
- [x] Check net price calculated correctly with useVatRate
EOF
)"
```

---

## Criterios de "tarea NO terminada"

Marcar una tarea como completada solo si TODOS estos checks pasan:

- ❌ **NO terminada si:** algún criterio de aceptación está sin checkear.
- ❌ **NO terminada si:** `npm run type-check` falla.
- ❌ **NO terminada si:** `pytest backend/production/` falla.
- ❌ **NO terminada si:** la verificación manual revela regresión en otra feature.
- ❌ **NO terminada si:** los tests obligatorios (ver `40-testing-strategy.md`) no se escribieron.
- ❌ **NO terminada si:** quedan TODO/FIXME/XXX nuevos en el código.
- ❌ **NO terminada si:** se rompieron tests existentes sin explicación documentada.

---

## Reglas del proyecto que aplican (de CLAUDE.md)

Estas reglas son **invariantes** del proyecto. Violarlas = PR rechazado:

1. **Zero `any` en TypeScript** — usar Zod-derived types o `unknown` + type guard.
2. **No raw Tailwind colors** — usar semantic tokens (`bg-primary`, `text-muted-foreground`).
3. **No cross-feature internal imports** — importar de feature barrel (`@/features/X` no `@/features/X/components/internal`).
4. **No `useQuery`/`useMutation` directos en componentes** — wrap en hook bajo `features/*/hooks/`.
5. **No `@/lib/api` directo en componentes/pages** — solo desde `features/*/api/`, `features/*/hooks/`, `/hooks/`.
6. **Shared components solo vía barrel** — `import { X } from '@/components/shared'`.
7. **StatusBadge es el único renderer de status autorizado.**
8. **Todos los forms** usan `react-hook-form` + `zodResolver` con schema en `components/forms/schema.ts`.
9. **Views ≤ 20 líneas** en Django — lógica en `services.py`.

Si una tarea de este plan parece violar alguna regla, **detenerse y consultar al owner**.

---

## Tabla de comandos por contexto rápido

| Contexto | Comando | Cuando usar |
|---|---|---|
| Type-check frontend | `cd frontend && npm run type-check` | Después de cualquier cambio en TS/TSX |
| Lint frontend | `cd frontend && npm run lint` | Antes de commit |
| Tests backend | `pytest backend/production/ -v` | Después de cualquier cambio backend |
| Tests backend con cobertura | `pytest backend/production/ --cov=production --cov-report=term-missing` | Antes de cerrar PR |
| Migraciones | `python backend/manage.py makemigrations production` | Tras tocar `models.py` |
| Aplicar migración | `python backend/manage.py migrate` | Después de `makemigrations` |
| Demo data | `python backend/manage.py setup_demo_data` | Si hace falta data para probar manualmente |
| Dev server full | `docker compose -f docker-compose.yml -f docker-compose.hybrid.yml up -d && cd frontend && npm run dev` | Para QA manual |
| Stop containers | `docker compose down` | Al final del día |

---

## Si algo sale mal

### Test falla y no entiendo por qué
1. Lee el mensaje completo: `pytest backend/production/tests/test_X.py::test_Y -v --tb=long`
2. Mira si la fixture es la correcta (verificar `conftest.py`).
3. Si es un test de transition/finalize, verifica que el `WorkflowService.create_task` no esté siendo llamado en el contexto incorrecto.

### TypeScript falla y veo errores en otros archivos
1. **No** desactives strictness ni añadas `any`.
2. Si tocaste un tipo compartido, revisa los consumers con `grep -rn "<TypeName>" frontend/`.
3. Si el error es por un campo nuevo en un schema, actualiza el tipo Zod derivado.

### Migración Django da conflicto
1. **No borres migraciones del repo.**
2. Si `makemigrations` propone una migración que NO querías, `git checkout` la migración nueva y replantea el cambio en el modelo.

### Manual testing rompe otra feature
1. **Detente.** No mergees.
2. Documenta la regresión, identifica si es por tu cambio o pre-existente.
3. Si es por tu cambio: revisar el código antes de continuar.

### Quedaste atascado > 30min
1. Lee de nuevo la tarea y su patrón referenciado.
2. Mira tests similares en otros módulos (`backend/sales/tests/`, `backend/billing/tests/`).
3. Si sigue trabado, marcar la tarea como **bloqueada** en `20-task-list.md` con comentario y pasar a otra independiente.

---

## Checklist de inicio rápido para tu primera tarea

Asumamos que vas a hacer **TASK-001** (fix `MaterialAssignmentStep.tsx`):

```bash
# 1. Verificar branch limpia
git status
git checkout master && git pull
git checkout -b fix/prod-task-001-material-assignment-state

# 2. Verificar TypeScript falla actualmente (esperado)
cd frontend && npx tsc --noEmit -p . 2>&1 | grep MaterialAssignmentStep

# 3. Leer documentos
# - docs/50-audit/Producción/20-task-list.md (sección TASK-001)
# - frontend/features/production/components/steps/MaterialAssignmentStep.tsx (líneas 51-91)

# 4. Implementar (eliminar código zombie, mantener solo stock materials)
# ... editar archivo ...

# 5. Verificar
cd frontend && npx tsc --noEmit -p . 2>&1 | grep MaterialAssignmentStep
# Esperado: vacío

cd frontend && npm run lint
# Esperado: sin errores

# 6. Probar manualmente
cd frontend && npm run dev
# Abrir /production/orders/<algún-id> → wizard → MATERIAL_ASSIGNMENT
# Agregar material de stock, verificar funciona

# 7. Commit
git add frontend/features/production/components/steps/MaterialAssignmentStep.tsx
git commit -m "[TASK-001] Remove zombie outsourcing form from MaterialAssignmentStep

This component used to handle both stock + outsourced materials.
Outsourced flow is now in OutsourcingAssignmentStep. Removed undeclared
state references and the unused OutsourcedForm subcomponent."

# 8. Marcar tarea completa en task-list
# Editar docs/50-audit/Producción/20-task-list.md, marcar checkboxes en TASK-001
git add docs/50-audit/Producción/20-task-list.md
git commit -m "[TASK-001] Mark complete in task-list"

# 9. Push + PR
git push -u origin fix/prod-task-001-material-assignment-state
gh pr create --title "[TASK-001] Fix MaterialAssignmentStep — remove zombie outsourcing state"
```

---

## Recordatorios finales

- **Una tarea = un PR** (con las excepciones explícitas de 10-roadmap.md).
- **Marca los checkboxes en `20-task-list.md`** después de cada tarea — es el tracker oficial.
- **Si descubres un nuevo bug durante una tarea**, NO lo arregles ahí. Documéntalo como tarea nueva en `20-task-list.md` y enfócate en lo que tenías.
- **Si una tarea revela que una decisión previa fue mala**, escribe una nota al final de `00-audit-report.md` en sección "Lessons learned" y consulta al owner.
- **No inventes patrones nuevos.** Si te falta un patrón, agrégalo a `30-patterns.md` antes de implementarlo en código.

---

¡Suerte! Empieza por FASE 1 (TASK-001 → TASK-006). Es 1 día de trabajo y desbloquea todo lo demás.
