# Estado actual vs. Sprint 1 de la estrategia

Evaluación de lo que ya existe en el código contra lo propuesto en [strategy.md](strategy.md), foco en el **Sprint 1** (audit log de negocio).

## TL;DR

**Sprint 1 está completado y superado.** También hay piezas del Sprint 3 ya hechas. **No hay gaps críticos en la cobertura de auditoría.**

> Nota: una versión anterior de este documento reportaba que `sales` y `billing` habían "perdido" `HistoricalRecords()`. Eso era incorrecto — la auditoría está activa para esos modelos vía herencia desde la clase abstracta `AuditedModel`. Ver §1.5.

## 1. Inventario de lo que existe

### 1.1 `django-simple-history` instalado y activo

`simple_history` en `INSTALLED_APPS` y `HistoryRequestMiddleware` registrado en [backend/config/settings.py](../../../backend/config/settings.py).

### 1.2 Cobertura de modelos auditados

41 declaraciones explícitas de `HistoricalRecords()` en `models.py`:

| App | Modelos con history explícito |
|---|---|
| inventory | 9 |
| treasury | 14 |
| accounting | 2 |
| hr | 2 |
| contacts | 1 |
| production | 1 |
| tax | 1 |

Adicionalmente, **todos** los `TransactionalDocument` y `AuditedModel` heredan history automáticamente (ver §1.5).

### 1.3 `ActionLog` — auditoría de acciones privilegiadas

