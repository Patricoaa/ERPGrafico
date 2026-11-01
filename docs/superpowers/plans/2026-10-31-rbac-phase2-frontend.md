# RBAC Fase 2 — Frontend · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Completar el ciclo RBAC en el frontend: tipos desde el catálogo, `can()` con criterio único, protección de rutas por módulo, 403 global, editor de composición de roles por paquetes y limpieza del código muerto.

**Architecture:**

- El editor de composición consulta `GET /permissions/bundles/` para construir la matriz (filas = módulos, columnas = read/operate/manage + capacidades sensibles) y `GET|PUT /groups/{id}/composition/` para leer y escribir la composición de un rol concreto.  
- Un nuevo `can()` exportado desde `AuthContext` (criterio único: `is_superuser || permissions.includes(p)`) reemplaza la lógica dispersa; `<Can permission=…>` envuelve `can()`. El actual `PermissionGuard` queda como alias deprecado que usa `<Can>` internamente.  
- La protección de rutas se implementa con un componente `<ModuleGuard>` que llama a `can(view_dashboard_{module})` y redirige a `/403` si falla. Cada `layout.tsx` de módulo lo monta.

**Tech Stack:** Next.js 16 App Router, TypeScript, TanStack Query v5, Zod, react-hook-form, Shadcn UI, Tailwind 4 (semántico).

**Spec:** [`docs/superpowers/specs/2026-10-29-rbac-design.md`](../specs/2026-10-29-rbac-design.md) §2 decisión 10 y §3 Fase 2.

## Global Constraints

- **Zero `any`** — types derivados de Zod o de TypedDicts con tipos explícitos.
- **Sin colores Tailwind crudos** — solo tokens semánticos (`bg-primary`, `text-muted-foreground`).
- **Sin import cruzado de features** — importar desde el barrel `features/*/index.ts`.
- **Sin `useQuery`/`useMutation` directo en componentes** — siempre a través de hooks en `features/*/hooks/`.
- **Shared components solo por barrel** — `import { X } from '@/components/shared'`.
- Vistas de Django ≤ 20 líneas (solo aplica a la Task 1 que toca el backend).
- Tests frontend: `cd frontend && npm run test -- <ruta>`.
- Tests backend: `cd backend && CACHE_BACKEND=locmem CHANNEL_BACKEND=locmem venv/bin/python -m pytest <ruta> -v`.
- Type-check frontend: `cd frontend && npm run type-check`.

## Review Focus

- **Actor sin `change_group` abre el editor de composición**: debe ver la matriz en solo lectura (sin botón Guardar ni checkboxes habilitados), no 403 ni pantalla vacía.
- **Role con `is_system=True`**: la UI debe desactivar todos los controles y mostrar aviso; el PUT que llegue al backend ya lo rechaza con 400.
- **Módulo con `permission: null` en `module-registry.ts` (contacts)**: `<ModuleGuard>` debe dejar pasar cuando `permission` es `null`; no redirigir a 403 por falta de permiso inexistente.
- **Usuario superusuario**: `can(p)` devuelve `true` para cualquier `p`; el editor de composición no aplica el filtro de no-escalada para superusuarios.
- **Respuesta 403 antes de que `AuthContext` termine de cargar**: la interceptación en `lib/api.ts` no debe disparar el evento `auth:forbidden` si la respuesta es a `/api/auth/` (es una 403 de credenciales, no de permisos), para no confundir con la sesión ya inicializada.

---

### Task 1: Backend — grupos con `kind` en UserSerializer + kind en create de grupos

**Propósito:** permitir que el `UserDrawer` muestre correctamente roles vs equipos (I5 del ledger de Fase 1) y que `POST /groups/` acepte `kind` al crear un grupo nuevo.

**Files:**
- Modify: `backend/core/serializers/__init__.py` (`UserSerializer`)
- Modify: `backend/core/views.py` (`GroupViewSet.perform_create`)
- Test: `backend/core/tests/test_user_groups_kind.py`

