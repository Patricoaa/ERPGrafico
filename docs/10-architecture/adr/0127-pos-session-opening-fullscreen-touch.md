---
id: 0127
title: Apertura y cierre de sesión POS a pantalla completa, barra superior única y ChoiceCard size="touch"
status: Accepted
date: 2026-11-11
author: frontend-team
---

# 0127 — Apertura y cierre de sesión POS a pantalla completa, barra superior única y `ChoiceCard size="touch"`

**Relacionado:** ADR-0096 (ChoiceCard light), ADR-0097 (familia de cards), ADR-0125 (modo de caja), ADR-0126 (X/Z en vivo), ADR-0128 (lecturas de justificación), `docs/20-contracts/component-choice-card.md`.

## Contexto

La apertura de sesión del POS era un `GenericWizard` modal sobre el POS bloqueado (overlay con blur + card "Sesión Cerrada"). En tablets y tótems táctiles: el POS inutilizable quedaba detrás, cada paso usaba un lenguaje visual distinto (botones outline, botones de lista, ChoiceCard light, numpad) y los blancos táctiles eran chicos.

## Decisión

1. **Estructura única del POS** (`features/pos/components/flow/`):
   - `POSTopBar`: icono + punto de venta (nombre + modo de caja como subtítulo) · progreso · acciones. La usan la venta (`POSClientView`), la apertura y el cierre.
   - `POSStepper`: el progreso de los tres flujos con el mismo lenguaje (círculo numerado, check en lo hecho, K100 en el actual, "Paso n de N" en pantallas angostas). `POSCheckoutHeader` (Carrito → … → Pago) lo usa.
   - `POSFlowLayout`: `POSTopBar` + una pregunta por paso centrada + barra inferior fija (Anterior · indicación · acción, 64px).
2. **Apertura** — `SessionOpenView` (sin surface) reemplaza al POS mientras no hay sesión; elimina `SessionOpenModal`. Pasos: inicio → [punto de venta] → modo de caja → fondo → [motivo] → [cuenta del traspaso] → confirmar.
3. **Cierre** — `SessionCloseView` con el mismo layout: conteo (con `SessionCashSummary`: de dónde sale el esperado y ventas por método, exportable solo a PDF) → [motivo] → [cuenta] → ¿qué hace con el efectivo? (dejar / traspasar / retirar, ADR-0129) → confirmar. `SessionCloseModal` lo envuelve en un diálogo opaco a pantalla completa (siempre diálogo, también dentro de un panel persistente) para abrirlo desde el POS, la lista de sesiones y la ficha. Escape y clic fuera no lo cierran: "Cancelar".
4. **Motivo de diferencia y cuenta del traspaso son pasos propios** con `ChoiceCard size="touch"` (sin desplegables ni teclado): tocar elige y avanza. Las cuentas sin saldo suficiente quedan deshabilitadas con el faltante.
5. `ChoiceCard` suma `size="touch"` (aditivo). `CashModeChoice` suma `size="touch"`.
6. `SessionControl` queda montado fuera de ambas ramas del POS: resuelve la sesión actual, recibe la sesión abierta (`acceptOpenedSession`) y muestra el informe Z encima de la apertura tras un cierre. `openSessionDialog` sale del handle.

## Consecuencias

- No hay POS visible ni overlay durante la apertura o el cierre; "Salir" lleva al inicio de la app.
- En la venta solo el paso actual del progreso lleva etiqueta salvo en pantallas ≥1536px (los demás muestran número/check).
- `CashDifferenceJustification` deja de exportar el panel con `TreasuryAccountSelector`; exporta `CashDifferenceBanner`, `CashDifferenceReasonChoice` y `TransferAccountChoice`.
