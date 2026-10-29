# RBAC para ERPGrafico — diagnóstico verificado y diseño

**Issues:** #69, #140, #188 (se consolidan en una épica).
**Fecha:** 2026-10-29 · **Estado:** Propuesto · **ADR asociado:** ADR-0104 (se redacta en la Fase 1).

Este documento es la especificación que siguen los planes de implementación:

- Fase 0: [`plans/2026-10-29-rbac-phase0-security-hardening.md`](../plans/2026-10-29-rbac-phase0-security-hardening.md)
- Fase 1: [`plans/2026-10-29-rbac-phase1-backend-foundation.md`](../plans/2026-10-29-rbac-phase1-backend-foundation.md)
- Fases 2 y 3: se planifican al cerrar la Fase 1, porque consumen sus interfaces (catálogo, `GroupProfile`, `action_permissions`).

---

## 1. Diagnóstico verificado contra el código (2026-10-29)

Cada hallazgo se verificó ejecutando código, no solo leyendo contratos.
"Sonda" significa un test pytest temporal ejecutado en local y luego eliminado. "Dev" significa una consulta `manage.py shell` en el servidor 192.168.1.86.

### 1.1 Críticos (seguridad)

| # | Hallazgo | Evidencia |
|---|---|---|
| C1 | Un usuario autenticado puede asignarse el rol `ADMIN`. `CurrentUserView.patch` (`backend/core/views.py:81`) usa `UserSerializer` completo, donde `groups` e `is_active` se pueden editar. | Sonda: `PATCH /api/auth/user/ {"groups":["ADMIN"]}` y `PATCH /api/core/auth/me/` responden **200** con `groups=['ADMIN']`, ejecutados por un usuario OPERATOR. |
| C2 | Un usuario sin permisos puede crear, renombrar y **borrar** cualquier rol. `GroupViewSet` (`backend/core/views.py:206`) usa `permission_classes=[IsAuthenticated]`. | Sonda: un usuario OPERATOR ejecuta create **201**, rename **200** y delete **204** sobre `ADMIN`. Resultado: `ADMIN exists: False`. |
| C3 | Las acciones de negocio heredan el permiso del método HTTP. Un `POST /invoices/{id}/annul/` solo exige `billing.add_invoice`. | Sonda: con únicamente `add_invoice`, `StandardizedModelPermissions.has_permission` devuelve `True` para `annul`. Un análisis estático encontró **150** `@action` de escritura sin permiso propio (13 `annul`, 6 `cancel`, 6 `confirm`, …). |
| C3b | `TreasuryDashboardViewSet.register_transfer` (`backend/treasury/views.py:1030`) es un `ViewSet` sin queryset, así que solo exige estar autenticado para registrar transferencias. | Lectura de código (rama "sin queryset" de `StandardizedModelPermissions`). Se resuelve en la Fase 1, Task 3b. |
| C5 | `POST /api/core/documents/<ct>/<id>/<action>/` (`core/api/document.py`) solo exige `IsAuthenticated` y ejecuta `getattr(service, action)(instance, **request.data)`. Así, **cualquier usuario puede confirmar o cancelar órdenes de venta y compra**, incluidos sus asientos. Nada lo usa: ni el frontend ni los tests. | Lectura de código y búsqueda de consumidores. Fase 0, Task 7 (se elimina). |
| C6 | Las vistas sin modelo solo exigen sesión: la bitácora global (`GlobalAuditLogView`), **7 reportes financieros** (`finances/views.py`: balance, resultados, flujo, BI…), los parámetros globales de RRHH (`GlobalHRSettingsViewSet`, **incluida la escritura**) y el dashboard de tesorería. | Inventario de vistas sin queryset. Fase 0, Task 8. |
| C4 | `StandardizedModelPermissions` deja pasar a cualquier usuario autenticado si `get_queryset()` lanza una excepción (`backend/core/api/permissions.py:41`). | Lectura de código. Se corrige como medida preventiva. |

### 1.2 Fallos funcionales derivados