**Interfaces:**
- Produces: `GET /api/core/users/{id}/` devuelve `groups: [{id, name, kind}]` en lugar de `groups: [name]`; `POST /api/core/groups/ {name, kind}` crea con el `kind` indicado (default `TEAM`).
- Consumes: `GroupProfile.kind` (de Fase 1), `GroupSerializer` (solo lectura del kind).

- [ ] **Step 1: Write failing tests**

```python
# test_user_groups_kind.py
def test_get_user_returns_groups_with_kind(api_client, user_with_role):
    """GET /users/{id}/ returns groups as [{id, name, kind}], not [name]."""
    res = api_client.get(f"/api/core/users/{user_with_role.id}/")
    assert res.status_code == 200
    groups = res.data["groups"]
    assert len(groups) > 0
    assert isinstance(groups[0], dict)
    assert "kind" in groups[0]
    assert groups[0]["kind"] in ("ROLE", "TEAM", None)

def test_create_user_accepts_group_names_as_before(api_client, admin_user, role_group):
    """POST /users/ still accepts groups as [name] strings (backwards compat)."""
    api_client.force_authenticate(admin_user)
    res = api_client.post("/api/core/users/", {..., "groups": [role_group.name]})
    assert res.status_code == 201

def test_create_group_with_kind_role(api_client, admin_user):
    """POST /groups/ {name, kind: ROLE} creates a ROLE GroupProfile."""
    from core.models import GroupProfile
    api_client.force_authenticate(admin_user)
    res = api_client.post("/api/core/groups/", {"name": "Nuevo Puesto", "kind": "ROLE"})
    assert res.status_code == 201
    profile = GroupProfile.objects.get(group__name="Nuevo Puesto")
    assert profile.kind == "ROLE"

def test_create_group_defaults_to_team(api_client, admin_user):
    """POST /groups/ without kind defaults to TEAM."""
    from core.models import GroupProfile
    api_client.force_authenticate(admin_user)
    res = api_client.post("/api/core/groups/", {"name": "Equipo Test"})
    assert res.status_code == 201
    assert GroupProfile.objects.get(group__name="Equipo Test").kind == "TEAM"
```

- [ ] **Step 2: Run tests — expected FAIL** (`python -m pytest core/tests/test_user_groups_kind.py -v`)

- [ ] **Step 3: Implement in `UserSerializer`**

Cambiar el campo `groups`:
- Para lectura (output): `SerializerMethodField` que devuelve `[{"id": g.id, "name": g.name, "kind": getattr(g, "profile", None) and g.profile.kind}]`
- Para escritura (input): mantener aceptar slugs (nombres de grupo) — usar un campo separado `write_only` que mapea nombres a Group objects

El patrón es: campo `groups` en Meta, pero sobreescrito con dos fields: `groups_detail` para GET y `groups` como `SlugRelatedField(write_only=True, …)`. Alternativamente, un `to_representation` que transforma la lista de grupos a objetos con kind.

Implementación recomendada: usar `to_representation` para post-procesar `groups` en la salida, sin cambiar la escritura existente.

```python
def to_representation(self, instance):
    data = super().to_representation(instance)
    data["groups"] = [
        {
            "id": g.id,
            "name": g.name,
            "kind": g.profile.kind if hasattr(g, "profile") else None,
        }
        for g in instance.groups.select_related("profile").all()
    ]
    return data
```

- [ ] **Step 4: Implement kind in `GroupViewSet.perform_create`**

En `views.py`, `GroupViewSet.perform_create`: leer `request.data.get("kind", "TEAM")` y actualizar el perfil post-save. El `post_save` signal ya crea el perfil con kind=TEAM; si `kind == "ROLE"`, actualizar el perfil.

```python
def perform_create(self, serializer):
    instance = serializer.save()
    kind = self.request.data.get("kind", "TEAM")
    if kind == "ROLE":
        profile = instance.profile
        profile.kind = "ROLE"
        profile.save(update_fields=["kind"])
```

- [ ] **Step 5: Implement `sod_warnings` in user create/update response (I4)**

Los endpoints `POST /core/users/` y `PATCH /core/users/{id}/` actualmente devuelven solo `serializer.data`. El `UserDrawer` ya espera `sod_warnings` en la respuesta pero nunca los recibe.

Sobreescribir `create` y `update` en `UserViewSet` para devolver `sod_warnings` en la respuesta:

