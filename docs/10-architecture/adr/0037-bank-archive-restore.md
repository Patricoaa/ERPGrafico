---
layer: 10-architecture
doc: adr/0037-bank-archive-restore
id: 0037
title: "Eliminación de bancos — patrón Archivo"
status: Accepted
date: 2026-06-03
author: core-team
---

# ADR-0037: Eliminación de bancos — patrón Archivo

## Contexto

La política de eliminación de ERPGrafico ([deletion-policy.md](../../20-contracts/deletion-policy.md))
declara que `treasury.Bank` debe usar el patrón **Archivo** (`is_active = False`)
porque es un dato maestro referenciado por entidades históricas
(`TreasuryAccount`, `Check`, `BankLoan`, `Checkbook`, movimientos de tesorería).
El modelo `Bank` ya tiene el campo `is_active` y el test
`test_deletion_policy_consistency.py` lo valida.

Sin embargo, el código actual:

1. `BankViewSet` hereda el `destroy()` por defecto de DRF — no captura
   `ProtectedError`. Hard delete de un banco con `Check`/`BankLoan`/`Checkbook`
   asociados devuelve un 500 al frontend.
2. `TreasuryAccount.bank` está en `on_delete=SET_NULL`. Un hard delete sin
   PROTECT elimina silenciosamente la referencia, dejando cuentas `CHECKING`
   o `CREDIT_CARD` con `bank=NULL` que violan `TreasuryAccount.clean()`.
3. El frontend expone una acción `delete` con toast genérico que no muestra
   el motivo del fallo (`"Error al eliminar banco"` en vez del `ProtectedError`
   legible).
4. No existen endpoints ni UI para `archive` / `restore`, aunque la tabla
   de acciones lo requiera.

## Decisión

### Backend

- **`BankDeletionService`** (nuevo, `backend/treasury/deletion_service.py`):
  - `get_dependencies(bank) -> dict[str, int]`: cuenta `treasury_accounts`,
    `checks`, `loans`, `checkbooks` vinculados.
  - `can_archive(bank) -> tuple[bool, str | None]`: bloquea si hay préstamos
    con status ≠ `PAID` (activos o refinanciados) o cheques que no estén
    `VOIDED` / `CANCELLED`. Si todas las dependencias son terminales o no hay
    dependencias, permite archivar.
  - `can_destroy(bank) -> tuple[bool, str | None]`: chequea dependencias
    `PROTECT`. Devuelve mensaje legible en español con conteo por tipo.

- **`BankViewSet`**:
  - Nueva action `@action(detail=True, methods=["post"]) archive`: llama al
    servicio, valida, setea `is_active=False`, retorna `BankSerializer`.
  - Nueva action `@action(detail=True, methods=["post"]) restore`: setea
    `is_active=True`.
  - Override `destroy`: en vez de `ModelViewSet.destroy()`, captura
    `ProtectedError` y devuelve `409 Conflict` con `{"detail": mensaje}`.
    El servicio de chequeo de dependencias se usa para producir un mensaje
    claro antes de intentar el delete.
  - `Bank.is_active` filtra en `get_queryset()` por defecto? — **No**:
    queremos que la lista administrativa muestre bancos archivados con
    badge y permita restaurar (cf. política §"Reglas operativas — Archivo").
    El filtro `is_active=True` se aplica a nivel de selector (cf.
    `BankViewSet.get_queryset()`) si se necesita.

### Frontend

- **`treasuryApi`**: nuevos métodos `archiveBank(id)` y `restoreBank(id)`.
- **`useBanks`**: reemplaza `deleteBank` por `archiveBank` / `restoreBank`.
  `onError` propaga el `detail` del backend al toast.
- **`MasterDataManagement`**: en la tabla de bancos, muestra:
  - `archive` para bancos activos.
  - `restore` para bancos archivados (con badge "Archivado" en la fila).
  - Antes de archivar, llama a `getOverview` o un endpoint ligero de
    dependencias para mostrar conteo en el `ConfirmAction`.

### Wizard de creación

Como parte de este cambio, se aprovecha para arreglar dos bugs detectados:

1. **Cuenta contable obligatoria**: el paso 2 del `BankCreationWizard`
   ahora exige `accountId` (selector de cuenta ASSET). Sin esto, el banco
   queda sin vínculo contable, contradiciendo el F5.1 que centraliza
   gastos financieros y la separación CAPA 1/CAPA 2 de tesorería.
2. **Doble creación al retroceder**: `GenericWizard` no trackea pasos
   completados. Refactor de `handleCreateBank` en el wizard: si
   `createdBankId !== null`, llama a `updateBank` en vez de crear otro.
   Mínimo cambio, sin tocar el componente compartido.

## Consecuencias

- Los bancos nunca se borran. Solo se archivan. La acción `delete` queda
  como fallback administrativo (solo accesible vía API directa o para
  cleanup en demo data) y devuelve 409 con mensaje específico cuando
  hay dependencias.
- `Bank.is_active=False` saca al banco de los selectores de creación de
  `TreasuryAccount` y `BankLoan`, pero las FKs históricas siguen
  funcionando.
- `HistoricalRecords` registra el cambio de `is_active` (audit trail
  completo).
- `test_deletion_policy_consistency.py` ya pasa (la tabla dice
  "Archivo" y el modelo tiene `is_active`). No requiere cambios
  adicionales.
- El wizard de bancos queda protegido contra doble-creación por
  navegación y exige el campo contable que faltaba.

## Referencias

- Política: [deletion-policy.md](../../20-contracts/deletion-policy.md) §"Mapeo por app"
- F5.1 — cuentas de gasto financiero: ADR-0036
- Taxonomía CAPA 1 / CAPA 2: ADR-0031