Modelo en [backend/core/models/__init__.py:136](../../../backend/core/models/__init__.py#L136). Tipos: `LOGIN`, `LOGOUT`, `EXPORT`, `PRINT`, `SETTINGS_CHANGE`, `SECURITY`, `OTHER`. Captura usuario, IP, timestamp y `metadata` JSON.

Disparado desde:

- [backend/core/views.py](../../../backend/core/views.py) — login, cambios de password, asignación de permisos, exportaciones.
- [backend/core/middleware.py](../../../backend/core/middleware.py) — `AuditMiddleware` intercepta cualquier `POST/PUT/PATCH/DELETE` exitoso sobre rutas de configuración (`/api/company/`, `/api/users/`, `/api/accounting/settings/`, o cualquier path que contenga `settings`/`config`).

Esto cubre el **Sprint 3** propuesto en la estrategia.

### 1.4 `ActivitySidebar` — UI consumidora

[frontend/features/audit/components/ActivitySidebar.tsx](../../../frontend/features/audit/components/ActivitySidebar.tsx) renderiza el timeline de cambios con diff campo a campo. Soporta 30+ tipos de entidad declarados en la prop `entityType`.

Hooks: [frontend/features/audit/hooks/useEntityHistory.ts](../../../frontend/features/audit/hooks/useEntityHistory.ts).

Modales que ya lo montan: EmployeeFormModal, AdvanceFormModal, ProductForm, AccountsClientView, TerminalManagement, UoMCategoryForm, UoMForm, AttributeManager, MasterDataManagement, TreasuryAccountModal, CategoryForm, WarehouseForm, TerminalFormModal, ContactModal, SaleOrderSidebar, además del shared `EntityDetailPage`.

### 1.5 Herencia de history vía `AuditedModel` / `TransactionalDocument`

Pieza clave que un grep ingenuo por `HistoricalRecords` en `*/models.py` no detecta:

[backend/core/models/abstracts.py:17](../../../backend/core/models/abstracts.py#L17)

```python
class AuditedModel(TimeStampedModel):
    """Entidad con historial completo (simple_history). Hereda timestamps."""
    history = HistoricalRecords(inherit=True)
    class Meta:
        abstract = True

class TransactionalDocument(AuditedModel):
    ...
```

Consecuencia: **todo modelo que extiende `TransactionalDocument` o `AuditedModel` obtiene auditoría sin declararla**. Esto cubre:

- `billing.Invoice` → tabla `billing_historicalinvoice`
- `sales.SaleOrder` → tabla `sales_historicalsaleorder`
- `sales.SaleDelivery` → tabla `sales_historicalsaledelivery`
- `sales.SaleReturn` → tabla `sales_historicalsalereturn`
- `purchasing.PurchaseOrder` y otros documentos transaccionales

Verificado con un `manage.py shell`:

```
SaleOrder:    history=True, table=sales_historicalsaleorder
SaleDelivery: history=True, table=sales_historicalsaledelivery
SaleReturn:   history=True, table=sales_historicalsalereturn
Invoice:      history=True, table=billing_historicalinvoice
```

### 1.6 `GlobalAuditLogView` y `AuditHistoryMixin`

[backend/core/views.py](../../../backend/core/views.py) expone un endpoint global que combina `ActionLog` + historiales por modelo. `AuditHistoryMixin` se aplica a `UserViewSet` y `CompanySettingsViewSet`.

## 2. Mapeo: Sprint 1 propuesto ↔ realidad

| Item del Sprint 1 (estrategia) | Estado | Comentario |
|---|---|---|
| Instalar `django-auditlog` / `simple-history` | ✅ Hecho | `simple_history` ya configurado. |
| Modelos críticos auditados | ✅ Hecho | Cobertura explícita en 7 apps + herencia automática vía `AuditedModel`/`TransactionalDocument` para facturas, notas de venta, despachos, devoluciones, órdenes de compra. |
| Vista "Historial" en la UI | ✅ Superado | `ActivitySidebar` ya integrado en muchos modales con diff visual. |

| Item del Sprint 3 (estrategia) | Estado | Comentario |
|---|---|---|
| Logging de auth (login OK/fail, cambio rol) | ✅ Hecho | `ActionLog` + handlers en `core/views.py`. |
| Endpoint admin para revisarlos | ✅ Hecho | `ActionLogViewSet` y `GlobalAuditLogView`. |

## 3. Mejoras menores opcionales

Ninguna es bloqueante; quedan como backlog.

### 3.1 Mensaje cuando no hay historial

`ActivitySidebar` muestra "Sin actividad registrada" tanto cuando el modelo no tiene history como cuando aún no se editó. Si el `entityType` apunta a un modelo sin auditoría, el endpoint podría devolver un error semántico ("auditoría no habilitada para este tipo") para no confundir al usuario.

### 3.2 Documentar la convención de herencia

Vale la pena dejar explícito en [docs/10-architecture/backend-apps.md](../../10-architecture/backend-apps.md) que extender `AuditedModel` o `TransactionalDocument` automáticamente activa auditoría — así un futuro mantenedor no agrega `HistoricalRecords()` duplicado (error `MultipleRegistrationsError`, exactamente lo que aprendimos al validar este informe).

### 3.3 Sprint 2 — APM y uptime (diferido)

Sentry SDK y Healthchecks.io aún no integrados. No bloqueante; sigue siendo recomendable para la próxima iteración según la estrategia.

## 4. Conclusión

La feature de auditoría que el equipo ya tiene **excede** lo planteado en el Sprint 1 original: combina `simple-history` (audit log de negocio, declarado por modelo o heredado) con `ActionLog` (acciones privilegiadas) y un `ActivitySidebar` rico en UI. No hay deuda crítica en esta capa.

El foco siguiente debería ser:

1. **Sprint 2**: Sentry + Healthchecks como próximo trabajo de observabilidad.
2. Mejoras de UX en `ActivitySidebar` (§3.1).
3. Documentar la convención de herencia (§3.2).

## 5. Lección de proceso

El primer borrador de este documento afirmaba que existía un gap crítico (sales/billing sin auditoría) basándose en un grep literal por `HistoricalRecords` dentro de `*/models.py`. Eso ignoró la herencia desde clases abstractas en `core/models/abstracts.py`. La validación con un `manage.py shell` (o intentar `makemigrations`) habría detectado el error antes — y de hecho fue lo que lo detectó al intentar la "fix": `MultipleRegistrationsError`. **Conclusión:** para verificar cobertura de auditoría, no basta con grep; hay que inspeccionar el MRO o introspectar `Model.history` en runtime.