```python
def create(self, request, *args, **kwargs):
    serializer = self.get_serializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    # perform_create sets request._rbac_sod_warnings
    self.perform_create(serializer)
    data = serializer.data
    data["sod_warnings"] = getattr(request, "_rbac_sod_warnings", [])
    return Response(data, status=status.HTTP_201_CREATED)

def update(self, request, *args, **kwargs):
    partial = kwargs.pop("partial", False)
    instance = self.get_object()
    serializer = self.get_serializer(instance, data=request.data, partial=partial)
    serializer.is_valid(raise_exception=True)
    self.perform_update(serializer)
    data = serializer.data
    data["sod_warnings"] = getattr(request, "_rbac_sod_warnings", [])
    return Response(data)
```

Y en `perform_create` y `perform_update`, guardar `sod_warnings` en `request._rbac_sod_warnings` tras calcularlos.

Agregar tests:
```python
def test_create_user_response_includes_sod_warnings(api_client, admin_user, ...):
    """POST /users/ with SoD-conflicting groups returns sod_warnings in response."""
    ...
    assert "sod_warnings" in res.data

def test_update_user_response_includes_sod_warnings(api_client, admin_user, ...):
    """PATCH /users/{id}/ returns sod_warnings (empty list when no conflict)."""
    ...
    assert res.data["sod_warnings"] == []
```

- [ ] **Step 6: Run tests — expected PASS** (`python -m pytest core/tests/test_user_groups_kind.py -v`)

- [ ] **Step 7: Run full core test suite** (`python -m pytest core/tests/ -v`)

- [ ] **Step 8: Commit**

```bash
git add backend/core/serializers/__init__.py backend/core/views.py backend/core/tests/test_user_groups_kind.py
git commit -m "feat(rbac): expose group kind in UserSerializer, sod_warnings in user response, kind on group create"
```

---

### Task 2: Frontend — tipos, hooks, `can()` y `<Can>`

**Propósito:** Proveer a toda la UI de tipos TypeScript exactos para las respuestas del catálogo y los paquetes, hooks TanStack Query para la composición, y un `can()` con criterio único que reemplaza la lógica dispersa.

**Files:**
- Modify: `frontend/types/entities.ts` (actualizar `AppGroup.groups` en `AppUser`)
- Create: `frontend/features/users/api/rbacApi.ts`
- Modify: `frontend/features/users/api/index.ts` (re-exportar)
- Create: `frontend/features/users/hooks/useRbac.ts`
- Modify: `frontend/features/users/hooks/index.ts` (re-exportar)
- Modify: `frontend/contexts/AuthContext.tsx` (exportar `can()`)
- Create: `frontend/components/auth/Can.tsx`
- Modify: `frontend/features/users/components/UserDrawer.tsx` (usar `kind` real de API)
- Test: `frontend/features/users/components/__tests__/UserDrawer.test.tsx` (agregar test de kind)

**Interfaces:**
- Produces:
  ```typescript
  // frontend/features/users/api/rbacApi.ts
  export interface CatalogPermission {
    code: string
    name: string
    model: string | null
    kind: "module" | "view" | "add" | "change" | "delete" | "business"
    bundles: string[]
  }
  export interface CatalogApp {
    app: string
    label: string
    permissions: CatalogPermission[]
  }
  export interface RbacBundle {
    key: string
    label: string
    description: string
    sensitive: boolean
    permissions: string[]
  }
  export interface Composition {
    bundles: string[]
    extra_permissions: string[]
    excluded_permissions: string[]
    effective_permissions: string[]
  }
  export interface CompositionSaveResult {
    status: string
    sod_warnings: Array<{ rule: string; label: string; user: string }>
  }
  ```
  ```typescript
  // frontend/features/users/hooks/useRbac.ts — exports:
  useBundles(): { data: RbacBundle[], isLoading, isError }
  useComposition(groupId: number): { data: Composition | undefined, isLoading, isError, refetch }
  useSaveComposition(): UseMutationResult<CompositionSaveResult, …>
  ```
  ```typescript
  // frontend/contexts/AuthContext.tsx — new export:
  can: (permission: string) => boolean  // is_superuser || permissions.includes(p)
  ```
  ```typescript
  // frontend/components/auth/Can.tsx
  <Can permission={string | null} fallback={ReactNode}>{children}</Can>
  ```
