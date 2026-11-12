---
id: 0134
title: El F29 se resuelve en un wizard unificado (fase derivada del estado) y el checklist de cierre contable es accionable
status: Accepted
date: 2026-11-12
author: frontend-team
---

# 0134 — Wizard F29 unificado y checklist de cierre accionable

**Relacionado:** ADR-0091, ADR-0087, ADR-0118, ADR-0133. Spec: `docs/superpowers/specs/2026-11-12-f29-wizard-unificado-checklist-cierre-design.md`. Plan: `docs/superpowers/plans/2026-11-12-f29-wizard-unificado-checklist-cierre.md`.

## Contexto

Declarar, pagar y cerrar el F29 vivía en tres superficies distintas (`DeclarationWizard`, `F29PaymentModal`, `F29CloseModal`), con acciones duplicadas en `AccountingClosuresClientView` y `TaxDeclarationsClientView`. El usuario no sabía por dónde seguir si dejaba el proceso a medias. Además, el checklist del cierre contable solo mostraba contadores: para resolver un pendiente había que salir y buscarlo a mano.

## Decisión

1. **Fase derivada, sin paso persistido.** `deriveF29Phase` (`features/tax/utils/f29Phase.ts`) calcula la fase desde el estado del `TaxPeriod` (declaración registrada, monto pagado, cierre). No se guarda ningún "paso actual": retomar el wizard siempre abre la fase que corresponde al estado real.
2. **Tres fases en `DeclarationWizard`:** Pasos previos (Auditoría, Cargos, Resumen), Pago y Cierre. Tras registrar, los pasos previos quedan de solo lectura (sin recalcular ni re-registrar). Pago se omite cuando `vat_to_pay <= 0`. Cierre exige el comprobante PDF. Un período cerrado abre una vista de resultado de solo lectura con el historial de pagos.
3. **Una sola acción F29 contextual** en `AccountingClosuresClientView` y `TaxDeclarationsClientView` (Declarar / Registrar pago / Cerrar, según la fase). Con la fase `done`, `closureActions.ts` oculta la acción en el cierre contable (no hay «Ver F29» ahí); «Ver F29» existe solo en `TaxDeclarationsClientView`. `F29PaymentModal` y `F29CloseModal` se eliminan; su lógica vive en `F29PaymentStep` y `F29CloseStep`.
4. **Semántica de `onSuccess` de `DeclarationWizard`.** Se dispara solo desde «Finalizar» tras un cierre hecho en esa sesión, no tras registrar. Los consumidores refrescan al recibir `onOpenChange(false)`. Motivo: ambos ClientViews cerraban el wizard en `onSuccess`, lo que cortaba el flujo unificado.
5. **Backend: ampliación de `status_check`.** `AccountingPeriodService.get_period_status` agrega `tax_period_id` (o `null`) y cuatro listas de pendientes: `draft_entries`, `draft_invoices`, `unposted_payrolls`, `unconfirmed_statements`. Cada ítem es `{id, label, amount, date}`; `amount` es `null` en nóminas y cartolas pendientes (el endpoint no valida permisos de nómina ni banco, y el sueldo neto o el saldo serían una fuga), y solo trae monto en facturas; tope de 50 por categoría; orden por fecha e id (nóminas por id). Query count constante, con test (ADR-0118, zero N+1).
6. **Checklist accionable.** Secciones Obligatorios (F29 cerrado, sin asientos en borrador) y Sugeridos (facturas en borrador, nóminas, conciliaciones), con «N de M». Cada ítem con pendientes se expande y cada documento abre su drawer con `openEntity` (`accounting.journalentry`, `billing.invoice`, `hr.payroll`, `treasury.bankstatement`). Si hay más que el tope, un enlace «y N más» lleva a la lista de la entidad. El ítem F29 abierto ofrece «Abrir F29», que monta el wizard con `tax_period_id`. Ese objetivo (`tax_period_id`, año, mes) se fija en un snapshot al pulsar el CTA y se mantiene hasta que el wizard cierra: el refetch del estado (p. ej. al recuperar el foco) no debe cambiar `periodId` ni remontar el wizard, lo que perdería el diálogo y lo tipeado. Los ítems en cero («Sin nóminas creadas», «Sin conciliaciones bancarias») ofrecen un enlace a la lista de la entidad.
7. **Reglas de «Listo» cambiadas** en Nóminas y Conciliaciones: pasan solo si hay registros y nada pendiente (antes bastaba cualquier nómina / una conciliación confirmada). Los ítems obligatorios y la compuerta del botón de cierre no cambian.

## Desviación: los documentos y el wizard NO se apilan sobre el checklist

La intención era abrir documentos y wizard "encima" del checklist. No se logró sin tocar primitivas compartidas: el checklist es un `BaseModal` (Dialog modal de Radix, portal a `body`, overlay `fixed inset-0 z-50`), mientras que `openEntity` abre un tab de workspace cuyo drawer se monta embebido en `#main-content`, y `DeclarationWizard` fija `drawerBoundary="embedded"`. Ambos quedarían tapados, sin clics y con cierre por foco-fuera.

Decisión: el modal del checklist **se oculta** mientras el wizard esté abierto o algún tab del workspace esté activo (`open={isOpen && !wizardOpen && !documentActive}`, con `documentActive = tabs.some(t => t.active)`). El componente sigue montado (se conserva el estado de secciones expandidas) y al volver hace `refetch()`.

- **Camino al apilado real:** un diálogo no modal para el checklist, o drawers con `boundary="screen"` cuando se abren desde un diálogo.
- **Fragilidad latente:** si ya hay un tab activo al abrir el checklist, este queda oculto. Hoy no ocurre porque solo se abre desde la vista de la página (`AccountingClosuresClientView`). Si el usuario cambia a la página con la barra de tabs, el checklist reaparece (intencional).

## Consecuencias

- Menos superficies y una sola acción F29; retomar un F29 a medias es directo.
- **Brechas conocidas:**
  - `POST /tax/payments/` no tiene clave de idempotencia (el backend no es idempotente); los pagos no tienen clave de idempotencia. El wizard tiene una guarda en vuelo (`F29PaymentStep` ignora una segunda confirmación mientras la primera sigue pendiente), que es una mitigación y no una garantía: no cubre dos pestañas ni reintentos tras timeout.
  - El tipo `TaxPayment` del frontend no tiene `reference` ni `status`; el historial muestra solo fecha, monto y método.
  - `DocumentAttachmentDropzone` no valida `accept`; la validación del PDF debe reforzarse en el backend.
  - La URL de lista de `billing.invoice` puede no incluir facturas de compra.
  - Los enlaces de lista de «y N más» no filtran por período.
  - `DeclarationWizard.tsx` supera las 600 líneas; se difiere dividirlo.
- No se hizo verificación en navegador con datos reales; solo tests automatizados.