| # | Hallazgo | Evidencia |
|---|---|---|
| F1 | `GET /api/workflow/assignment-rules/` da **500**. `TaskAssignmentRuleViewSet.queryset` aplica `select_related("assigned_group")` sobre un `CharField`. Por eso **no existe ninguna regla configurada** y ninguna aprobación se asigna a nadie. | Dev: `FieldError: Non-relational field given in select_related: 'assigned_group'`. `TaskAssignmentRule.objects.count() == 0`. |
| F2 | Hay permisos referenciados que no existen. Se usan en el código pero nunca se registran: `sales.approve_credit` (`billing/services.py:988`, `SalesCheckoutWizardView.tsx:183`) y `hr.view_dashboard_hr` (`frontend/lib/module-registry.ts:27`). | Se cruzó el catálogo real (751 permisos, generado con `apps.get_models()` más `PermissionRegistry`) contra los literales del código. **El módulo RRHH queda oculto para todo usuario que no sea ADMIN ni superusuario.** Solo un superusuario puede aprobar crédito directo. |
| F3 | La lista `OPERATOR` de `sync_permissions` contiene 5 permisos inexistentes: `view_tax`, `view_pricelist`, `view_cashbox` (modelos eliminados), `view_employeconceptamount` (error de tipeo; el correcto es `view_employeeconceptamount`) y `view_dashboard_hr` (ver F2). | Mismo cruce. |
| F4 | `TreasuryMovementViewSet.destroy` (`backend/treasury/views.py:389`) controla el acceso con `is_staff`, lo que el playbook prohíbe. | Lectura de código. |
| F5 | Seis endpoints de `tax` (`TaxPeriod`, `F29Declaration`, `F29Payment`, `AccountingPeriod`) y tres de configuración de workflow (`TaskAssignmentRule`, `WorkflowSettings`, `NotificationRule`) solo exigen `IsAuthenticated`. Cualquier usuario puede, por ejemplo, editar declaraciones F29 o las reglas de notificación. | Lectura de código. |

| F6 | `PermissionRegistry.sync_to_db` cuelga los permisos de apps sin modelos del content type de `User`. Por eso `finances.view_dashboard_finances` queda guardado como `core.view_dashboard_finances` y **el módulo Finanzas está oculto para quien no es ADMIN**. Además, `tax/apps.py` vuelve a registrar permisos por defecto, lo que produce **6 permisos duplicados** en la base. | Dev: el permiso registrado no está en la base; `Permission` agrupado por `(app_label, codename)` con `n > 1`. Fase 0, Task 3. |
| F7 | `sync_permissions` no se ejecuta al desplegar. Los permisos nuevos de `PermissionRegistry` no llegan a la base y solo el superusuario podría usarlos. | `entrypoint.sh` solo ejecuta `migrate`. Fase 0, Task 4 (`post_migrate` aditivo). |
| F8 | La plantilla `OPERATOR` incluye `view_payroll`, `view_payrollpayment`, `view_salaryadvance`, `add_employee` y `change_employee`: **cualquier operario ve las remuneraciones**. | `sync_permissions.py`. Fase 1, Task 4. |
| F9 | Quien tiene `core.change_user` puede asignar cualquier rol, incluido `ADMIN` y a sí mismo. No existe una regla de no escalada. | Lectura de `UserSerializer`/`UserViewSet`. Fase 1, Task 6. |
| F10 | Tiempo real: `EntityBusConsumer` acepta suscripciones a cualquier `{app}.{model}` y `POSDraftConsumer` a cualquier sesión de caja, sin revisar permisos. | Lectura de `core/consumers.py` y `sales/consumers.py`. Fase 1, Task 3e. |
| F11 | Los registros de acciones del frontend usan permisos aproximados (`treasury.delete_treasurymovement` para anular, `billing.change_invoice`). Cuando el backend exija los permisos de negocio, habrá botones que terminan en 403. | `grep` en `features/*/actions.tsx`. Fase 1, Task 3d. |

Verificado sin hallazgos: los 39 permisos que declaran `SearchableEntity` y los registros de documentos existen. El payload del entity bus solo lleva metadatos (`id`, `op`, `actor_id`).

### 1.3 Estado del modelo de datos real (servidor de desarrollo)

