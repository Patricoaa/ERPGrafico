## Smoke OT Wizard Unificado

### 1. Crear OT manual
- Toolbar → "Nueva OT" → seleccionar "Producción para Stock"
- Elegir producto, qty, uom, fechas → "Crear orden"
- ✓ Wizard cambia a etapa MATERIAL_ASSIGNMENT sin recargar
- ✓ URL contiene `?selected=<NEW_ID>&step=MATERIAL_ASSIGNMENT`

### 2. Crear OT linked
- Toolbar → "Nueva OT" → seleccionar "Vincular a Venta"
- Elegir NV, ítem, fechas, specs → "Crear orden"
- ✓ Mismas validaciones que (1)

### 3. Editar OT en MATERIAL_ASSIGNMENT
- Abrir OT existente desde tabla → click "Editar" en header
- ✓ Navega al Step 0 dentro del mismo modal
- Modificar descripción, "Guardar cambios" → PUT 200
- ✓ Datos actualizados en la OT

### 4. View OT en PRESS
- Abrir OT en etapa PRESS → click "Editar"
- ✓ Step 0 visible, inputs deshabilitados

### 5. Cerrar wizard
- Esc o botón cerrar → URL limpia (sin selected/step/new)

### 6. Doble click submit
- En step 0 modo create, click rápido x2 en "Crear orden"
- ✓ Sólo 1 POST exitoso; el segundo (si llega) usa la misma Idempotency-Key