- Consumes: `AuthContext.user.is_superuser`, `AuthContext.user.permissions`, `GET /api/core/permissions/bundles/`, `GET /api/core/groups/{id}/composition/`, `PUT /api/core/groups/{id}/composition/`

- [ ] **Step 1: Update `AppGroup` in `types/entities.ts` y `AppUser.groups`**

`AppUser.groups` debe aceptar `AppGroup[]` además del legacy `string[]`.  El tipo existente `AppGroup` ya tiene `kind?: 'ROLE' | 'TEAM'`; no hay que cambiar la interfaz, solo eliminar el fallback de la lectura.

Modificar `AppUser`:
```typescript
export interface AppUser {
  // ... campos existentes ...
  groups: AppGroup[]  // era: unknown[] o string[]; ahora siempre objetos
}
```

- [ ] **Step 2: Create `frontend/features/users/api/rbacApi.ts`** con los tipos y funciones de arriba

```typescript
import api from '@/lib/api'

// --- tipos (ver Interfaces arriba) ---

export const rbacApi = {
  getBundles: (): Promise<RbacBundle[]> =>
    api.get('/core/permissions/bundles/').then(r => r.data),
  getCatalog: (): Promise<CatalogApp[]> =>
    api.get('/core/permissions/catalog/').then(r => r.data),
  getComposition: (groupId: number): Promise<Composition> =>
    api.get(`/core/groups/${groupId}/composition/`).then(r => r.data),
  setComposition: (groupId: number, data: Omit<Composition, 'effective_permissions'>): Promise<CompositionSaveResult> =>
    api.put(`/core/groups/${groupId}/composition/`, data).then(r => r.data),
}
```

- [ ] **Step 3: Re-export desde `frontend/features/users/api/index.ts`**

```typescript
export * from './rbacApi'
```

- [ ] **Step 4: Create `frontend/features/users/hooks/useRbac.ts`** con los tres hooks

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { rbacApi } from '../api/rbacApi'

export const rbacKeys = {
  bundles: () => ['rbac', 'bundles'] as const,
  composition: (id: number) => ['rbac', 'composition', id] as const,
}

export function useBundles() {
  return useQuery({ queryKey: rbacKeys.bundles(), queryFn: rbacApi.getBundles, staleTime: 5 * 60_000 })
}

export function useComposition(groupId: number) {
  return useQuery({ queryKey: rbacKeys.composition(groupId), queryFn: () => rbacApi.getComposition(groupId), enabled: groupId > 0 })
}

export function useSaveComposition() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ groupId, data }: { groupId: number; data: Omit<Composition, 'effective_permissions'> }) =>
      rbacApi.setComposition(groupId, data),
    onSuccess: (_result, { groupId }) => {
      void qc.invalidateQueries({ queryKey: rbacKeys.composition(groupId) })
    },
  })
}
```

- [ ] **Step 5: Re-export desde `frontend/features/users/hooks/index.ts`**

- [ ] **Step 6: Modificar `AuthContext.tsx` — exportar `can()`**

En `AuthContextType`, agregar:
```typescript
can: (permission: string) => boolean
```

En `AuthProvider`, implementar (reemplaza la lógica inline existente de `hasPermission`):
```typescript
const can = useCallback((permission: string): boolean => {
  if (!user) return false
  return user.is_superuser || user.permissions.includes(permission)
}, [user])
```

`hasPermission` queda como alias: `hasPermission: can`.

Exportar `can` en el valor del contexto.

- [ ] **Step 7: Create `frontend/components/auth/Can.tsx`**

```typescript
"use client"
import { useAuth } from "@/contexts/AuthContext"

interface CanProps {
  permission: string | null
  children: React.ReactNode
  fallback?: React.ReactNode
}