- 6 usuarios activos, 1 de ellos superusuario.
- **Roles del sistema:** `ADMIN` (748 permisos), `MANAGER` (748, es decir, igual a ADMIN), `OPERATOR` (80) y `READ_ONLY` (192).
- **Grupos funcionales que ya existen** (9, con 0 permisos cada uno): Supervisor, Administración, Bodega, Ventas, Diseño, Pre-Prensa, Taller, Terminaciones y Despacho. En la práctica **ya conviven "roles" (permisos) y "equipos" (asignación)**. `UserDrawer` lo refleja como `primary_role` más `functional_groups`, pero el backend no los distingue.
- **916 tareas, ninguna asignada** (`assigned_to`, `assigned_group` y `data.candidate_group` están todos vacíos). Son en su mayoría `HUB_*` (category TASK, que todos ven) y 4 aprobaciones de OT (`OT_*_APPROVAL`) que solo ven su creador y los superusuarios.
- El catálogo de 751 permisos incluye mucho ruido (`historical*`, `contenttypes`, `sessions`, `django_celery_beat`, `socialaccount`). Una pantalla de permisos debe mostrar una selección curada.

### 1.4 Frontend

| Hallazgo | Evidencia |
|---|---|
| `hasPermission` da acceso total si `groups` incluye el texto `'ADMIN'` (`contexts/AuthContext.tsx:127`). Combinado con C1, la escalada también se refleja en la interfaz. | Lectura de código. |
| No hay protección de rutas: los `layout.tsx` de los 14 módulos no revisan permisos. Solo se ocultan entradas de navegación (`ModuleNavTree`, `ModuleLauncher`). | `grep` en `app/(dashboard)/*/layout.tsx`. |
| No hay manejo global de 403: `lib/api.ts` solo intercepta 401. Solo `useSelectedEntity` maneja 403 por su cuenta. | `grep`. |
| Los permisos son `string` libre, lo que permitió F2. También `treasury.add_payment` aparece en `features/orders/__tests__/orderSheet.test.ts`. | Cruce de literales. |
| **Corrección al diagnóstico anterior:** la diferencia `every`/`some` no afecta: `lib/action-utils.ts` (`filterAvailableActions`) es **código muerto** (0 consumidores). La única ruta viva es `resolveRegistryActions` (9 consumidores, criterio `some`). | `grep` de consumidores. |
| `module-registry.ts`: `contacts.permission = null`, así que el módulo de contactos es visible para todos. | Lectura de código. |
| Los nombres de los roles antiguos están escritos en el código en 5 lugares (`UserDrawer`, `ProfileSidePanel`, `user.entity.ts`, `UsersSettingsClientView`, `AuthContext`), y la interfaz asume **un solo rol principal** por usuario (`primaryRole || "OPERATOR"`). | `grep`. Fase 1, Task 8. |
| La marca (`BrandingProvider`, login, 404, barra lateral, recibos) solo usa `name`, `trade_name` y `logo` de `/core/company/current/`. | `grep` de `useBranding()`. Fase 0, Task 9. |

### 1.5 Correcciones al diagnóstico anterior

- `sync_permissions` **no** corre en el `entrypoint` ni en CI. Solo lo llama `setup_demo_data`. El riesgo de que `.set()` pise roles personalizados existe, pero solo cuando alguien lo ejecuta a mano.
- "Solo 3 acciones con permiso propio" se precisa así: hay 150 acciones de escritura sin `permission_classes` propio. 4 ViewSets sobrescriben `get_permissions`, pero solo para abrir el GET de `current` en las configuraciones.

### 1.6 Lo que está bien y se conserva

- Django `Permission`/`Group` como motor, `PermissionRegistry`, `StandardizedModelPermissions` como valor por defecto global (exige `view_*` para leer).
- Las verificaciones en servicios de cierre y reapertura de períodos y del ejercicio fiscal (`tax/services.py`, `accounting/fiscal_year_service.py`).
- `DocumentTypeRegistry.view_permission` y `UniversalRegistry` ya filtran búsqueda y relaciones por permiso.
- `ActionLog.Type.SECURITY` ya existe para auditar.
- Existen tests de invariantes con lista de excepciones (`core/tests/test_architectural_invariants.py`) que sirven de patrón.

---

## 2. Decisiones de diseño

