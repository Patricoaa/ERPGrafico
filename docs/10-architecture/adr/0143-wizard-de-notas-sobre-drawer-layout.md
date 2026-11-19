---
id: 0143
title: Wizard de notas NC/ND sobre Drawer + DrawerLayout (patrón de compra), hook como única fuente del paso
status: Accepted
date: 2026-11-19
author: frontend-team
---

# 0143 — Wizard de notas sobre `Drawer` + `DrawerLayout`

**Relacionado:** ADR-0096 (riel de pasos), `component-drawer.md`, `component-modal.md` (GenericWizard), `PurchaseCheckoutWizard`.

## Contexto

`UnifiedNoteWizard` se migró a `GenericWizard` en el refactor "Fase 3" (`b28e8c855`) y quedó roto y desalineado:

1. **Navegación rota.** No pasaba `footer`, así que `GenericWizard` usaba su footer por defecto, que avanza su propio `currentStep` sin pasar por `useNoteWizardState`: se omitía `validateCurrentStep`, el paso podía quedar en blanco (solo el paso actual del hook tenía `component`) y convivían dos botones de retroceso.
2. **Altura 600px.** Sin `size`, `GenericWizard` usaba `md`; no se abría a pantalla completa como compra, contrario a lo que decía `component-drawer.md`.
3. **Sin el patrón de compra:** rail no colapsable/clicable, contador de paso solo en el rail, chrome distinto.
4. **Duplicación:** `fetchSource` + `onSubmit` (~70 líneas) duplicados en dos sitios (uno de ellos código muerto), casts `as` sin parseo, `NoteStep_Logistics` tipado con `Record<string, unknown>`.

## Decisión

- `UnifiedNoteWizard` usa `Drawer` (`side="bottom"`, `boundary="embedded"`, `defaultSize="100%"`) + `DrawerLayout`, igual que `PurchaseCheckoutWizard`: subtítulo `NN / NN · Paso · Contraparte`, footer `CancelButton`/`SubmitButton`, rail izquierdo `DrawerResizableRail` (colapsable, persistido, clicable) y rail derecho colapsable.
- **`useNoteWizardState` es la única fuente de verdad del paso.** Nuevo `goToStep(index0)`: retroceder libre; avanzar solo un paso y con validación.
- `GenericWizard` queda para wizards sin rail de proceso (modal/inline); un wizard con rail de pasos clicable, secuencia dinámica y validación propia usa el patrón `Drawer` + `DrawerLayout`.
- `NoteProcessSidebar` se genera desde `stepsSequence` real y sirve a ambos modos; se elimina `PurchaseNoteSummarySidebar`.
- Adaptador de venta único: `features/billing/utils/salesNoteAdapter.ts` (parseo Zod de la factura origen + `FormData`) y hook `useSalesNoteWizardAdapter` (invalida facturas vía `useNoteCheckout`). El cableado vive en `features/orders/components/OrderNoteWizard.tsx` (inyecta el paso de fabricación de `sales`).
- Logística tipada: `NoteLogisticsData` / `NoteLogisticsLineData`; `NoteStep_Logistics` → `NoteLogisticsStep`.
- **Pestaña propia.** El wizard vive en la ruta `/notes/new?invoice=ID&type=NOTA_CREDITO|NOTA_DEBITO` (`NoteWizardPage`); las acciones `create-credit-note`/`create-debit-note` del motor hacen `window.open(..., '_blank')`. Al terminar, la pestaña de origen se refresca por la invalidación realtime entre pestañas.
- **Emitir/recibir luego.** `NoteRegistrationStep` incorpora `DteEmitLaterSwitch` (omitido para clases auto-emitidas); su texto es dinámico: ventas "Aún no emitiré el documento / no está en el RCV", compras "Aún no he recibido el documento / no está disponible en el RCV".
- **Pestaña del espacio de trabajo.** El wizard se abre como pestaña del motor de pestañas (`WorkspaceTabBar`), no como drawer suelto ni pestaña del navegador: `useGlobalModalActions().openNoteWizard({ invoiceId, noteType, display })` en `GlobalModalProvider` (tipo de pestaña `note`, clave `note:{tipo}:{factura}`, tope `MAX_TABS`). Las acciones `create-credit-note`/`create-debit-note` del motor la invocan. Como la calculadora, la pestaña vive montada mientras exista (`open = activa`) y `useNoteWizardState` inicializa una sola vez por montaje, así que cambiar de pestaña no pierde lo ingresado. Al emitir se invalidan los documentos (`NoteWizardTab`) y el wizard cierra su pestaña.
- **Emitir/recibir luego.** `NoteRegistrationStep` incorpora `DteEmitLaterSwitch` (omitido para clases auto-emitidas); su texto es dinámico: ventas "Aún no emitiré el documento / no está en el RCV", compras "Aún no he recibido el documento / no está disponible en el RCV".
- Se elimina el bloque muerto `addingNote` de `SalesOrdersClientView` (nunca se activaba).

## Consecuencias

- Contratos: `component-drawer.md` ya no atribuye `GenericWizard` a notas/compras (compra tampoco lo usa hoy).
- Tests: `useNoteWizardState` (validación y `goToStep`), `salesNoteAdapter`, smoke de `UnifiedNoteWizard`.
- **Bug estructural en compras (relacionado):** `GET /inventory/products/` usa `ProductListSerializer`, que nunca expuso `last_purchase_price`, `purchase_uom`, `receiving_warehouse` ni `preferred_supplier(_name)`; el wizard y el modal de compra los leían del listado → costo siempre 0. Ahora el listado los expone (anotados por subquery, sin JOIN ni N+1) y `suggestedUnitCost` cae a `cost_price` sin historial.
- **Bug estructural en compras (relacionado):** `GET /inventory/products/` usa `ProductListSerializer`, que nunca expuso `last_purchase_price`, `purchase_uom`, `receiving_warehouse` ni `preferred_supplier(_name)`; el wizard y el modal de compra los leían del listado → costo siempre 0. Ahora el listado los expone (anotados por subquery, sin JOIN ni N+1) y `suggestedUnitCost` cae a `cost_price` sin historial.
- Pendiente (no incluido): guarda de "cambios sin guardar" al cerrar la pestaña con una nota a medias (`registerDirty` está pensado para formularios react-hook-form, no wizards): pestaña "Relaciones" en el wizard de notas.