export function Can({ permission, children, fallback = null }: CanProps) {
  const { can } = useAuth()
  if (!permission) return <>{children}</>
  return can(permission) ? <>{children}</> : <>{fallback}</>
}
```

Actualizar `PermissionGuard` para que sea un alias que use `<Can>` internamente (mantener compatibilidad).

- [ ] **Step 8: Actualizar `UserDrawer.tsx` — eliminar el fallback de kind**

La lógica actual "Fallback: if kind info not available (old data), put all in roles" en `parsedInitialValues` puede mantenerse como salvaguarda, pero ahora que la API devuelve `kind` siempre, es letra muerta. Solo documentar con un comentario que el fallback existe para datos precargados sin consultar la API.

Quitar el comentario obsoleto `// Fallback: if kind info not available (old data)`. La lógica del filter ya usa `(g as AppGroup).kind === 'ROLE'` correctamente.

- [ ] **Step 9: Write unit tests para `can()`**

```typescript
// src/contexts/__tests__/AuthContext.can.test.ts
it('can() returns true for superuser regardless of permission', () => { ... })
it('can() returns true when permission is in user.permissions', () => { ... })
it('can() returns false when permission is not in list', () => { ... })
it('can() returns false when not authenticated', () => { ... })
```

- [ ] **Step 10: Run tests**

```bash
npm run test -- features/users/components/__tests__/UserDrawer.test.tsx
npm run test -- contexts/__tests__/AuthContext.can.test.ts
```

- [ ] **Step 11: Type-check** (`npm run type-check` — must pass)

- [ ] **Step 12: Commit**

```bash
git add frontend/types/entities.ts frontend/features/users/api/rbacApi.ts \
  frontend/features/users/api/index.ts frontend/features/users/hooks/useRbac.ts \
  frontend/features/users/hooks/index.ts frontend/contexts/AuthContext.tsx \
  frontend/components/auth/Can.tsx frontend/features/users/components/UserDrawer.tsx
git commit -m "feat(rbac): RBAC types, hooks, can() + Can component"
```

---

### Task 3: Protección de rutas por módulo, 403 global y limpieza de `action-utils`

**Propósito:** Que cada layout de módulo rechace el acceso sin el permiso `view_dashboard_*` correspondiente, mostrar una página `/403` sin romper la sesión, y eliminar `filterAvailableActions` (código muerto confirmado en la Fase 1).

**Files:**
- Create: `frontend/components/auth/ModuleGuard.tsx`
- Create: `frontend/app/(dashboard)/403/page.tsx`
- Modify: `frontend/app/(dashboard)/accounting/layout.tsx` (y los otros 12 módulos con permission ≠ null)
- Modify: `frontend/lib/api.ts` (agregar interceptor 403)
- Modify: `frontend/contexts/AuthContext.tsx` (suscribirse a `auth:forbidden`)
- Delete: código muerto `filterAvailableActions` en `frontend/lib/action-utils.ts`
- Test: `frontend/components/auth/__tests__/ModuleGuard.test.tsx`

**Interfaces:**
- Produces:
  ```typescript
  // ModuleGuard.tsx
  <ModuleGuard permission={string | null}>{children}</ModuleGuard>
  // Redirige a /403 si can(permission) === false y permission !== null.
  // Muestra <SkeletonShell> mientras AuthContext carga.
  ```
- Consumes: `AuthContext.can`, `AuthContext.isLoading`, `router.replace('/403')`, `MODULE_REGISTRY` (para mapear el módulo a su permission).

- [ ] **Step 1: Create `frontend/app/(dashboard)/403/page.tsx`**

Página estática del App Router que muestra: título "Sin acceso", descripción "No tienes permiso para ver este módulo. Contacta a un administrador del sistema.", botón "Volver al inicio" → `/`.

Usar componentes `PageContainer` + `EmptyState` del barrel shared, o markup directo con tokens semánticos. No importar desde fuera del barrel.

- [ ] **Step 2: Create `frontend/components/auth/ModuleGuard.tsx`**

```typescript
"use client"
import { useAuth } from "@/contexts/AuthContext"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

interface ModuleGuardProps {
  permission: string | null
  children: React.ReactNode
}

export function ModuleGuard({ permission, children }: ModuleGuardProps) {
  const { can, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && permission && !can(permission)) {
      router.replace("/403")
    }
  }, [isLoading, permission, can, router])

  if (isLoading) return null  // o <SkeletonShell> si está disponible sin crear dependencia circular
  return <>{children}</>
}
```