1. **Motor:** se mantiene Django `Permission` + `Group`. `user.has_perm` sigue siendo la única verificación en tiempo de ejecución. No se usan django-guardian, Casbin ni OPA (restricción de presupuesto ~$0 de la PYME). Si alguna vez hace falta alcance por registro, se usará `django-rules` (Fase 4, opcional).
2. **Permisos híbridos en tres niveles:**
   - *Módulo:* `{app}.view_dashboard_{app}`. Controla navegación y rutas. Se completan `hr`, `finances` y `contacts`.
   - *Entidad:* `view`/`add`/`change`/`delete` de Django.
   - *Acción de negocio:* `{app}.{verbo}_{modelo}` con verbos cerrados: `confirm`, `annul`, `cancel`, `post`, `reverse`, `pay`, `write_off`, `dispatch`, `receive`, `close`, `reopen`, `approve`, `override`, `purge`, `export`. Los `can_close_*`/`can_reopen_*` que ya existen en `tax` y `accounting` se conservan. Se registran con `PermissionRegistry`, sin migraciones.
3. **Permisos explícitos por acción:** en cada ViewSet, `action_permissions: dict[str, str | tuple[str, ...] | None]`, que lee `StandardizedModelPermissions`. Al cerrar la Fase 1, CI exige la declaración para **toda** acción de escritura y para toda vista sin modelo.
4. **Rol ≠ Equipo:** `GroupProfile(kind=ROLE|TEAM)`. Los roles otorgan permisos; los equipos (Pre-Prensa, Taller, Despacho…) solo sirven para asignar tareas y notificar, y no pueden tener permisos.
5. **Los roles se componen, no se enumeran** (§2.1): un rol es un conjunto de **paquetes de acceso** definidos en código, más permisos sueltos agregados o excluidos. `Group.permissions` es la materialización de esa composición y se recalcula en cada `migrate`. Así, un permiso nuevo llega solo a los roles que corresponde, y una personalización del usuario no se pierde.
6. **Un solo rol del sistema protegido:** «Administrador del sistema». Los demás puestos sembrados son plantillas editables. El superusuario de Django queda como cuenta de emergencia.
7. **Mínimo privilegio y no escalada:** nadie otorga permisos que no tiene ni cambia sus propios roles. Las capacidades sensibles nunca vienen implícitas en un nivel de módulo.
8. **Separación de funciones (SoD):** reglas estáticas en modo **aviso + auditoría** (en una PYME de pocas personas, bloquear impide operar; el control compensatorio es la bitácora). Cada regla se puede pasar a modo bloqueo. La SoD dinámica (no aprobar lo propio) va en la Fase 3.
9. **Auditoría:** cada cambio de composición de un rol o de roles de un usuario genera un `ActionLog` SECURITY con lo agregado, lo quitado y los conflictos de SoD.
10. **Frontend** (Fase 2): tipo `PermissionCode` generado desde el catálogo; `can()`/`<Can>` con criterio único; protección por módulo en los `layout.tsx` con una página 403; manejo global de 403; **matriz por paquetes** (módulo × nivel más capacidades sensibles), con permisos sueltos solo como opción avanzada.
11. **Tareas y aprobaciones** (Fase 3): `Task.required_permission`; un solo destino de asignación (`Task.assigned_group` FK a un `TEAM`), dejando de usar `data.candidate_group` y el `CharField` legacy; `ApprovalPolicy(document_type, min_amount, required_permission, forbid_self_approval, approvals_required)`; notificaciones dirigidas a rol o equipo en lugar de superusuarios.
12. **Marca pública:** sin sesión solo se exponen el nombre (razón social y nombre de fantasía) y el logo de la empresa (Fase 0, Task 9).

### 2.1 Modelo de roles

**Diagnóstico de los roles actuales.** Se crearon en una etapa temprana y no siguen ninguna práctica reconocida:

- `MANAGER` es idéntico a `ADMIN`.
- `OPERATOR` mezcla producción, ventas, compras, caja, tesorería y RRHH (incluidas las remuneraciones).
- `READ_ONLY` ve todo, incluidas nóminas y la configuración de seguridad.
- El modelo de un solo rol principal por usuario obliga a crear un rol por cada combinación de funciones.

