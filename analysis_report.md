# Análisis Estado de Notas de Crédito y Débito

Este documento detalla el estado actual de la implementación de Notas de Crédito (NC) y Notas de Débito (ND) en el ERP, contrastándolo con las mejores prácticas de la industria y evaluando su integración con otros módulos.

## 1. Análisis por Módulo

### Venta (Sales)
La creación de notas en ventas se gestiona a través de `SalesService.create_note`.

*   **Estado**: Funcional pero básico. Permite registrar notas vinculadas a una Nota de Venta (NV).
*   **Integración de Inventario**: Si se especifican `return_items`, genera un movimiento de stock (Entrada) y reversa el Costo de Venta (COGS).
*   **Contabilidad**: Realiza un asiento manual de reverso (Ventas vs Clientes). El tratamiento del IVA en boletas de venta es correcto (no capitaliza).
*   **Gaps Identificados**:
    *   No utiliza cuentas de ingresos específicas por producto; usa una cuenta global por defecto.
    *   No valida que la cantidad devuelta no exceda la entregada físicamente.
    *   **Servicios**: Permite registrar "devoluciones" de servicios, lo cual no debería permitirse.
    *   **Productos Fabricables (No Track Stock)**: La devolución aumenta el stock del producto terminado defectuoso, pero no debe aumentar el stock de sus componentes.
    *   **Notas de Débito**: Permite registrar ND para productos fabricables sin stock, lo cual debe prohibirse (se debe sugerir crear una nueva NV).

### Compra (Purchasing)
La creación de notas en compras se gestiona a través de `PurchasingService.create_note`.

*   **Estado**: Implementación avanzada y robusta. 
*   **Contabilidad**: Maneja correctamente la reversión de la "Cuenta Puente de Recepción" y distingue entre el tratamiento de IVA para Boletas (reversión de costo capitalizado) y Facturas (reversión de IVA Crédito).
*   **Integración de Inventario**: Maneja devoluciones físicas con movimientos de salida de stock y validación de disponibilidad.
*   **Gaps Identificados**:
    *   Usa el costo actual del producto para la reversión contable, el cual podría variar respecto al costo original de compra si hubo movimientos intermedios.
    *   Depende de que el frontend pase los montos calculados, lo cual es un riesgo de integridad.

---

## 2. Evaluación de Mejores Prácticas ERP

| Práctica | Estado | Observación |
| :--- | :---: | :--- |
| **Trazabilidad** | ⚠️ | Existe vínculo a la Orden (NV/OC), pero el vínculo a la Factura original es débil (campo opcional no persistido en un FK dedicado en el modelo `Invoice`). |
| **Segregación de Funciones** | ✅ | Los servicios están separados por lógica de negocio (Sales vs Purchasing). |
| **Integración con Inventario** | ✅ | Se generan movimientos de stock automáticos ante devoluciones físicas. |
| **Validación de Cantidades** | ❌ | No hay controles estrictos para evitar devolver más de lo que se recibió/entregó. |
| **Tratamiento IFRS/Tributario** | ✅ | Correcto en compras (capitalización en boletas) y correcto en ventas (no capitalización). |

---

## 3. Integración, UoM y Tipos de Producto

### Unidades de Medida (UoM)
*   **Soporte**: El sistema utiliza `convert_quantity` para los movimientos de inventario, lo que permite devolver en unidades distintas a la base del producto (siempre que sean compatibles).
*   **Debilidad**: La lógica financiera (precios y montos) no valida la UoM; asume que el frontend envía valores coherentes.

### Tipos de Producto
*   **Storable**: Bien integrado con Kardex.
*   **Service/Consumable**: Se procesan financieramente, pero el servicio de notas no omite explícitamente la creación de movimientos de stock si se envían por error en `return_items`.
*   **Manufacturable**: El reverso de COGS en ventas para productos fabricados no considera si el producto tenía una Orden de Trabajo (OT) previa, lo que podría duplicar ajustes si no se maneja con cuidado.

---

## 4. Recomendaciones de Mejora

1.  **Modelo de Datos**: Añadir un campo `corrected_invoice` (FK) al modelo `Invoice` para formalizar el vínculo entre la nota y el documento que ajusta.
2.  **Validación de Saldo**: Implementar validaciones en el backend que impidan emitir notas de crédito por cantidades superiores a las remanentes (original - devoluciones previas).
3.  **Unificación de Lógica**: Migrar la lógica de creación de asientos contables al `AccountingMapper` para asegurar que las notas de venta sigan las mismas reglas de cuentas (por producto) que las facturas.
4.  **Referencia de Costos**: En devoluciones de compra, utilizar el costo de la línea de la orden original en lugar del costo promedio actual del producto para el reverso contable.