- [ ] **Step 3: Write tests para `ModuleGuard`**

```typescript
// __tests__/ModuleGuard.test.tsx
it('renders children when can(permission) is true', ...)
it('redirects to /403 when can(permission) is false', ...)
it('passes through when permission is null', ...)
it('waits while isLoading', ...)
```

- [ ] **Step 4: Run tests** — expected PASS

- [ ] **Step 5: Update each module `layout.tsx`**

Los módulos con `permission ≠ null` en `MODULE_REGISTRY` son: `accounting`, `sales`, `inventory`, `production`, `treasury`, `purchasing`, `finances`, `hr`. `contacts` tiene `permission: null` — no agregar guard. El módulo `workflow` tiene un `layout.tsx` pero no aparece en `MODULE_REGISTRY`; si tiene permission definida, incluirlo; si no, dejarlo sin guard hasta que se registre.

Para cada layout, envolver el contenido con `<ModuleGuard permission="…">`. Ejemplo:

```typescript
// frontend/app/(dashboard)/sales/layout.tsx
import { ModuleGuard } from "@/components/auth/ModuleGuard"

export default function SalesLayout({ children }: { children: React.ReactNode }) {
  return (
    <ModuleGuard permission="sales.view_dashboard_sales">
      <PageContainer className="flex flex-col">
        <SalesHeader />
        <div className="flex-1 min-h-0 flex flex-col">{children}</div>
      </PageContainer>
    </ModuleGuard>
  )
}
```

La lista exacta de módulos y permisos está en `frontend/lib/module-registry.ts`. Leerla antes de editar cada layout.

- [ ] **Step 6: Agregar interceptor 403 en `lib/api.ts`**

En el interceptor de respuesta existente, **después** del bloque 401, agregar:

```typescript
if (error.response?.status === 403) {
  const url = error.config?.url ?? ''
  // Solo disparar para rutas de datos, nunca para auth endpoints
  if (!url.includes('/auth/') && !url.includes('/token/')) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('auth:forbidden'))
    }
  }
}
```

- [ ] **Step 7: Suscribir `AuthContext` al evento `auth:forbidden`**

En `AuthProvider`, dentro de `useEffect` de inicialización o en un `useEffect` separado, escuchar `auth:forbidden` y mostrar un toast (`toast.error('Sin permiso para realizar esta acción.')`) sin hacer logout.

- [ ] **Step 8: Eliminar código muerto en `lib/action-utils.ts`**

Borrar `filterAvailableActions` (función + su bloque de comentario). Confirmar con `grep -r "filterAvailableActions" frontend/` que no hay consumidores antes de borrar.

Mantener: `getActionBadgeCount`, cualquier otra función que tenga consumidores vivos.

- [ ] **Step 9: Type-check + lint** (`npm run type-check && npm run lint`)

- [ ] **Step 10: Commit**

```bash
git add frontend/components/auth/ModuleGuard.tsx \
  frontend/app/(dashboard)/403/page.tsx \
  frontend/app/(dashboard)/*/layout.tsx \
  frontend/lib/api.ts \
  frontend/contexts/AuthContext.tsx \
  frontend/lib/action-utils.ts
git commit -m "feat(rbac): module route guards, /403 page, global 403 handler, remove dead filterAvailableActions"
```

---

### Task 4: Editor de composición de roles — matriz por paquetes

**Propósito:** Que un usuario con `auth.change_group` pueda editar la composición de un rol con una matriz visual (filas = módulos, columnas = read/operate/manage; sección aparte para capacidades sensibles), con SoD inline y sin poder escalar permisos propios.

**Files:**
- Create: `frontend/features/users/components/RoleCompositionEditor.tsx`
- Create: `frontend/features/users/components/RoleCompositionEditor.schema.ts`
- Modify: `frontend/features/settings/components/GroupsClientView.tsx` (abrir editor desde la lista)
- Modify: `frontend/features/settings/components/groupActions.tsx` (agregar acción "Composición")
- Modify: `frontend/features/users/components/index.ts` (re-exportar)
- Test: `frontend/features/users/components/__tests__/RoleCompositionEditor.test.tsx`