Se **reemplazan**, siguiendo prácticas reconocidas: NIST RBAC (roles por función, jerarquía, restricciones de SoD), mínimo privilegio y el patrón que usan los ERP para PYME (Odoo, ERPNext, SAP Business One), donde cada usuario combina **varios roles** por área y cada área tiene niveles de acceso.

**Tres capas:**

**A. Niveles por módulo.** Son 12 módulos: `sales`, `billing`, `purchasing`, `inventory`, `production`, `contacts`, `treasury`, `accounting`, `tax`, `finances`, `hr`, `workflow`. Cada módulo tiene tres niveles acumulativos:

| Nivel | Incluye |
|---|---|
| `{módulo}.read` | `view_*` y `view_dashboard_*` del módulo |
| `{módulo}.operate` | `read` + `add_*`, `change_*` + verbos operativos: `confirm`, `dispatch`, `receive`, `post` (cuando el registro es rutinario, p. ej. conteos) |
| `{módulo}.manage` | `operate` + `delete_*` + verbos de corrección y control: `annul`, `cancel`, `reverse`, `reopen`, `close`, `write_off`, `approve`, `export`, `override` |

**B. Capacidades sensibles.** Nunca vienen implícitas en un nivel: se restan de los niveles y solo se obtienen con su paquete.

| Paquete | Contenido |
|---|---|
| `hr.payroll` | Remuneraciones: `payroll*`, `payrollitem`, `payrollpayment`, `salaryadvance`, `employeeconceptamount`, `post_payroll`, `pay_payroll`, Previred |
| `treasury.payments` | Salida de dinero: todos los `pay_*` de tesorería, `register_transfer`, `post_bankloan`, `pay_loaninstallment` |
| `treasury.cashier` | Caja/POS: abrir y cerrar sesión (`close_possession`), movimientos manuales de caja, carritos POS |
| `sales.credit` | Crédito: `approve_credit`, `override_credit_limit`, `write_off_contact` |
| `contacts.equity` | Socios y patrimonio: `post_partnertransaction`, aprobar y pagar distribuciones de utilidades |
| `accounting.period_close` | Cierre y reapertura de períodos tributarios y contables y del ejercicio fiscal |
| `finances.reports` | Estados financieros y BI (`view_dashboard_finances`) |
| `core.settings` | Configuración de la empresa y de los módulos, reglas de workflow y de notificación |
| `core.security` | Usuarios, roles y equipos (`core.*_user`, `auth.*_group`) |
| `core.audit` | Bitácora global (`core.view_actionlog`) |
| `core.purge` | Purgar documentos anulados (`*.purge_*`) |

Hay una base implícita para todo usuario autenticado, que no es un rol: su perfil, su bandeja de tareas y notificaciones, y la búsqueda filtrada por permisos.

**C. Puestos sembrados** (plantillas editables; un usuario puede tener varios):

| Puesto | Paquetes |
|---|---|
| **Administrador del sistema** *(sistema, protegido)* | `core.security`, `core.settings`, `core.audit`, `core.purge`, `workflow.manage`. **Sin operaciones de negocio**: si la misma persona opera, se le asigna además un puesto de negocio. |
| **Gerencia** | `*.manage` de todos los módulos de negocio, `finances.reports`, `sales.credit`, `treasury.payments`, `accounting.period_close`, `contacts.equity`, `hr.payroll`, `core.audit` |
| **Administración y Finanzas** | `accounting.manage`, `tax.manage`, `treasury.manage`, `billing.manage`, `finances.reports`, `treasury.payments`, `accounting.period_close`, `contacts.operate`, `purchasing.read`, `sales.read`, `inventory.read` |
| **Ventas** | `sales.operate`, `billing.operate`, `contacts.operate`, `inventory.read`, `production.read`, `workflow.operate` |
| **Caja** | `sales.operate`, `billing.operate`, `treasury.cashier`, `contacts.operate`, `inventory.read` |
| **Compras** | `purchasing.operate`, `contacts.operate`, `inventory.read`, `production.read` |
| **Producción** | `production.operate`, `inventory.read`, `sales.read`, `workflow.operate` |
| **Jefatura de Producción** | `production.manage`, `inventory.operate`, `purchasing.read`, `sales.read`, `workflow.operate` |
| **Bodega y Despacho** | `inventory.operate`, `sales.read`, `purchasing.read`, más los verbos `sales.dispatch_saleorder` y `purchasing.receive_purchaseorder` como permisos agregados |
| **RRHH** | `hr.manage`, `hr.payroll` |
| **Auditor / Contador externo** | `accounting.read`, `tax.read`, `billing.read`, `treasury.read`, `sales.read`, `purchasing.read`, `contacts.read`, `finances.reports`, `core.audit`. Sin `hr.payroll` ni `core.security` |

