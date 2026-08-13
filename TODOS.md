# TODOS

Deuda técnica y mejoras pendientes, agrupadas por tema. Convención: una entrada por ítem accionable con ruta/archivo de referencia.

## Selectores

- **Fusionar `ProductSelector` (legacy) con el selector compartido de POS** — tras el refactor de contexto (ADR-0071), `frontend/components/selectors/ProductSelector.tsx` y el selector `ProductSelector` compartido (`components/shared`) conviven con APIs similares. Fusionar en uno solo y deprecar el legacy, unificando `productTypes`/`canBeSold`/`canBePurchased`.
- **Paginación server-side en `useProductSearch`** — hoy el hook trae un tope fijo (200) y filtra tipos en cliente vía `product_type__in`. Migrar a paginación server-side (offset/limit o cursor) para volúmenes grandes de inventario y permitir `allowedTypes` server-side sin tope.
- **`canBeSold` sin consumidores** — la prop se conserva por simetría (OV-6 del ADR-0071); no hay caller actual. Eliminar si persiste sin uso tras la fusión de selectores.

## Datos / Backend

- **Revisión de BOMs legacy con componentes `MANUFACTURABLE`** — `python3 manage.py audit_bom_line_types` reporta líneas existentes fuera de la nueva regla (STORABLE-only para líneas nuevas). Pendiente decisión de negocio sobre normalización de las existentes (migrar subensambles o dejar como excepción documentada).
- **WeasyPrint** — `production/tests/test_pdf.py::test_task203_workorder_pdf_generation` falla por `ModuleNotFoundError: No module named 'weasyprint'` en el entorno. Instalar la dependencia o marcar el test como skip condicional.

## Tooling / Entorno

- **Instalar `jq`** — el skill de gstack (autoplan/eng-review) lo requiere para escribir el tasks JSONL; hoy queda vacío con fallback manual.
- **Alias `python`** — el entorno solo expone `python3`; documentar o crear el alias para los comandos del playbook.