**Interfaces:**
- Consumes: `useBundles()`, `useComposition(groupId)`, `useSaveComposition()`, `AuthContext.can`, `AppGroup.is_system`
- Produces:
  ```typescript
  // RoleCompositionEditor.tsx
  interface RoleCompositionEditorProps {
    group: AppGroup           // el rol a editar
    onSuccess?: () => void    // callback post-save
    readOnly?: boolean        // true si actor no tiene change_group
  }
  ```

**Diseño de la matriz:**

```
┌─────────────────────────┬────────┬─────────┬─────────┐
│ Módulo                  │ Leer   │ Operar  │ Gestionar│
├─────────────────────────┼────────┼─────────┼─────────┤
│ Ventas                  │  ☑    │  ☑      │  ☐      │
│ Compras                 │  ☑    │  ☐      │  ☐      │
│ … (todos los módulos)   │  …    │  …      │  …      │
└─────────────────────────┴────────┴─────────┴─────────┘

Capacidades sensibles
┌────────────────────────┐  ┌────────────────────────┐
│ ☑ Nómina               │  │ ☐ Movimientos Tesorería │
│ …                      │  │ …                       │
└────────────────────────┘  └────────────────────────┘

▼ Permisos avanzados (colapsado por defecto)
```

**Reglas de la matriz:**
- `{módulo}.read` ⊂ `{módulo}.operate` ⊂ `{módulo}.manage` — si se marca `operate`, se marca automáticamente `read` también (visual + en el payload).
- No-escalada: si el actor no tiene todos los permisos de un paquete, el checkbox de ese paquete aparece desactivado (`disabled`). Superusuario: sin restricción.
- `is_system=True`: todos los controles desactivados + banner "Este rol del sistema no es editable".
- Sensibles nunca aparecen en la matriz de módulos; siempre en su sección.

**SoD inline:**
- Al cambiar checkboxes, calcular localmente qué reglas de SoD se activarían (comparando con `SOD_RULES` conocidas, que se pueden importar como constante en el frontend o calcularse desde la respuesta del PUT).
- Mostrar un `Alert` amarillo (no bloqueante) con los conflictos activos antes del botón Guardar.

- [ ] **Step 1: Create `RoleCompositionEditor.schema.ts`**

```typescript
import * as z from 'zod'

export const compositionSchema = z.object({
  bundles: z.array(z.string()),
  extra_permissions: z.array(z.string()),
  excluded_permissions: z.array(z.string()),
})
export type CompositionFormValues = z.infer<typeof compositionSchema>
```

- [ ] **Step 2: Write tests para el editor**

```typescript
// __tests__/RoleCompositionEditor.test.tsx
it('renders bundle matrix with correct module rows', ...)
it('checking operate auto-checks read for same module', ...)
it('disabled checkboxes for bundles actor cannot grant', ...)
it('shows system-role banner and disables all controls when is_system', ...)
it('shows SoD warning when conflicting bundles selected', ...)
it('renders read-only when readOnly=true', ...)
it('calls useSaveComposition on submit with correct payload', ...)
```

- [ ] **Step 3: Run tests — expected FAIL** (components not implemented yet)

- [ ] **Step 4: Implement `RoleCompositionEditor.tsx`**

Estructura:
1. Llamar `useBundles()` y `useComposition(group.id)`.
2. Usar `useForm<CompositionFormValues>` con `zodResolver(compositionSchema)`.
3. En `useEffect`, cuando `composition` carga, llamar `form.reset(composition)`.
4. Construir la matriz:
   - Agrupar `bundles` por `app`: para cada `app` en `_MODULE_APPS` del backend (billing, sales, purchasing, accounting, treasury, hr, production, inventory, contacts, tax, workflow, core, finances), extraer bundles `{app}.read`, `{app}.operate`, `{app}.manage`.
   - `sensitive` bundles en sección separada.