**Reglas de SoD** (todas en modo aviso):

1. `purchasing.operate` + `treasury.payments`: quien crea compras no debería pagarlas (fraude de proveedor).
2. `hr.payroll` + `treasury.payments`: quien prepara la nómina no debería pagarla.
3. `billing.manage` + `treasury.cashier`: quien cobra en caja no debería poder anular documentos (desvío de caja).
4. `core.security` + cualquier paquete de negocio sensible (`treasury.payments`, `sales.credit`, `hr.payroll`, `contacts.equity`): quien administra accesos no debería operar dinero.

En una empresa donde el dueño hace todo (el caso típico), estas combinaciones existen y son legítimas. Por eso se avisa y se registra en la bitácora, no se bloquea.

**Migración desde los roles antiguos:**

- `ADMIN` → Administrador del sistema + Gerencia;
- `MANAGER` → Gerencia;
- `READ_ONLY` → Auditor;
- `OPERATOR` → según su equipo: Ventas → Ventas; Bodega/Despacho → Bodega y Despacho; Diseño/Pre-Prensa/Taller/Terminaciones → Producción; Supervisor → Jefatura de Producción; Administración → Administración y Finanzas.

El comando primero muestra la propuesta (`--plan`) y solo la aplica después de que el usuario la aprueba (`--apply`). Al terminar, se borran los 4 grupos antiguos.

## 3. Hoja de ruta

| Fase | Contenido | Plan |
|---|---|---|
| 0 | Corregir C1, C2, C4, C5, C6 y F1–F7, y limitar los datos públicos de la empresa (9 tareas) | detallado |
| 1 | `action_permissions` + test de CI · verbos de negocio (≈30 económicos + ≈45 operativos) · declaración explícita de los ≈75 restantes · frontend alineado · tiempo real · **paquetes de acceso, composición de roles, puestos sembrados y migración de los roles antiguos** · no escalada y SoD · frontend mínimo de roles · ADR-0104 | detallado |
| 2 | Frontend: tipos generados, `can`, protección de rutas, 403 global, matriz por paquetes, limpieza de `lib/action-utils.ts` | se escribe al cerrar la Fase 1 |
| 3 | Workflow: asignación unificada a `TEAM`, `required_permission`, `ApprovalPolicy`, SoD dinámica (no aprobar lo propio), notificaciones | se escribe al cerrar la Fase 2 |
| 4 | Opcional: alcance por registro (`django-rules`), visibilidad por campo (`view_cost`) | bajo demanda |

## 4. Decisiones tomadas por el usuario (2026-10-29)

1. **Roles:** los roles actuales no se consideran correctos; se rediseñan según buenas prácticas (§2.1).
2. **Datos públicos de la empresa:** sin sesión, solo nombre y logo.

## 5. Riesgos

- **Cerrar endpoints rompe pantallas** de usuarios no ADMIN. Mitigación: la Fase 0 ajusta de forma provisoria la plantilla `OPERATOR` en la misma tarea que cierra cada endpoint, y la Fase 1 la reemplaza por puestos.
- **Un permiso nuevo queda sin paquete** (solo lo tendría el superusuario). Mitigación: `test_every_curated_permission_belongs_to_a_bundle` falla en CI.
- **La migración deja a alguien sin acceso.** Mitigación: `--plan` se revisa con el usuario, y `--apply` aborta si un usuario activo queda sin puesto.
- **Una persona acumula funciones incompatibles.** Mitigación: avisos de SoD al asignar y registro en la bitácora; las reglas se pueden pasar a modo bloqueo.