5. Para no-escalada: `actorBundles = bundles.filter(b => actorHasBundle(b, can))`. La función `actorHasBundle(bundleKey, can)` consulta `bundle.permissions` y devuelve `can(p)` para cada uno (all-or-nothing).
6. Lógica de implicación (read ⊂ operate ⊂ manage): en `onChange` de un checkbox, si el usuario marca `operate`, asegurarse de que `read` también esté en el array; si desmarca `read`, desmarcar también `operate` y `manage`.
7. SoD local: definir las 4 reglas SoD como constante local (mismas claves que el backend):
   ```typescript
   const SOD_RULES = [
     { key: "purchasing_treasury", bundles: ["purchasing.operate", "treasury.payments"], label: "Compras + Pagos de Tesorería" },
     { key: "payroll_treasury", bundles: ["hr.payroll", "treasury.payments"], label: "Nómina + Pagos de Tesorería" },
     { key: "billing_cashier", bundles: ["billing.manage", "treasury.cashier"], label: "Facturación + Caja" },
     { key: "security_business", bundles: ["core.security"], sensitivePairs: ["treasury.payments", "sales.credit", "hr.payroll", "contacts.profit_distribution"], label: "Seguridad + Operaciones sensibles" },
   ]
   ```
8. Submit: llamar `useSaveComposition.mutate({ groupId: group.id, data: form.getValues() })`.

- [ ] **Step 5: Run tests — expected PASS**

- [ ] **Step 6: Wire into `GroupsClientView` + `groupActions`**

En `groupActions.tsx`, agregar acción "Composición" que solo aparece cuando `group.kind === 'ROLE'` y `can("auth.change_group")`.

En `GroupsClientView.tsx`, manejar el estado para abrir `RoleCompositionEditor` en un `Drawer` (usar el `Drawer` de shared, mismo patrón que los otros drawers del feature).

- [ ] **Step 7: Re-exportar desde `features/users/components/index.ts`**

- [ ] **Step 8: Type-check + lint** (`npm run type-check && npm run lint`)

- [ ] **Step 9: Run all users tests** (`npm run test -- features/users/`)

- [ ] **Step 10: Commit**

```bash
git add frontend/features/users/components/RoleCompositionEditor.tsx \
  frontend/features/users/components/RoleCompositionEditor.schema.ts \
  frontend/features/settings/components/GroupsClientView.tsx \
  frontend/features/settings/components/groupActions.tsx \
  frontend/features/users/components/index.ts \
  frontend/features/users/components/__tests__/RoleCompositionEditor.test.tsx
git commit -m "feat(rbac): role composition editor — bundle matrix, SoD display, no-escalation"
```

---

### Task 5: ADR y documentación de cierre

**Propósito:** Actualizar `ADR-0104` con las decisiones de Fase 2 (frontend) y cerrar los issues deferred I4, I5, I6 en el ledger.

**Files:**
- Modify: `docs/10-architecture/adr/0104-rbac-action-permissions-roles-teams.md`
- Modify: `docs/30-playbooks/add-role-permission.md` (agregar sección de composición desde la UI)
- No hay tests para esta tarea.

**Interfaces:**
- Consumes: resultado de las Tasks 1-4.
- Produces: ADR actualizado con §Frontend; playbook actualizado con la ruta de composición de roles.

- [ ] **Step 1: Actualizar `ADR-0104`**

Agregar una sección `## Frontend (Fase 2)` al ADR que describa:
- `can()` como única función de verificación de permisos (criterio `some` sobre `permissions.includes(p)`).
- `<ModuleGuard>` + layout.tsx como patrón de protección de rutas.
- Editor de composición consume `GET /permissions/bundles/` + `GET|PUT /groups/{id}/composition/`.
- Notar la resolución de I5 (grupos con `kind` en UserSerializer).

- [ ] **Step 2: Actualizar `add-role-permission.md`**

En la sección de "editar un rol existente", documentar el flujo: Settings → Usuarios → Puestos → acción "Composición" → editor de matriz.

- [ ] **Step 3: Commit**

```bash
git add docs/10-architecture/adr/0104-rbac-action-permissions-roles-teams.md \
  docs/30-playbooks/add-role-permission.md
git commit -m "docs(rbac): update ADR-0104 with Phase 2 frontend decisions"
```
